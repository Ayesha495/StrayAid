"""Fake but consistent demo data for StrayAid, set in Islamabad and Rawalpindi.

Run:   python manage.py seed_demo_data
Fresh: python manage.py seed_demo_data --reset   (deletes every @strayaid.local demo account first)

Safe to re-run: records are matched by stable keys and photos are only attached once.
Timestamps are relative to "now", so stories stay inside their 24-hour window; re-run before a demo.
All demo accounts use the password in DEMO_PASSWORD.
"""

from datetime import timedelta
from pathlib import Path

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounts.models import User
from animals.models import AdoptionApplication, Animal, Sponsorship
from chat.models import Conversation, Message
from notifications.models import AnimalFollow, CaseFollow, Notification, OrganizationFollow
from organizations.models import Organization, ShelterDonation
from posts.models import CommentLike, Post, PostComment, PostLike, SavedPost, Story
from rescue.models import Case, CaseUpdate, Report
from rescue.signals import STATUS_MESSAGES
from rescue.utils.scoring import refresh_case_score, score_report

STITCH_IMAGES = Path(__file__).resolve().parents[5] / "images" / "stitch"
DEMO_DOMAIN = "@strayaid.local"
DEMO_PASSWORD = "demo12345"


def photo(name):
    return ContentFile((STITCH_IMAGES / name).read_bytes(), name=name)


def attach_photo(instance, field_name, name):
    # Attach once; re-runs keep the existing file instead of piling up copies.
    field = getattr(instance, field_name)
    if not field:
        field.save(name, photo(name), save=True)


# Order a case moves through; the seeded history walks it up to the case's current status.
STATUS_PATH = ["reported", "assigned", "in_progress", "rescued", "adoption", "closed"]

# Organization notes posted on the open demo cases (by case title).
CASE_NOTES = {
    "Injured Dog — G-11": ["Our volunteer is heading to G-11 Markaz with a carrier and first-aid kit."],
    "Injured Dog — F-10": [
        "Team reached F-10 park. He's nervous, so we're giving him a few minutes before moving him.",
        "He let us close in. Leg looks sprained, not broken. Taking him to the clinic now.",
    ],
}


def health_for(data):
    """Health tag for a demo animal, consistent with its status and medical notes."""
    if data["status"] in (Animal.STATUS_ADOPTABLE, Animal.STATUS_ADOPTED):
        return "healthy"
    if data["status"] == Animal.STATUS_RECOVERING:
        return "under_treatment"
    return "minor_issues"


def backdate(instance, **ago):
    type(instance).objects.filter(pk=instance.pk).update(created_at=timezone.now() - timedelta(**ago))


ORGANIZATIONS = [
    {
        "key": "paws-care",
        "name": "Paws & Care Rescue",
        "city": "Islamabad",
        "address": "Street 12, F-7/2, Islamabad",
        "latitude": 33.7215,
        "longitude": 73.0560,
        "radius": 15,
        "capacity": 25,
        "phone": "+92 300 0000101",
        "description": "Volunteer-run rescue for injured and abandoned street animals across central Islamabad.",
        "image": "16_s2_paws_and_care_rescue_logo.jpg",
        "bank_name": "Meezan Bank",
        "bank_account_number": "0101-0000000101",
        "is_verified": True,
        "tax_id": "ICT-8841",
    },
    {
        "key": "safe-haven",
        "name": "Safe Haven Rescue",
        "city": "Islamabad",
        "address": "Plot 4, G-11 Markaz, Islamabad",
        "latitude": 33.6687,
        "longitude": 72.9980,
        "radius": 12,
        "capacity": 18,
        "phone": "+92 300 0000202",
        "description": "Emergency pick-ups and recovery care for strays in the G and I sectors.",
        "image": "26_s3_a_compassionate_volunteer_rescuer_in_high.jpg",
        "bank_name": "HBL",
        "bank_account_number": "0202-0000000202",
        "is_verified": True,
        "tax_id": "ICT-9120",
    },
    {
        "key": "hope-shelter",
        "name": "Hope Animal Shelter",
        "city": "Rawalpindi",
        "address": "Adamjee Road, Saddar, Rawalpindi",
        "latitude": 33.5973,
        "longitude": 73.0479,
        "radius": 15,
        "capacity": 30,
        "phone": "+92 300 0000303",
        "description": "Shelter, vaccination and adoption programme serving Rawalpindi.",
        "image": "30_s3_a_serene_sanctuary_courtyard_where_several.jpg",
        "bank_name": "Bank Alfalah",
        "bank_account_number": "0303-0000000303",
    },
    {
        "key": "margalla-welfare",
        "name": "Margalla Animal Welfare",
        "city": "Islamabad",
        "address": "Service Road, E-11/3, Islamabad",
        "latitude": 33.6996,
        "longitude": 72.9768,
        "radius": 10,
        "capacity": 12,
        "phone": "+92 300 0000404",
        "description": "Small clinic focused on kittens and cats needing medical care.",
        "image": "29_s3_animal_welfare_clinic_veterinary_staff_caring.jpg",
        "bank_name": "UBL",
        "bank_account_number": "0404-0000000404",
    },
]

REPORTERS = [
    ("ali.raza", "Ali", "Raza"),
    ("sara.ahmed", "Sara", "Ahmed"),
    ("fatima.khan", "Fatima", "Khan"),
    ("usman.tariq", "Usman", "Tariq"),
    ("hina.malik", "Hina", "Malik"),
    ("bilal.hussain", "Bilal", "Hussain"),
    ("zainab.qureshi", "Zainab", "Qureshi"),
    ("hamza.iqbal", "Hamza", "Iqbal"),
]

