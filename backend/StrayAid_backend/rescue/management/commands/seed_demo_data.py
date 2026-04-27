from pathlib import Path

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand

from accounts.models import User
from animals.models import Animal
from organizations.models import Organization
from posts.models import Post
from rescue.models import Case, Report


ASSET_ROOT = Path(__file__).resolve().parents[5] / "images"


def image_file(category, name):
    image_path = ASSET_ROOT / category / name
    return ContentFile(image_path.read_bytes(), name=name)


def ensure_password(user, raw_password):
    if not user.check_password(raw_password):
        user.set_password(raw_password)
        user.save(update_fields=["password"])


class Command(BaseCommand):
    help = "Create admin credentials and sample organizations, cases, reports, animals, and posts."

    def add_arguments(self, parser):
        parser.add_argument(
            "--purge-save-strays",
            action="store_true",
            help="Delete existing animals and posts linked to the legacy SaveStrays organization before seeding.",
        )

    def handle(self, *args, **options):
        if options["purge_save_strays"]:
            legacy_organizations = Organization.objects.filter(name__in=["SaveStrays", "Save Strays"])
            deleted_animals = 0
            deleted_posts = 0
            for legacy_org in legacy_organizations:
                deleted_posts += Post.objects.filter(organization=legacy_org).count()
                deleted_animals += Animal.objects.filter(organization=legacy_org).count()
                Animal.objects.filter(organization=legacy_org).delete()
                Post.objects.filter(organization=legacy_org).delete()

            self.stdout.write(
                self.style.WARNING(
                    f"Removed {deleted_animals} animal profiles and {deleted_posts} posts from legacy SaveStrays data."
                )
            )

        admin_user, admin_created = User.objects.get_or_create(
            email="admin@strayaid.local",
            defaults={
                "username": "admin",
                "role": "admin",
                "is_staff": True,
                "is_superuser": True,
            },
        )
        if admin_created:
            ensure_password(admin_user, "admin12345")
            self.stdout.write(self.style.SUCCESS("Created admin user: admin@strayaid.local / admin12345"))
        else:
            updated = False
            if not admin_user.is_staff:
                admin_user.is_staff = True
                updated = True
            if not admin_user.is_superuser:
                admin_user.is_superuser = True
                updated = True
            if admin_user.role != "admin":
                admin_user.role = "admin"
                updated = True
            if updated:
                admin_user.save(update_fields=["is_staff", "is_superuser", "role"])
            ensure_password(admin_user, "admin12345")
            self.stdout.write("Admin user already exists: admin@strayaid.local")

        rescue_user_1, _ = User.objects.get_or_create(
            email="safe-paws@strayaid.local",
            defaults={
                "username": "safepaws",
                "first_name": "Safe",
                "last_name": "Paws",
                "role": "organization",
            },
        )
        ensure_password(rescue_user_1, "org12345")

        rescue_user_2, _ = User.objects.get_or_create(
            email="second-chance@strayaid.local",
            defaults={
                "username": "secondchance",
                "first_name": "Second",
                "last_name": "Chance",
                "role": "organization",
            },
        )
        ensure_password(rescue_user_2, "org12345")

        rescue_user_3, _ = User.objects.get_or_create(
            email="city-tails@strayaid.local",
            defaults={
                "username": "citytails",
                "first_name": "City",
                "last_name": "Tails",
                "role": "organization",
            },
        )
        ensure_password(rescue_user_3, "org12345")

        public_user_1, _ = User.objects.get_or_create(
            email="ali.public@strayaid.local",
            defaults={
                "username": "ali_public",
                "first_name": "Ali",
                "last_name": "Khan",
                "role": "public",
            },
        )
        ensure_password(public_user_1, "user12345")

        public_user_2, _ = User.objects.get_or_create(
            email="sara.public@strayaid.local",
            defaults={
                "username": "sara_public",
                "first_name": "Sara",
                "last_name": "Ahmed",
                "role": "public",
            },
        )
        ensure_password(public_user_2, "user12345")

        public_user_3, _ = User.objects.get_or_create(
            email="fatima.public@strayaid.local",
            defaults={
                "username": "fatima_public",
                "first_name": "Fatima",
                "last_name": "Raza",
                "role": "public",
            },
        )
        ensure_password(public_user_3, "user12345")

        org_1, _ = Organization.objects.update_or_create(
            user=rescue_user_1,
            defaults={
                "name": "Safe Paws Rescue",
                "type": "rescue",
                "phone": "0300-1111111",
                "email": rescue_user_1.email,
                "address": "Johar Town, Lahore",
                "is_verified": True,
                "capacity": 18,
                "current_active_cases": 3,
                "city": "Lahore",
                "latitude": 31.4697,
                "longitude": 74.2728,
                "radius": 25,
                "is_available": True,
                "description": "Focused on street animal rescue, treatment, and adoption support.",
                "bank_account_title": "Safe Paws Rescue",
                "bank_account_number": "PK12SAFE000111222333",
            },
        )

        org_2, _ = Organization.objects.update_or_create(
            user=rescue_user_2,
            defaults={
                "name": "Second Chance Shelter",
                "type": "shelter",
                "phone": "0311-2222222",
                "email": rescue_user_2.email,
                "address": "F-8 Markaz, Islamabad",
                "is_verified": True,
                "capacity": 25,
                "current_active_cases": 4,
                "city": "Islamabad",
                "latitude": 33.7070,
                "longitude": 73.0489,
                "radius": 30,
                "is_available": True,
                "description": "Provides temporary shelter, recovery care, and community adoptions.",
                "bank_account_title": "Second Chance Shelter",
                "bank_account_number": "PK12CHANCE000444555666",
            },
        )

        org_3, _ = Organization.objects.update_or_create(
            user=rescue_user_3,
            defaults={
                "name": "City Tails Clinic",
                "type": "clinic",
                "phone": "0322-3333333",
                "email": rescue_user_3.email,
                "address": "Clifton Block 5, Karachi",
                "is_verified": True,
                "capacity": 14,
                "current_active_cases": 2,
                "city": "Karachi",
                "latitude": 24.8138,
                "longitude": 67.0305,
                "radius": 18,
                "is_available": True,
                "description": "Small rescue clinic focused on treatment, stabilization, and foster handoffs.",
                "bank_account_title": "City Tails Clinic",
                "bank_account_number": "PK12TAILS000777888999",
            },
        )

        org_1.image.save(
            "download.jpg",
            image_file("organizations", "download.jpg"),
            save=True,
        )
        org_2.image.save(
            "images.jpg",
            image_file("organizations", "images.jpg"),
            save=True,
        )
        org_3.image.save(
            "download (1).jpg",
            image_file("organizations", "download (1).jpg"),
            save=True,
        )

        case_1, _ = Case.objects.update_or_create(
            description="Injured brown dog spotted near a roadside food street.",
            latitude=31.4712,
            longitude=74.2683,
            defaults={
                "status": "adoption",
                "reported_by": public_user_1,
                "organization": org_1,
                "assigned_to": rescue_user_1,
            },
        )
        case_2, _ = Case.objects.update_or_create(
            description="Small white cat found dehydrated near a market parking area.",
            latitude=33.7095,
            longitude=73.0511,
            defaults={
                "status": "rescued",
                "reported_by": public_user_2,
                "organization": org_2,
                "assigned_to": rescue_user_2,
            },
        )
        case_3, _ = Case.objects.update_or_create(
            description="Puppy seen limping beside a canal road and needs pickup.",
            latitude=31.5204,
            longitude=74.3587,
            defaults={
                "status": "reported",
                "reported_by": public_user_2,
                "organization": None,
                "assigned_to": None,
            },
        )

        case_4, _ = Case.objects.update_or_create(
            description="Black kitten rescued from a drainage edge and moved into warm indoor care.",
            latitude=24.8204,
            longitude=67.0331,
            defaults={
                "status": "rescued",
                "reported_by": public_user_3,
                "organization": org_3,
                "assigned_to": rescue_user_3,
            },
        )
        case_5, _ = Case.objects.update_or_create(
            description="Senior dog recovering after treatment and now ready for calm home placement.",
            latitude=24.8074,
            longitude=67.0215,
            defaults={
                "status": "adoption",
                "reported_by": public_user_1,
                "organization": org_3,
                "assigned_to": rescue_user_3,
            },
        )
        case_6, _ = Case.objects.update_or_create(
            description="Playful young dog recently vaccinated and looking for foster-to-adopt placement.",
            latitude=33.7001,
            longitude=73.0402,
            defaults={
                "status": "adoption",
                "reported_by": public_user_3,
                "organization": org_2,
                "assigned_to": rescue_user_2,
            },
        )

        report_1, _ = Report.objects.get_or_create(
            case=case_1,
            user=public_user_1,
            description="The dog has a visible leg wound and seems frightened but approachable.",
            latitude=31.4712,
            longitude=74.2683,
        )
        report_1.image.save("4377.Rocky.jpg", image_file("reports", "4377.Rocky.jpg"), save=True)

        report_2, _ = Report.objects.get_or_create(
            case=case_2,
            user=public_user_2,
            description="The cat was hiding under a parked car and looked weak from heat.",
            latitude=33.7095,
            longitude=73.0511,
        )
        report_2.image.save("gang-cats-Alaksa.webp", image_file("reports", "gang-cats-Alaksa.webp"), save=True)

        report_3, _ = Report.objects.get_or_create(
            case=case_3,
            user=public_user_2,
            description="The puppy keeps returning to the same corner and struggles to walk.",
            latitude=31.5204,
            longitude=74.3587,
        )
        report_3.image.save("images (1).jpg", image_file("reports", "images (1).jpg"), save=True)

        report_4, _ = Report.objects.get_or_create(
            case=case_4,
            user=public_user_3,
            description="The kitten was cold, weak, and curled beside the concrete wall until picked up.",
            latitude=24.8204,
            longitude=67.0331,
        )
        report_4.image.save(
            "detail-domestic-animals-abandoned-street-260nw-2706423185.webp",
            image_file("reports", "detail-domestic-animals-abandoned-street-260nw-2706423185.webp"),
            save=True,
        )

        report_5, _ = Report.objects.get_or_create(
            case=case_5,
            user=public_user_1,
            description="This older dog is calm around people and seems comfortable indoors after treatment.",
            latitude=24.8074,
            longitude=67.0215,
        )
        report_5.image.save(
            "Banner_stray-dog-with-puppies_credit_AlRahmeh.jpg",
            image_file("reports", "Banner_stray-dog-with-puppies_credit_AlRahmeh.jpg"),
            save=True,
        )

        report_6, _ = Report.objects.get_or_create(
            case=case_6,
            user=public_user_3,
            description="The dog has good energy, friendly behavior, and seems eager to stay around people.",
            latitude=33.7001,
            longitude=73.0402,
        )
        report_6.image.save("_130505861_mediaitem130505860.jpg", image_file("reports", "_130505861_mediaitem130505860.jpg"), save=True)

        animal_1, _ = Animal.objects.update_or_create(
            case=case_1,
            defaults={
                "organization": org_1,
                "name": "Milo",
                "species": "Dog",
                "breed": "Mixed",
                "gender": "Male",
                "age": 3,
                "color": "Brown",
                "description": "Friendly adult dog recovering well and now ready for adoption.",
                "medical_info": "Leg wound cleaned, vaccinated, and under observation.",
                "donation_info": "Sponsor treatment via Safe Paws Rescue bank account.",
                "status": Animal.STATUS_ADOPTABLE,
            },
        )
        animal_1.image.save(
            "dog-hero.jpg",
            image_file("animals", "dog-hero.jpg"),
            save=True,
        )

        animal_2, _ = Animal.objects.update_or_create(
            case=case_2,
            defaults={
                "organization": org_2,
                "name": "Luna",
                "species": "Cat",
                "breed": "Domestic Shorthair",
                "gender": "Female",
                "age": 2,
                "color": "White",
                "description": "Quiet rescue cat currently recovering indoors with supervised care.",
                "medical_info": "Treated for dehydration and scheduled for follow-up checks.",
                "donation_info": "Food and treatment support can be sent to Second Chance Shelter.",
                "status": Animal.STATUS_RECOVERING,
            },
        )
        animal_2.image.save(
            "Cat-on-couch.jpg",
            image_file("animals", "Cat-on-couch.jpg"),
            save=True,
        )

        animal_3, _ = Animal.objects.update_or_create(
            case=case_4,
            defaults={
                "organization": org_3,
                "name": "Pepper",
                "species": "Cat",
                "breed": "Mixed",
                "gender": "Female",
                "age": 1,
                "color": "Black",
                "description": "Small black kitten warming up well after rescue and eating on schedule.",
                "medical_info": "Underweight at intake, now hydrated and receiving routine observation.",
                "donation_info": "Sponsor Pepper's treatment supplies through City Tails Clinic.",
                "status": Animal.STATUS_RECOVERING,
            },
        )
        animal_3.image.save(
            "8a87d092545e4d949f2d95978445aa9a.webp",
            image_file("animals", "8a87d092545e4d949f2d95978445aa9a.webp"),
            save=True,
        )

        animal_4, _ = Animal.objects.update_or_create(
            case=case_5,
            defaults={
                "organization": org_3,
                "name": "Buddy",
                "species": "Dog",
                "breed": "Mixed",
                "gender": "Male",
                "age": 8,
                "color": "Golden",
                "description": "Gentle senior dog now stable and ready for a calm adoption placement.",
                "medical_info": "Completed treatment, resting well, and cleared for adoption meetings.",
                "donation_info": "Support Buddy with food, medicine, or direct clinic donations.",
                "status": Animal.STATUS_ADOPTABLE,
            },
        )
        animal_4.image.save(
            "awsmaine_peachesDOG_0325-scaled-e1742240776863-1024x1024.jpg",
            image_file("animals", "awsmaine_peachesDOG_0325-scaled-e1742240776863-1024x1024.jpg"),
            save=True,
        )

        animal_5, _ = Animal.objects.update_or_create(
            case=case_6,
            defaults={
                "organization": org_2,
                "name": "Sunny",
                "species": "Dog",
                "breed": "Mixed",
                "gender": "Male",
                "age": 2,
                "color": "Cream",
                "description": "Playful young dog with strong recovery progress and a social personality.",
                "medical_info": "Vaccinated, active, and transitioning into adoption visibility.",
                "donation_info": "Sponsor Sunny's boarding and adoption prep through Second Chance Shelter.",
                "status": Animal.STATUS_ADOPTABLE,
            },
        )
        animal_5.image.save(
            "NationalGeographic_2572187_16x9.avif",
            image_file("animals", "NationalGeographic_2572187_16x9.avif"),
            save=True,
        )

        post_1, _ = Post.objects.update_or_create(
            organization=org_1,
            animal=animal_1,
            title="Milo is ready to meet adopters",
            defaults={
                "content": "Milo has completed his first recovery stage and is now open for adoption inquiries.",
            },
        )
        post_1.image.save(
            "Stray-dogs-India.jpg",
            image_file("posts", "Stray-dogs-India.jpg"),
            save=True,
        )

        post_2, _ = Post.objects.update_or_create(
            organization=org_2,
            animal=animal_2,
            title="Luna is responding well to treatment",
            defaults={
                "content": "Luna is eating regularly again and showing steady improvement each day.",
            },
        )
        post_2.image.save(
            "images.jpg",
            image_file("posts", "images.jpg"),
            save=True,
        )

        post_3, _ = Post.objects.update_or_create(
            organization=org_3,
            animal=animal_3,
            title="Pepper is gaining strength in foster care",
            defaults={
                "content": "Pepper is warmer, more alert, and starting to explore her recovery room with confidence.",
            },
        )
        post_3.image.save(
            "800_a0895029beforesurgery-verystenoticnostirlscatwasmostlyopenmouthbreathing..jpg",
            image_file("posts", "800_a0895029beforesurgery-verystenoticnostirlscatwasmostlyopenmouthbreathing..jpg"),
            save=True,
        )

        post_4, _ = Post.objects.update_or_create(
            organization=org_3,
            animal=animal_4,
            title="Buddy is ready for a calm forever home",
            defaults={
                "content": "Buddy has settled beautifully and is now meeting potential adopters looking for a gentle companion.",
            },
        )
        post_4.image.save(
            "BlcNf2ItMVsDsMjKkRBwu1sMt0.webp",
            image_file("posts", "BlcNf2ItMVsDsMjKkRBwu1sMt0.webp"),
            save=True,
        )

        post_5, _ = Post.objects.update_or_create(
            organization=org_2,
            animal=animal_5,
            title="Sunny has moved into adoption prep",
            defaults={
                "content": "Sunny is playful, vaccinated, and getting daily social time while the team screens adopters.",
            },
        )
        post_5.image.save(
            "VIER PFOTEN_2024-07-2820241217_0142-1041x720.jpg",
            image_file("posts", "VIER PFOTEN_2024-07-2820241217_0142-1041x720.jpg"),
            save=True,
        )

        self.stdout.write(self.style.SUCCESS("Sample data is ready."))
        self.stdout.write("Admin login: admin@strayaid.local / admin12345")
        self.stdout.write("Organization login: safe-paws@strayaid.local / org12345")
        self.stdout.write("Organization login: second-chance@strayaid.local / org12345")
        self.stdout.write("Organization login: city-tails@strayaid.local / org12345")
        self.stdout.write("Public login: ali.public@strayaid.local / user12345")
        self.stdout.write("Public login: sara.public@strayaid.local / user12345")
        self.stdout.write("Public login: fatima.public@strayaid.local / user12345")
