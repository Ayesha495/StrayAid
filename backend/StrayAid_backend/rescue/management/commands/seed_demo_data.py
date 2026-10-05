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
from organizations.models import Organization
from posts.models import Post, PostComment, PostLike, Story
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
                    "health": health_for(data),
                    "vaccinated": "vaccinat" in data["medical_info"].lower(),
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
            for offset, person in enumerate(applicants):
                AdoptionApplication.objects.update_or_create(
                    animal=animal,
                    applicant=person,
                    defaults={
                        "full_name": person.get_full_name() or person.username,
                        "phone": f"+92 300 55{index:02d}{offset:03d}",
                        "home_type": homes[(index + offset) % len(homes)],
                        "has_other_pets": (index + offset) % 3 == 0,
                        "status": "approved" if animal.status == Animal.STATUS_ADOPTED else "pending",
                    },
                )

            if animal.status != Animal.STATUS_ADOPTED:
                sponsors = candidates[-(1 + index % 3):]
                for offset, person in enumerate(sponsors):
                    Sponsorship.objects.update_or_create(
                        animal=animal,
                        sponsor=person,
                        defaults={
                            "amount_pkr": amounts[(index + offset) % len(amounts)],
                            "monthly": offset % 2 == 0,
                            # The newest pledge waits for the organization to check the receipt.
                            "status": "pending" if offset == len(sponsors) - 1 and len(sponsors) > 1 else "confirmed",
                        },
                    )

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