# Open cases shown in "Trending Rescue Cases". Extra reporters are within 15 ft of the first report,
# matching how the app merges nearby reports into one case.
OPEN_CASES = [
    {
        "title": "Injured Dog — G-11",
        "species": "dog",
        "area": "G-11",
        "severity": "high",
        "status": "assigned",
        "organization": "safe-haven",
        "latitude": 33.66912,
        "longitude": 72.99645,
        "image": "01_s10_injured_dog_sitting_calmly_awaiting_medical.jpg",
        "reporters": ["sara.ahmed", "usman.tariq", "hina.malik"],
        "description": "Dog with an injured front leg resting by the curb near G-11 Markaz. Can't put weight on the leg.",
        "minutes_ago": 12,
    },
    {
        "title": "Abandoned Cat — F-8",
        "species": "cat",
        "area": "F-8",
        "severity": "medium",
        "status": "reported",
        "organization": None,
        "latitude": 33.70985,
        "longitude": 73.03712,
        "image": "32_s3_young_abandoned_grey_tabby_cat_nestled.jpg",
        "reporters": ["ali.raza"],
        "description": "Young grey tabby left in a cardboard box on a residential street in F-8/3. Seems hungry.",
        "minutes_ago": 34,
    },
    {
        "title": "Injured Dog — F-10",
        "species": "dog",
        "area": "F-10",
        "severity": "medium",
        "status": "in_progress",
        "organization": "paws-care",
        "latitude": 33.69511,
        "longitude": 73.01564,
        "image": "21_s24_a_portrait_shot_of_an_injured.jpg",
        "reporters": ["zainab.qureshi", "bilal.hussain"],
        "description": "Light brown street dog lying on the grass in F-10 park, limping and keeping away from people.",
        "minutes_ago": 95,
    },
]

# Rescued animals. Animal status drives the case status: recovering -> rescued, adoptable -> adoption,
# adopted -> closed. Each one gets a community post.
ANIMALS = [
    {
        "name": "Sunny",
        "species": "Dog",
        "breed": "Golden Retriever mix",
        "gender": "Female",
        "age": 3,
        "color": "Golden",
        "status": Animal.STATUS_RECOVERING,
        "organization": "paws-care",
        "area": "F-7",
        "latitude": 33.72083,
        "longitude": 73.05502,
        "reporter": "fatima.khan",
        "image": "17_s2_rescued_golden_dog.jpg",
        "description": "Gentle girl found wandering near F-7 Markaz with a skin infection.",
        "medical_info": "On antibiotics for a skin infection; first vaccination done.",
        "post": "Found this sweet girl near F-7 today. She's safe now and getting medical care. ❤️",
        "post_category": Post.CATEGORY_MEDICAL,
        "hours_ago": 2,
        "likes": 7,
        "comments": ["She looks so happy already!", "Thank you for helping her 🙏", "Get well soon Sunny"],
    },
    {
        "name": "Luna",
        "species": "Cat",
        "breed": "Domestic Longhair",
        "gender": "Female",
        "age": 2,
        "color": "Grey and white",
        "status": Animal.STATUS_ADOPTABLE,
        "organization": "paws-care",
        "area": "G-9",
        "latitude": 33.68790,
        "longitude": 73.03120,
        "reporter": "ali.raza",
        "image": "04_s13_close_up_portrait_of_an_adorable.jpg",
        "description": "Calm, affectionate cat rescued from a construction site. Loves quiet homes.",
        "medical_info": "Healthy, vaccinated and spayed.",
        "post": "Luna is fully recovered and ready for her forever home. She loves sunny windows and gentle cuddles.",
        "post_category": Post.CATEGORY_ADOPTION,
        "hours_ago": 9,
        "likes": 6,
        "comments": ["She's beautiful!", "Is she good with other cats?"],
    },
    {
        "name": "Max",
        "species": "Dog",
        "breed": "Mixed breed",
        "gender": "Male",
        "age": 4,
        "color": "Golden brown",
        "status": Animal.STATUS_ADOPTABLE,
        "organization": "hope-shelter",
        "area": "Saddar",
        "latitude": 33.59810,
        "longitude": 73.04650,
        "reporter": "hamza.iqbal",
        "image": "09_s16_close_up_portrait_of_an_adorable.jpg",
        "description": "Scruffy, friendly dog who follows volunteers everywhere.",
        "medical_info": "Vaccinated and dewormed. Recovered from a leg fracture.",
        "post": "Max made a full recovery from his leg fracture. Looking for a family with a yard to run in!",
        "post_category": Post.CATEGORY_ADOPTION,
        "hours_ago": 20,
        "likes": 5,
        "comments": ["What a happy boy", "Sharing this with my cousin in Rawalpindi!"],
    },
    {
        "name": "Milo",
        "species": "Dog",
        "breed": "Mixed breed",
        "gender": "Male",
        "age": 3,
        "color": "Brown",
        "status": Animal.STATUS_RECOVERING,
        "organization": "safe-haven",
        "area": "I-8",
        "latitude": 33.66820,
        "longitude": 73.07490,
        "reporter": "usman.tariq",
        "image": "05_s15_milo_rescue_dog.jpg",
        "description": "Brought in after a road accident in I-8. Very brave through treatment.",
        "medical_info": "Stitches on the hind leg; check-up every three days.",
        "post": "Milo's stitches are healing well. Thank you to everyone who reported him in I-8.",
        "post_category": Post.CATEGORY_MEDICAL,
        "hours_ago": 30,
        "likes": 4,
        "comments": ["So glad he made it"],
    },
    {
        "name": "Buddy",
        "species": "Dog",
        "breed": "Mixed breed",
        "gender": "Male",
        "age": 1,
        "color": "Tan",
        "status": Animal.STATUS_RECOVERING,
        "organization": "paws-care",
        "area": "F-6",
        "latitude": 33.72910,
        "longitude": 73.07580,
        "reporter": "sara.ahmed",
        "image": "07_s15_buddy_rescue_puppy.jpg",
        "description": "Playful puppy found alone near a drain in F-6.",
        "medical_info": "Treated for dehydration; first round of vaccines done.",
        "post": "Little Buddy is eating well and has started playing again. Sponsors can help cover his vaccines.",
        "post_category": Post.CATEGORY_SPONSORSHIP,
        "hours_ago": 44,
        "likes": 3,
        "comments": [],
    },
    {
        "name": "Coco",
        "species": "Cat",
        "breed": "Tabby",
        "gender": "Female",
        "age": 1,
        "color": "Brown tabby",
        "status": Animal.STATUS_RECOVERING,
        "organization": "margalla-welfare",
        "area": "E-11",
        "latitude": 33.70010,
        "longitude": 72.97590,
        "reporter": "zainab.qureshi",
        "image": "19_s22_rescued_kitten_resting_safely_in_shelter.jpg",
        "description": "Tiny kitten rescued from heavy rain in E-11.",
        "medical_info": "Kept warm and bottle-fed; gaining weight steadily.",
        "post": "This little one was rescued from the rain last night and is now warm and safe. 🐾",
        "post_category": Post.CATEGORY_MEDICAL,
        "hours_ago": 60,
        "likes": 8,
        "comments": ["Poor baby, thank you!", "So tiny 🥺"],
    },
    {
        "name": "Pumpkin",
        "species": "Cat",
        "breed": "Calico",
        "gender": "Female",
        "age": 1,
        "color": "Calico",
        "status": Animal.STATUS_ADOPTABLE,
        "organization": "margalla-welfare",
        "area": "E-11",
        "latitude": 33.69870,
        "longitude": 72.97710,
        "reporter": "hina.malik",
        "image": "28_s3_a_close_up_portrait_of_an.jpg",
        "description": "Curious calico kitten who loves toys and attention.",
        "medical_info": "Vaccinated; ready to be spayed at six months.",
        "post": "Pumpkin is ready for adoption! She's curious, playful and gets along with other cats.",
        "post_category": Post.CATEGORY_ADOPTION,
        "hours_ago": 80,
        "likes": 5,
        "comments": ["Adorable!"],
    },
    {
        "name": "Bella",
        "species": "Dog",
        "breed": "Mixed breed",
        "gender": "Female",
        "age": 5,
        "color": "Black and tan",
        "status": Animal.STATUS_ADOPTED,
        "organization": "hope-shelter",
        "area": "Satellite Town",
        "latitude": 33.63910,
        "longitude": 73.06720,
        "reporter": "bilal.hussain",
        "image": "08_s15_bella_rescue_dog.jpg",
        "description": "Senior dog rescued from Satellite Town, now adopted by a loving family.",
        "medical_info": "Healthy and vaccinated.",
        "post": "Happy ending! Bella went home with her new family today. Thank you for all the support. 💚",
        "post_category": Post.CATEGORY_FOSTER,
        "hours_ago": 120,
        "likes": 8,
        "comments": ["Best news today!", "Congratulations Bella!"],
    },
]

