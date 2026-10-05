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
from animals.models import Animal
from organizations.models import Organization
from posts.models import Post, PostComment, PostLike, Story
from rescue.models import Case, Report
from rescue.utils.scoring import compute_confidence_score, is_possibly_invalid

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
        "detector": 0.97,
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
        "detector": 0.9,
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
        "detector": 0.88,
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
        self.seed_engagement(posts, reporters)
        self.seed_stories(organizations)

        self.stdout.write(self.style.SUCCESS("Demo data ready."))
        self.stdout.write(f"Password for every demo account: {DEMO_PASSWORD}")
        self.stdout.write("Reporters: " + ", ".join(f"{username}{DEMO_DOMAIN}" for username, _, _ in REPORTERS))
        self.stdout.write("Organizations: " + ", ".join(f"{org['key']}{DEMO_DOMAIN}" for org in ORGANIZATIONS))

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
            report_count = len(data["reporters"])
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
                    "confidence_score": compute_confidence_score(data["detector"], data["severity"], report_count),
                    "possibly_invalid": is_possibly_invalid(data["detector"]),
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
                        "ai_animal_confidence": data["detector"],
                    },
                )
                attach_photo(report, "image", data["image"])
                backdate(report, minutes=data["minutes_ago"] - index * 3)
            backdate(case, minutes=data["minutes_ago"])

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
                    "confidence_score": compute_confidence_score(0.92, "medium", 1),
                    "possibly_invalid": False,
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
                    "ai_animal_confidence": 0.92,
                },
            )
            attach_photo(report, "image", data["image"])
            # The rescue happened shortly before the first update was posted.
            backdate(case, hours=data["hours_ago"] + 2)
            backdate(report, hours=data["hours_ago"] + 2)

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
                    "donation_info": f"Support {data['name']}'s care through {organization.name}.",
                },
            )
            attach_photo(animal, "image", data["image"])
            backdate(animal, hours=data["hours_ago"] + 1)

            post, _ = Post.objects.update_or_create(
                animal=animal,
                organization=organization,
                defaults={
                    "title": f"Update on {data['name']}",
                    "content": data["post"],
                    "category": data["post_category"],
                },
            )
            attach_photo(post, "image", data["image"])
            backdate(post, hours=data["hours_ago"])
            posts.append((post, data))
        return posts

    def seed_engagement(self, posts, reporters):
        people = list(reporters.values())
        for post, data in posts:
            for user in people[: data["likes"]]:
                PostLike.objects.get_or_create(post=post, user=user)
            for index, body in enumerate(data["comments"]):
                comment, _ = PostComment.objects.get_or_create(post=post, user=people[-1 - index], body=body)
                backdate(comment, hours=max(data["hours_ago"] - 1 - index, 0), minutes=20)

    def seed_stories(self, organizations):
        for org_key, category, image, caption, hours_ago in STORIES:
            story, _ = Story.objects.get_or_create(
                organization=organizations[org_key],
                category=category,
                caption=caption,
                defaults={"image": photo(image)},
            )
            # Stories stay fresh: every run moves them back inside the 24-hour window.
            backdate(story, hours=hours_ago)