# How long each animal has been in care, when it's longer than its latest post suggests
# (the extra posts below sit in between).
IN_CARE_DAYS = {"Luna": 21, "Max": 12, "Milo": 8, "Buddy": 6, "Pumpkin": 20, "Bella": 30}

# Earlier posts about the same animal, for the photo grid on its profile (Stitch 13):
# (photo, caption, category, hours ago). All after the animal arrived.
EXTRA_POSTS = {
    "Sunny": [("18_s21_rescued_street_dog_in_golden_sunlight.jpg", "Sunny enjoying the sunshine after her check-up. So gentle with everyone.", Post.CATEGORY_MEDICAL, 1)],
    "Luna": [
        ("23_s24_a_close_up_portrait_of_luna.jpg", "Almost ready! Luna has her vaccinations and loves her sofa spot.", Post.CATEGORY_MEDICAL, 6 * 24),
    ],
    "Max": [("33_s7_rescue_animal_dog_looking_at_camera.jpg", "Morning sunshine for Max. He's waiting for his family.", Post.CATEGORY_ADOPTION, 5)],
    "Milo": [("00_s1_rescued_golden_retriever_dog.jpg", "Milo found the comfiest cushion in the shelter.", Post.CATEGORY_MEDICAL, 10)],
    "Coco": [
        ("20_s23_close_up_portrait_of_a_vulnerable.jpg", "Coco is warm, dry and finally purring.", Post.CATEGORY_MEDICAL, 40),
        ("25_s24_a_small_calico_kitten_playing_safely.jpg", "Playtime with our volunteer. Coco is getting braver every day.", Post.CATEGORY_MEDICAL, 20),
    ],
}

# How many sponsors each animal's organization is looking for ("18 / 50", Stitch 16).
SPONSOR_GOALS = {"Sunny": 10, "Luna": 6, "Max": 8, "Milo": 10, "Buddy": 12, "Coco": 8, "Pumpkin": 5, "Bella": 5}
# What each animal's care costs, in PKR (treatment, food and shelter until adoption).
FUNDING_GOALS = {"Sunny": 30000, "Luna": 15000, "Max": 20000, "Milo": 25000, "Buddy": 18000, "Coco": 12000, "Pumpkin": 10000, "Bella": 8000}

# The account to demo My Applications, Messages and Notifications with (Stitch 15, 18-20).
SHOWCASE = "sara.ahmed"
# (animal, status, hours ago applied, hours ago decided). Each status once, like the design.
SHOWCASE_APPLICATIONS = [
    ("Max", "pending", 18, None),
    ("Luna", "approved", 8, 1),
    ("Pumpkin", "rejected", 70, 26),
    ("Bella", "withdrawn", 10 * 24, 7 * 24),
]

# Chats, oldest message first: (who, minutes ago, text, photo). "member" is the person.
CHATS = [
    {
        "member": SHOWCASE, "organization": "safe-haven", "case": "Injured Dog — G-11", "member_read": 10,
        "messages": [
            ("org", 11, "We've accepted your report. Our volunteer is heading to G-11 Markaz with a carrier and first-aid kit.", None),
            ("member", 10, "Thank you so much! Please keep me updated. He seemed thirsty and can't put weight on his front leg.", None),
            ("org", 6, "Noted! We're bringing water, a splint and a soft carrier crate. We'll share a photo when we reach him.", None),
            ("org", 2, "Team reached G-11 Markaz and found him resting by the curb. He's calm, so we're starting first aid now.",
             "01_s10_injured_dog_sitting_calmly_awaiting_medical.jpg"),
        ],
    },
    {
        "member": SHOWCASE, "organization": "paws-care", "animal": "Luna", "member_read": 7 * 60 + 30,
        "messages": [
            ("member", 8 * 60, "Hi! I've just applied to adopt Luna. Is she okay around children?", None),
            ("org", 7 * 60 + 40, "Hi Sara! Luna is very gentle and has met our volunteers' kids. We'll review your application today.", None),
            ("org", 60, "Good news: your application for Luna is approved! 🎉 When would you like to come and meet her?", None),
        ],
    },
    {
        "member": SHOWCASE, "organization": "hope-shelter", "member_read": 25 * 60,
        "messages": [
            ("member", 26 * 60, "Do you need volunteers on weekends? I'm free on Saturdays.", None),
            ("org", 25 * 60 + 30, "We'd love that! Saturdays 10am to 2pm at our Saddar shelter. Bring a friend if you like.", None),
            ("member", 25 * 60, "Perfect, see you this Saturday!", None),
        ],
    },
    {
        "member": SHOWCASE, "organization": "margalla-welfare", "animal": "Pumpkin", "member_read": 5 * 60,
        "messages": [
            ("org", 26 * 60, "Thank you for applying for Pumpkin. She's going to a family that already has cats, as she needs a feline friend.", None),
            ("member", 5 * 60, "I understand, thank you! Please let me know when Coco is ready for adoption.", None),
        ],
    },
    {
        "member": "zainab.qureshi", "organization": "paws-care", "case": "Injured Dog — F-10", "member_read": 25,
        "messages": [
            ("member", 90, "I reported the dog in F-10 park. He's limping and scared of people.", None),
            ("org", 80, "Thanks Zainab, our team is on the way. We'll go slowly so he doesn't run.", None),
            ("org", 25, "He let us close in. The leg looks sprained, not broken. Taking him to the clinic now.", None),
        ],
    },
]

# Stories about one animal (Stitch 21): caption of the story -> (animal, headline).
STORY_ANIMALS = {
    "Rescue is not just about saving lives, it's about giving them a future. ❤️": ("Sunny", "Sunny took her first walk around the shelter today!"),
    "Pumpkin is waiting for you. 🧡": ("Pumpkin", "Ready for a forever home"),
    "Luna and friends are ready for adoption.": ("Luna", "Meet Luna and her friends"),
}

# The showcase account's profile (profile screen).
SHOWCASE_PROFILE = {
    "area": "G-11, Islamabad",
    "phone": "+92 300 5550199",
    "field_ready": True,
    "radius_alerts": True,
    "alert_latitude": 33.6687,
    "alert_longitude": 72.9980,
}

# What the organization answers under the first comment on each of its posts, and the note it
# pins on some posts (Stitch 22-23).
ORG_REPLIES = ["Thank you so much! 💚", "We'll share an update soon.", "Thank you for looking out for animals!"]
PINNED_NOTES = {
    "Luna": "Adoption applications for Luna are open in the app. Visits are on weekends from 10am to 4pm at our F-7 shelter. 🐾",
    "Coco": "Coco is warm and eating well. Kitten food and fleece blankets can be dropped at our E-11 clinic daily, 10am to 6pm.",
}
SHOWCASE_COMMENTS = {
    "Luna": "Applied to adopt Luna today, she looks so gentle! 🥰",
    "Coco": "So glad Coco is out of the rain. Sending a blanket this week.",
    "Max": "Max's smile! Happy to keep sponsoring him. 💚",
}

# Monthly medical-supply goal and this month's confirmed gifts (organization profile):
# org key -> (goal, [(reporter, amount)]).
SHELTER_FUNDS = {
    "paws-care": (200000, [("ali.raza", 5000), ("hina.malik", 2500), ("sara.ahmed", 1000)]),
    "safe-haven": (150000, [("usman.tariq", 3000), ("fatima.khan", 1500)]),
    "hope-shelter": (120000, [("bilal.hussain", 2000), ("zainab.qureshi", 1000)]),
    "margalla-welfare": (80000, [("hamza.iqbal", 2500)]),
}

CASE_STATUS_FOR_ANIMAL = {
    Animal.STATUS_RESCUED: "rescued",
    Animal.STATUS_RECOVERING: "rescued",
    Animal.STATUS_ADOPTABLE: "adoption",
    Animal.STATUS_ADOPTED: "closed",
}

STORIES = [
    ("paws-care", "rescue_update", "18_s21_rescued_street_dog_in_golden_sunlight.jpg",
     "Rescue is not just about saving lives, it's about giving them a future. ❤️", 2),
    ("safe-haven", "rescue_update", "11_s2_rescue_updates.jpg", "On our way to a call in G-11 right now.", 5),
    ("hope-shelter", "happy_ending", "27_s3_a_joyful_smiling_family_outdoors_in.jpg",
     "Rocky's first weekend with his new family!", 3),
    ("paws-care", "happy_ending", "12_s2_happy_endings.jpg", "Another happy ending this week.", 14),
    ("margalla-welfare", "adoption", "28_s3_a_close_up_portrait_of_an.jpg", "Pumpkin is waiting for you. 🧡", 4),
    ("paws-care", "adoption", "13_s2_adoption.jpg", "Luna and friends are ready for adoption.", 10),
    ("margalla-welfare", "behind_the_scenes", "29_s3_animal_welfare_clinic_veterinary_staff_caring.jpg",
     "Morning check-ups at the clinic.", 6),
    ("safe-haven", "behind_the_scenes", "14_s2_behind_the_rescue.jpg", "Our volunteers after a long night shift.", 18),
    ("hope-shelter", "sanctuary", "30_s3_a_serene_sanctuary_courtyard_where_several.jpg",
     "Playtime in the courtyard.", 8),
]


class Command(BaseCommand):
    help = "Create fake but consistent StrayAid demo data for Islamabad and Rawalpindi."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help=f"Delete all {DEMO_DOMAIN} demo accounts (and everything they own) before seeding.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if options["reset"]:
            deleted, _ = User.objects.filter(email__endswith=DEMO_DOMAIN).exclude(is_superuser=True).delete()
            self.stdout.write(self.style.WARNING(f"Reset: removed {deleted} demo records."))

        self.seed_admin()
        organizations = self.seed_organizations()
        reporters = self.seed_reporters()
        self.seed_open_cases(organizations, reporters)
        posts = self.seed_animals_and_posts(organizations, reporters)
        self.seed_case_history()
        self.seed_engagement(posts, reporters)
        self.seed_adoptions_and_sponsorships(reporters)
        self.seed_stories(organizations)
        self.seed_shelter_funds(organizations, reporters)
        self.seed_chats(organizations, reporters)
        # Last: seeding changes statuses, which fires notifications of its own.
        self.seed_notifications(organizations, reporters)

        self.stdout.write(self.style.SUCCESS("Demo data ready."))
        self.stdout.write(f"Password for every demo account: {DEMO_PASSWORD}")
        self.stdout.write("Reporters: " + ", ".join(f"{username}{DEMO_DOMAIN}" for username, _, _ in REPORTERS))
        self.stdout.write("Organizations: " + ", ".join(f"{org['key']}{DEMO_DOMAIN}" for org in ORGANIZATIONS))
        self.stdout.write(f"Applications, messages and notifications to demo: {SHOWCASE}{DEMO_DOMAIN}")

    def seed_admin(self):
        admin, _ = User.objects.get_or_create(
            email=f"admin{DEMO_DOMAIN}",
            defaults={"username": "admin", "role": "admin", "is_staff": True, "is_superuser": True},
        )
        admin.set_password("admin12345")
        admin.save()

    def seed_organizations(self):
        organizations = {}
        for data in ORGANIZATIONS:
            user, _ = User.objects.get_or_create(
                email=f"{data['key']}{DEMO_DOMAIN}",
                defaults={"username": data["key"].replace("-", "_"), "role": "organization"},
            )
            user.role = "organization"
            user.set_password(DEMO_PASSWORD)
            user.save()
            organization, _ = Organization.objects.update_or_create(
                user=user,
                defaults={
                    "name": data["name"],
                    "type": "rescue",
                    "email": user.email,
                    "phone": data["phone"],
                    "address": data["address"],
                    "city": data["city"],
                    "latitude": data["latitude"],
                    "longitude": data["longitude"],
                    "radius": data["radius"],
                    "capacity": data["capacity"],
                    "is_available": True,
                    "description": data["description"],
                    "bank_name": data["bank_name"],
                    "bank_account_title": data["name"],
                    "bank_account_number": data["bank_account_number"],
                    # Two demo shelters have been checked and verified; the others are newer.
                    "is_verified": data.get("is_verified", False),
                    "tax_id": data.get("tax_id", ""),
                },
            )
            attach_photo(organization, "image", data["image"])
            organizations[data["key"]] = organization
        return organizations

    def seed_reporters(self):
        reporters = {}
        for username, first_name, last_name in REPORTERS:
            user, _ = User.objects.get_or_create(
                email=f"{username}{DEMO_DOMAIN}",
                defaults={"username": username.replace(".", "_"), "first_name": first_name, "last_name": last_name},
            )
            user.set_password(DEMO_PASSWORD)
            user.save()
            reporters[username] = user
        return reporters

    def seed_open_cases(self, organizations, reporters):
        for data in OPEN_CASES:
            first_reporter = reporters[data["reporters"][0]]
            organization = organizations.get(data["organization"]) if data["organization"] else None
            case, _ = Case.objects.update_or_create(
                title=data["title"],
                reported_by=first_reporter,
                defaults={
                    "description": data["description"],
                    "species": data["species"],
                    "area": data["area"],
                    "severity": data["severity"],
                    "status": data["status"],
                    "organization": organization,
                    "assigned_to": organization.user if organization else None,
                    "latitude": data["latitude"],
                    "longitude": data["longitude"],
                },
            )
            for index, username in enumerate(data["reporters"]):
                # Follow-up reports sit a few feet from the first one (well inside the 15 ft merge radius).
                report, _ = Report.objects.get_or_create(
                    case=case,
                    user=reporters[username],
                    defaults={
                        "description": data["description"],
                        "latitude": data["latitude"] + index * 0.00001,
                        "longitude": data["longitude"],
                        "severity": data["severity"],
                    },
                )
                attach_photo(report, "image", data["image"])
                score_report(report)
                backdate(report, minutes=data["minutes_ago"] - index * 3)
            # AI confidence from the real detector on the demo photos (spec section 4).
            refresh_case_score(case)
            backdate(case, minutes=data["minutes_ago"])

    def seed_case_history(self):
        """Rebuild every demo case's "Case Updates": one entry per status step it has been
        through, spread between the report and now, plus organization notes on open cases."""
        now = timezone.now()
        for case in Case.objects.filter(reported_by__email__endswith=DEMO_DOMAIN).select_related("organization"):
            case.updates.all().delete()
            steps = STATUS_PATH[: STATUS_PATH.index(case.status) + 1] if case.status in STATUS_PATH else ["reported"]
            notes = CASE_NOTES.get(case.title, []) if case.organization_id else []
            entries = [(status, None) for status in steps] + [(None, note) for note in notes]
            gap = (now - case.created_at) / (len(entries) + 1)
            organization = case.organization.name if case.organization_id else "A rescue organization"
            for index, (status, note) in enumerate(entries):
                CaseUpdate.objects.create(
                    case=case,
                    status=status or "",
                    message=note or STATUS_MESSAGES[status].format(organization=organization),
                    author=case.organization.user if note else None,
                    # The report is the first entry; later ones follow at even gaps.
                    created_at=case.created_at + gap * index,
                )

    def seed_animals_and_posts(self, organizations, reporters):
        posts = []
        for data in ANIMALS:
            organization = organizations[data["organization"]]
            reporter = reporters[data["reporter"]]
            case, _ = Case.objects.update_or_create(
                title=f"{data['species']} — {data['area']}",
                reported_by=reporter,
                defaults={
                    "description": data["description"],
                    "species": data["species"].lower(),
                    "area": data["area"],
                    "severity": "medium",
                    "status": CASE_STATUS_FOR_ANIMAL[data["status"]],
                    "organization": organization,
                    "assigned_to": organization.user,
                    "latitude": data["latitude"],
                    "longitude": data["longitude"],
                    "resolved_at": timezone.now() if data["status"] == Animal.STATUS_ADOPTED else None,
                },
            )
            report, _ = Report.objects.get_or_create(
                case=case,
                user=reporter,
                defaults={
                    "description": data["description"],
                    "latitude": data["latitude"],
                    "longitude": data["longitude"],
                    "severity": "medium",
                },
            )
            attach_photo(report, "image", data["image"])
            score_report(report)
            refresh_case_score(case)
            # The rescue happened shortly before the first update was posted, or days earlier
            # for animals that have been in care a while.
            rescued_hours = max(data["hours_ago"] + 2, IN_CARE_DAYS.get(data["name"], 0) * 24)
            backdate(case, hours=rescued_hours)
            backdate(report, hours=rescued_hours)

            animal, _ = Animal.objects.update_or_create(
                case=case,
                defaults={
                    "organization": organization,
                    "name": data["name"],
                    "species": data["species"],
                    "breed": data["breed"],
                    "gender": data["gender"],
                    "age": data["age"],
                    "color": data["color"],
                    "status": data["status"],
                    "description": data["description"],
                    "medical_info": data["medical_info"],
                    "health": health_for(data),
                    "vaccinated": "vaccinat" in data["medical_info"].lower(),
                    "donation_info": f"Support {data['name']}'s care through {organization.name}.",
                    "sponsor_goal": SPONSOR_GOALS.get(data["name"], 10),
                    "funding_goal_pkr": FUNDING_GOALS.get(data["name"], 15000),
                },
            )
            attach_photo(animal, "image", data["image"])
            backdate(animal, hours=rescued_hours - 1)

            post, _ = Post.objects.update_or_create(
                animal=animal,
                organization=organization,
                title=f"Update on {data['name']}",
                defaults={
                    "content": data["post"],
                    "category": data["post_category"],
                },
            )
            attach_photo(post, "image", data["image"])
            backdate(post, hours=data["hours_ago"])
            posts.append((post, data))

            kept = [post.id]
            for image, caption, category, hours_ago in EXTRA_POSTS.get(data["name"], []):
                extra, _ = Post.objects.update_or_create(
                    animal=animal,
                    organization=organization,
                    title=f"{data['name']}: {caption[:60]}",
                    defaults={"content": caption, "category": category},
                )
                attach_photo(extra, "image", image)
                backdate(extra, hours=hours_ago)
                kept.append(extra.id)
            # Extra posts dropped from the list above are removed on the next run.
            Post.objects.filter(animal=animal, title__startswith=f"{data['name']}: ").exclude(id__in=kept).delete()
        return posts

    def seed_adoptions_and_sponsorships(self, reporters):
        """Adoption applications only for animals that can be (or were) adopted, and pledges
        for animals still in care, so the profile counts on Stitch 13 are believable."""
        people = [reporters[username] for username, _, _ in REPORTERS]
        homes = ["apartment", "house", "house", "other"]
        amounts = [500, 1000, 2000, 1500]
        animals = Animal.objects.filter(organization__user__email__endswith=DEMO_DOMAIN).order_by("name")
        for index, animal in enumerate(animals):
            reporter_id = animal.case.reported_by_id
            # A different set of people for each animal, never the person who reported it.
            candidates = [person for person in people[index:] + people[:index] if person.id != reporter_id]

            if animal.status == Animal.STATUS_ADOPTABLE:
                applicants = candidates[: 2 + index % 2]
            elif animal.status == Animal.STATUS_ADOPTED:
                applicants = candidates[:1]
            else:
                applicants = []
            scripted = {name for name, _, _, _ in SHOWCASE_APPLICATIONS}
            if animal.name in scripted:
                applicants = [person for person in applicants if person.email != f"{SHOWCASE}{DEMO_DOMAIN}"]
            for offset, person in enumerate(applicants):
                application, _ = AdoptionApplication.objects.update_or_create(
                    animal=animal,
                    applicant=person,
                    defaults={
                        "full_name": person.get_full_name() or person.username,
                        "phone": f"+92 300 55{index:02d}{offset:03d}",
                        "home_type": homes[(index + offset) % len(homes)],
                        "has_other_pets": (index + offset) % 3 == 0,
                        "city": animal.organization.city or "Islamabad",
                        "ownership": "own" if (index + offset) % 2 else "rent",
                        "landlord_allows_pets": None if (index + offset) % 2 else True,
                        "household_size": 2 + (index + offset) % 4,
                        "has_children": (index + offset) % 2 == 0,
                        "hours_alone": [2, 4, 6][(index + offset) % 3],
                        "experience": ["first_time", "some", "experienced"][(index + offset) % 3],
                        "reason": f"We've followed {animal.name}'s recovery and have a calm home with time to care for a "
                        f"{animal.species.lower()}. We'd love to give {animal.name} a forever family.",
                        "care_plan": "Family members look after pets when we travel.",
                        "agrees_home_visit": True,
                        "agrees_return_policy": True,
                        "status": "approved" if animal.status == Animal.STATUS_ADOPTED else "pending",
                        # Bella went home five days ago (her last post).
                        "decided_at": timezone.now() - timedelta(hours=121) if animal.status == Animal.STATUS_ADOPTED else None,
                    },
                )
                # Sent a few hours apart after the animal was put up for adoption, or days
                # before the adoption for animals already adopted.
                backdate(application, hours=(192 if animal.status == Animal.STATUS_ADOPTED else 3) + 5 * offset)

            if animal.status != Animal.STATUS_ADOPTED:
                sponsors = candidates[-(1 + index % 3):]
                for offset, person in enumerate(sponsors):
                    pledge, _ = Sponsorship.objects.update_or_create(
                        animal=animal,
                        sponsor=person,
                        defaults={
                            "amount_pkr": amounts[(index + offset) % len(amounts)],
                            "monthly": offset % 2 == 0,
                            # The newest pledge waits for the organization to check the receipt.
                            "status": "pending" if offset == len(sponsors) - 1 and len(sponsors) > 1 else "confirmed",
                        },
                    )
                    # Pledged on different days; the pending one came in today.
                    # Never before the animal arrived.
                    pending = pledge.status == "pending"
                    in_care_hours = (timezone.now() - animal.created_at).total_seconds() / 3600
                    hours = 3 if pending else 24 * (2 + (index * 7 + offset * 5) % 24)
                    backdate(pledge, hours=max(min(hours, in_care_hours - 1), 0.5))

        self.seed_showcase_applications(people)
        self.seed_showcase_profile(people)

    def seed_showcase_profile(self, people):
        person = User.objects.get(email=f"{SHOWCASE}{DEMO_DOMAIN}")
        for field, value in SHOWCASE_PROFILE.items():
            setattr(person, field, value)
        person.date_joined = timezone.now() - timedelta(days=395)
        person.save()

    def seed_showcase_applications(self, people):
        """One application in each state for the showcase account, plus a confirmed monthly
        pledge for Max, so My Applications (Stitch 15) has something in every tab."""
        person = User.objects.get(email=f"{SHOWCASE}{DEMO_DOMAIN}")
        now = timezone.now()
        for name, status, applied_hours, decided_hours in SHOWCASE_APPLICATIONS:
            animal = Animal.objects.get(name=name, organization__user__email__endswith=DEMO_DOMAIN)
            application, _ = AdoptionApplication.objects.update_or_create(
                animal=animal,
                applicant=person,
                defaults={
                    "full_name": person.get_full_name(),
                    "phone": "+92 300 5550199",
                    "home_type": "house",
                    "has_other_pets": False,
                    "city": "Islamabad",
                    "ownership": "own",
                    "landlord_allows_pets": None,
                    "household_size": 4,
                    "has_children": True,
                    "hours_alone": 3,
                    "experience": "some",
                    "reason": f"Our family has wanted to adopt for a long time, and {name} seems a perfect fit for our home "
                    "and garden. We work from home most days.",
                    "care_plan": "My parents live with us and love animals.",
                    "agrees_home_visit": True,
                    "agrees_return_policy": True,
                    "status": status,
                    "decided_at": now - timedelta(hours=decided_hours) if decided_hours else None,
                },
            )
            backdate(application, hours=applied_hours)

        max_ = Animal.objects.get(name="Max", organization__user__email__endswith=DEMO_DOMAIN)
        pledge, _ = Sponsorship.objects.update_or_create(
            animal=max_, sponsor=person, defaults={"amount_pkr": 1000, "monthly": True, "status": "confirmed"}
        )
        backdate(pledge, hours=5)
        OrganizationFollow.objects.get_or_create(user=person, organization=max_.organization)

    def seed_shelter_funds(self, organizations, reporters):
        now = timezone.now()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        hours_this_month = max((now - month_start).total_seconds() / 3600, 1)
        for key, (goal, gifts) in SHELTER_FUNDS.items():
            organization = organizations[key]
            organization.supply_goal_pkr = goal
            organization.save(update_fields=["supply_goal_pkr"])
            for index, (username, amount) in enumerate(gifts):
                gift, _ = ShelterDonation.objects.update_or_create(
                    organization=organization, donor=reporters[username], defaults={"amount_pkr": amount, "status": "confirmed"}
                )
                # Spread across this month so they count towards this month's fund.
                backdate(gift, hours=hours_this_month * (index + 1) / (len(gifts) + 1))

    def seed_chats(self, organizations, reporters):
        """Conversations with the rescue teams (Stitch 18-19), timed relative to now."""
        now = timezone.now()
        for data in CHATS:
            member = reporters[data["member"]]
            organization = organizations[data["organization"]]
            case = Case.objects.get(title=data["case"], organization=organization) if data.get("case") else None
            animal = Animal.objects.get(name=data["animal"], organization=organization) if data.get("animal") else None
            conversation, _ = Conversation.objects.get_or_create(member=member, organization=organization, case=case, animal=animal)

            kept = []
            for who, minutes_ago, body, image in data["messages"]:
                sender = member if who == "member" else organization.user
                message, _ = Message.objects.update_or_create(
                    conversation=conversation, sender=sender, body=body, defaults={"created_at": now - timedelta(minutes=minutes_ago)}
                )
                if image:
                    attach_photo(message, "image", image)
                kept.append(message.id)
            conversation.messages.exclude(id__in=kept).delete()

            last = conversation.messages.order_by("-created_at").first()
            org_last = conversation.messages.filter(sender=organization.user).order_by("-created_at").first()
            conversation.created_at = conversation.messages.order_by("created_at").first().created_at
            conversation.last_message_at = last.created_at
            conversation.member_read_at = now - timedelta(minutes=data["member_read"])
            # The organization has read everything up to its own last reply.
            conversation.organization_read_at = org_last.created_at if org_last else None
            conversation.save()

    def seed_notifications(self, organizations, reporters):
        """A believable Notifications screen (Stitch 20) for the demo accounts: rebuilt each
        run, so times stay relative to now. Older entries are already read."""
        Notification.objects.filter(user__email__endswith=DEMO_DOMAIN).delete()
        now = timezone.now()

        def add(user, kind, title, body, data, minutes_ago, read=None, group_key=""):
            read = minutes_ago > 120 if read is None else read
            Notification.objects.create(
                user=user, kind=kind, title=title, body=body, data=data, group_key=group_key,
                created_at=now - timedelta(minutes=minutes_ago), read_at=now if read else None,
            )

        sara = reporters[SHOWCASE]
        g11 = Case.objects.get(title="Injured Dog — G-11")
        add(sara, "rescue", "Rescue Update", "The dog you reported has been accepted by **Safe Haven Rescue**.",
            {"type": "case_status", "case_id": g11.id, "status": "assigned"}, 11)
        for name, status, _, decided_hours in SHOWCASE_APPLICATIONS:
            if status not in ("approved", "rejected"):
                continue
            application = AdoptionApplication.objects.get(applicant=sara, animal__name=name)
            organization = application.animal.organization.name
            body = (
                f"Your application for **{name}** has been approved! 🎉 **{organization}** will call you to arrange a visit."
                if status == "approved"
                else f"Your application for **{name}** wasn't approved this time. Thank you for offering a home."
            )
            add(sara, "adoption", "Adoption", body,
                {"type": "adoption_decision", "application_id": application.id, "animal_id": application.animal_id, "status": status},
                decided_hours * 60, read=decided_hours > 1)
        pledge = Sponsorship.objects.get(sponsor=sara, animal__name="Max")
        add(sara, "sponsorship", "Sponsorship",
            f"**{pledge.animal.organization.name}** confirmed your PKR 1,000 pledge for **Max**. Thank you! 💚",
            {"type": "sponsorship", "sponsorship_id": pledge.id, "animal_id": pledge.animal_id}, 3 * 60)
        walk = Post.objects.filter(animal=pledge.animal).order_by("-created_at").first()
        add(sara, "community", "Community", f"New post from **{walk.organization.name}** about Max.",
            {"type": "new_post", "post_id": walk.id, "animal_id": walk.animal_id}, 5 * 60)
        buddy = Animal.objects.get(name="Buddy", case__reported_by=sara)
        add(sara, "rescue", "Rescue Update", f"Good news: the dog you reported has been rescued by **{buddy.organization.name}**.",
            {"type": "case_status", "case_id": buddy.case_id, "status": "rescued"}, (IN_CARE_DAYS["Buddy"] * 24 - 2) * 60)

        # One entry per chat with unread messages, on whichever side hasn't read them.
        for conversation in Conversation.objects.filter(member__email__endswith=DEMO_DOMAIN).select_related("organization", "member"):
            for viewer, label in ((conversation.member, conversation.organization.name),
                                  (conversation.organization.user, conversation.member.get_full_name())):
                if conversation.unread_for(viewer):
                    minutes = (now - conversation.last_message_at).total_seconds() / 60
                    add(viewer, "chat", "Chat", f"New message from **{label}**.",
                        {"type": "chat_message", "conversation_id": conversation.id}, minutes, read=False,
                        group_key=f"chat:{conversation.id}")

        # Organizations hear about every application still waiting for them.
        for application in AdoptionApplication.objects.filter(status="pending", animal__organization__user__email__endswith=DEMO_DOMAIN):
            minutes = (now - application.created_at).total_seconds() / 60
            add(application.animal.organization.user, "adoption", "Adoption",
                f"**{application.full_name}** wants to adopt **{application.animal.name}**.",
                {"type": "adoption_application", "application_id": application.id, "animal_id": application.animal_id}, minutes)

    def seed_engagement(self, posts, reporters):
        """Likes, comments, organization replies, pinned notes, comment likes, shares and
        saves, so the post page and comments sheet (Stitch 22-23) look lived in."""
        people = list(reporters.values())
        sara = reporters[SHOWCASE]
        for post, data in posts:
            for user in people[: data["likes"]]:
                PostLike.objects.get_or_create(post=post, user=user)
            Post.objects.filter(pk=post.pk).update(share_count=data["likes"] // 2 + len(data["comments"]))
            organization_user = post.organization.user
            for index, body in enumerate(data["comments"]):
                comment, _ = PostComment.objects.get_or_create(post=post, user=people[-1 - index], body=body, parent=None)
                backdate(comment, hours=max(data["hours_ago"] - 1 - index, 0), minutes=20)
                for liker in people[: (len(body) + index) % 5]:
                    CommentLike.objects.get_or_create(comment=comment, user=liker)
                if index == 0:
                    reply, _ = PostComment.objects.get_or_create(
                        post=post, user=organization_user, parent=comment,
                        body=ORG_REPLIES[len(data["name"]) % len(ORG_REPLIES)],
                    )
                    backdate(reply, hours=max(data["hours_ago"] - 1 - index, 0), minutes=5)
            note = PINNED_NOTES.get(data["name"])
            if note:
                pinned, _ = PostComment.objects.get_or_create(post=post, user=organization_user, body=note, parent=None)
                PostComment.objects.filter(pk=pinned.pk).update(is_pinned=True)
                backdate(pinned, hours=max(data["hours_ago"] - 1, 0), minutes=40)
            mine = SHOWCASE_COMMENTS.get(data["name"])
            if mine:
                comment, _ = PostComment.objects.get_or_create(post=post, user=sara, body=mine, parent=None)
                backdate(comment, hours=max(data["hours_ago"] - 2, 0), minutes=10)

        # Saved posts and follows for the showcase account's Activity (Stitch 24).
        for name, hours_ago in [("Luna", 7), ("Coco", 30)]:
            post = Post.objects.filter(animal__name=name, title=f"Update on {name}").first()
            if post:
                saved, _ = SavedPost.objects.get_or_create(post=post, user=sara)
                SavedPost.objects.filter(pk=saved.pk).update(created_at=timezone.now() - timedelta(hours=hours_ago))
        f10 = Case.objects.filter(title="Injured Dog — F-10").first()
        if f10:
            follow, _ = CaseFollow.objects.get_or_create(user=sara, case=f10)
            CaseFollow.objects.filter(pk=follow.pk).update(created_at=timezone.now() - timedelta(minutes=80))
        coco = Animal.objects.filter(name="Coco", organization__user__email__endswith=DEMO_DOMAIN).first()
        if coco:
            follow, _ = AnimalFollow.objects.get_or_create(user=sara, animal=coco)
            AnimalFollow.objects.filter(pk=follow.pk).update(created_at=timezone.now() - timedelta(hours=40))

    def seed_stories(self, organizations):
        for org_key, category, image, caption, hours_ago in STORIES:
            story, _ = Story.objects.get_or_create(
                organization=organizations[org_key],
                category=category,
                caption=caption,
                defaults={"image": photo(image)},
            )
            animal_name, headline = STORY_ANIMALS.get(caption, (None, ""))
            story.animal = Animal.objects.filter(name=animal_name, organization=organizations[org_key]).first() if animal_name else None
            story.headline = headline
            story.save(update_fields=["animal", "headline"])
            # Stories stay fresh: every run moves them back inside the 24-hour window.
            backdate(story, hours=hours_ago)
