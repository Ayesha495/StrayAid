"""Fake but consistent demo data for StrayAid, set in Islamabad and Rawalpindi.

Run:   python manage.py seed_demo_data
Fresh: python manage.py seed_demo_data --reset   (deletes every @strayaid.local demo account first)
Ducky paws Rescue only: python manage.py seed_demo_data --only-ducky-paws
Stories only (they last 24 hours): python manage.py seed_demo_data --stories

Live server: DEMO_PASSWORD=<strong password> python manage.py seed_demo_data --production

Safe to re-run: records are matched by stable keys and photos are only attached once.
Timestamps are relative to "now", so stories stay inside their 24-hour window; re-run before a demo.
Every demo account uses the DEMO_PASSWORD environment variable (demo12345 locally).
No admin account is made: use `python manage.py createsuperuser` for that.
"""

import os
from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q
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

STITCH_IMAGES = settings.DEMO_IMAGES_DIR / "stitch"
DEMO_DOMAIN = "@strayaid.local"
LOCAL_DEMO_PASSWORD = "demo12345"


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


# ---------- Ducky paws Rescue (Kahuta) ----------
# A team registered through the app rather than by this script, so it's looked up by name and
# skipped if it doesn't exist. Everything sits inside its 4 km service area around its base, so the
# team sees the reports. Photos are real ones from images/ (not the AI-generated Stitch set).
# Follow-up posts use a closer crop of the same photo or no photo, so every picture really shows
# the animal it's about.
DUCKY_PAWS_NAME = "Ducky paws Rescue"
REAL_IMAGES = settings.DEMO_IMAGES_DIR

DUCKY_PAWS_ANIMALS = [
    {
        "name": "Rocky",
        "species": "Dog",
        "breed": "Bully mix",
        "gender": "Male",
        "age": 2,
        "color": "White",
        "status": Animal.STATUS_RESCUED,
        "area": "Kahuta Bazaar",
        "latitude": 33.59250,
        "longitude": 73.48900,
        "reporter": "hamza.iqbal",
        "severity": "high",
        "image": "reports/4377.Rocky.jpg",
        "crop": (0.18, 0.05, 0.85, 0.75),
        "days_in_care": 3,
        "funding_goal": 25000,
        "description": "Found limping behind the vegetable market in Kahuta with a deep cut on his front leg.",
        "medical_info": "Leg wound cleaned and stitched. On painkillers and antibiotics; X-ray clear.",
        "posts": [
            ("Rocky is safe", "A shopkeeper in Kahuta Bazaar called us about a limping dog. Rocky let us lift him into the van without a fuss. He's with us now.", Post.CATEGORY_MEDICAL, "full", 70),
            ("X-ray results", "Good news from the vet: no fracture. The cut on Rocky's leg needed six stitches and he's on antibiotics for a week.", Post.CATEGORY_MEDICAL, None, 46),
            ("First walk", "First slow walk around the yard today. He keeps the leg up on corners but he's wagging the whole time.", Post.CATEGORY_MEDICAL, "crop", 20),
            ("Help with Rocky's treatment", "Stitches, X-ray and two weeks of medicine come to about Rs 25,000. Any amount helps, and every receipt is shown on his page.", Post.CATEGORY_SPONSORSHIP, None, 5),
        ],
    },
    {
        "name": "Mano",
        "species": "Cat",
        "breed": "Domestic Shorthair",
        "gender": "Male",
        "age": 4,
        "color": "Grey tabby",
        "status": Animal.STATUS_RECOVERING,
        "area": "Narh Road",
        "latitude": 33.60710,
        "longitude": 73.49320,
        "reporter": "zainab.qureshi",
        "severity": "high",
        "image": "reports/Poppy-crate-2-e1652292038213.jpg",
        "crop": (0.12, 0.08, 0.88, 0.80),
        "days_in_care": 12,
        "funding_goal": 15000,
        "description": "Older tom cat with an infected wound over his eye, found sheltering under a parked truck on Narh Road.",
        "medical_info": "Eye wound treated, infection clearing. Dewormed; first vaccination due next week.",
        "posts": [
            ("Mano came in today", "This tough old boy had an infected wound right above his eye. He's been cleaned up, fed and is sleeping in a warm crate.", Post.CATEGORY_MEDICAL, "full", 12 * 24),
            ("Eye check", "The vet is happy with how Mano's eye is healing. The swelling is down and he can open it fully again.", Post.CATEGORY_MEDICAL, None, 8 * 24),
            ("Eating well", "Mano finished his whole bowl twice today and now asks for more by sitting on the food shelf.", Post.CATEGORY_MEDICAL, "crop", 3 * 24),
            ("A foster for Mano?", "Mano would heal faster somewhere quiet. If you live near Kahuta and can foster a calm cat for three weeks, message us.", Post.CATEGORY_FOSTER, None, 20),
        ],
    },
    {
        "name": "Chai",
        "species": "Dog",
        "breed": "Desi mix",
        "gender": "Female",
        "age": 1,
        "color": "Tan",
        "status": Animal.STATUS_ADOPTABLE,
        "area": "Panjar",
        "latitude": 33.57880,
        "longitude": 73.48180,
        "reporter": "ali.raza",
        "severity": "medium",
        "image": "animals/dog-hero.jpg",
        "crop": (0.45, 0.0, 1.0, 1.0),
        "days_in_care": 26,
        "funding_goal": 10000,
        "description": "Playful pup found alone by the Panjar water tank. Loves people, still learning about cats.",
        "medical_info": "Healthy, fully vaccinated and spayed.",
        "posts": [
            ("Chai was found in Panjar", "A family in Panjar spotted this pup alone by the water tank for two days. She's thin but bright and very friendly.", Post.CATEGORY_MEDICAL, "full", 26 * 24),
            ("Vaccinations done", "Chai has had all her shots and was spayed this week. She bounced back the next morning.", Post.CATEGORY_MEDICAL, None, 14 * 24),
            ("Chai is ready for a home", "Chai is ready to be adopted! She's house-trained, sits on command and would love a family with a yard.", Post.CATEGORY_ADOPTION, "crop", 2 * 24),
        ],
    },
    {
        "name": "Kali",
        "species": "Cat",
        "breed": "Domestic Shorthair",
        "gender": "Female",
        "age": 3,
        "color": "Black",
        "status": Animal.STATUS_ADOPTABLE,
        "area": "Kahuta Hill Road",
        "latitude": 33.60030,
        "longitude": 73.50490,
        "reporter": "hina.malik",
        "severity": "low",
        "image": "reports/_130505861_mediaitem130505860.jpg",
        "crop": (0.25, 0.0, 0.95, 0.95),
        "days_in_care": 31,
        "funding_goal": 8000,
        "description": "Gentle black cat rescued from a storm drain on Hill Road. Shy at first, then a lap cat.",
        "medical_info": "Healthy, vaccinated and spayed. Small scar on her nose has healed.",
        "posts": [
            ("Kali is out of the drain", "After two hours and a lot of patience, Kali is out of the storm drain on Hill Road. Wet, scared and completely fine.", Post.CATEGORY_MEDICAL, "full", 31 * 24),
            ("Kali's first purr", "It took ten days, but Kali finally purred on a volunteer's lap today. Shy cats are worth the wait.", Post.CATEGORY_MEDICAL, None, 20 * 24),
            ("Kali needs a quiet home", "Kali is ready to be adopted. She'd do best as the only pet in a calm home. Her nose scar has healed nicely.", Post.CATEGORY_ADOPTION, "crop", 4 * 24),
            ("Still waiting", "Black cats wait the longest for homes. Kali has been ready for a month. Please share her page!", Post.CATEGORY_ADOPTION, None, 10),
        ],
    },
    {
        "name": "Bholu",
        "species": "Dog",
        "breed": "Bully mix",
        "gender": "Male",
        "age": 5,
        "color": "Dark brown",
        "status": Animal.STATUS_ADOPTED,
        "area": "Kahuta Bus Stand",
        "latitude": 33.58690,
        "longitude": 73.49250,
        "reporter": "usman.tariq",
        "severity": "medium",
        "image": "animals/awsmaine_peachesDOG_0325-scaled-e1742240776863-1024x1024.jpg",
        "crop": (0.1, 0.0, 0.9, 0.8),
        "days_in_care": 48,
        "funding_goal": 12000,
        "description": "Big softie who lived around the Kahuta bus stand with a skin condition. Now adopted.",
        "medical_info": "Skin condition cleared. Vaccinated and neutered.",
        "posts": [
            ("Meet Bholu", "Bholu has lived around the Kahuta bus stand for years. His skin was in a bad way, so the drivers asked us to help.", Post.CATEGORY_MEDICAL, "full", 48 * 24),
            ("Skin is clearing", "Three weeks of medicated baths and Bholu's coat is growing back shiny. He loves bath time now. Mostly.", Post.CATEGORY_MEDICAL, None, 30 * 24),
            ("Bholu is ready", "Bholu is healthy, neutered and ready for a family. He's calm, great with kids and snores loudly.", Post.CATEGORY_ADOPTION, "crop", 15 * 24),
            ("Bholu went home!", "Bholu went home today with a family in Rawalpindi who visited him three times before deciding. Thank you to everyone who shared his story.", Post.CATEGORY_ADOPTION, "full", 3 * 24),
        ],
    },
]

# Ducky paws stories: (category, photo in images/, crop or None, caption, headline, animal, hours ago).
# Stories last 24 hours; run `seed_demo_data --stories` before a demo to bring them all back.
DUCKY_PAWS_STORIES = [
    ("rescue_update", "reports/4377.Rocky.jpg", (0.18, 0.05, 0.85, 0.75), "Rocky's stitches come out next week 🐾",
     "Rocky is walking on all four legs again", "Rocky", 1),
    ("adoption", "animals/dog-hero.jpg", (0.4, 0.0, 1.0, 1.0), "Chai is house-trained and ready for her family.",
     "Meet Chai", "Chai", 3),
    ("adoption", "reports/_130505861_mediaitem130505860.jpg", None, "Black cats wait the longest. Kali has waited a month.",
     "Kali needs a quiet home", "Kali", 7),
    ("happy_ending", "animals/awsmaine_peachesDOG_0325-scaled-e1742240776863-1024x1024.jpg", None,
     "Bholu sent us a photo from his new home in Rawalpindi! 🏡", "Bholu's first week at home", "Bholu", 5),
    ("behind_the_scenes", "organizations/images (3).jpg", None, "Evening feeding round in Kahuta.", "", None, 9),
    ("behind_the_scenes", "organizations/images.jpg", None, "Every rescue starts with trust.", "", None, 12),
    ("sanctuary", "organizations/download.jpg", None, "Clean kennels, full bowls, everyone settled for the night.", "", None, 15),
]

DUCKY_PAWS_COMMENTS = ["Poor baby, thank you for helping!", "Sharing this now 🙏", "So glad he's safe", "What a sweetheart"]

# A Kahuta reporter to demo the reporter side with: reports at every stage, an adoption
# application, a sponsorship, follows, chats and notifications, all with Ducky paws Rescue.
KAHUTA_REPORTER = {
    "key": "maryam.siddiqui",
    "first_name": "Maryam",
    "last_name": "Siddiqui",
    "area": "Main Bazaar, Kahuta",
    "phone": "+92 301 5550142",
    "alert_latitude": 33.5950,
    "alert_longitude": 73.4870,
    "joined_days": 140,
}

# Reports around Ducky paws Rescue's base, inside its 4 km service area so the team sees them.
# "reporters" are usernames; the first one opened the case, the rest reported the same spot.
DUCKY_PAWS_CASES = [
    {
        "title": "Injured Kitten — Hospital Road",
        "species": "cat",
        "area": "Hospital Road",
        "severity": "critical",
        "status": "reported",
        "assigned": False,
        "latitude": 33.59610,
        "longitude": 73.48510,
        "image": "reports/images 3.jpg",
        "reporters": ["maryam.siddiqui"],
        "description": "Tiny kitten with a badly hurt ear and eye, crying under a parked rickshaw outside the hospital gate.",
        "minutes_ago": 25,
    },
    {
        "title": "Starving Dog — Lehtrar Road",
        "species": "dog",
        "area": "Lehtrar Road",
        "severity": "high",
        "status": "reported",
        "assigned": False,
        "latitude": 33.60520,
        "longitude": 73.49750,
        "image": "reports/images (2).jpg",
        "reporters": ["hina.malik"],
        "description": "Very thin dog walking along Lehtrar Road near the petrol pump. Ribs showing, won't come close.",
        "minutes_ago": 70,
    },
    {
        "title": "Mother Dog with Puppies — Narh Mor",
        "species": "dog",
        "area": "Narh Mor",
        "severity": "medium",
        "status": "reported",
        "assigned": False,
        "latitude": 33.58240,
        "longitude": 73.47930,
        "image": "reports/Banner_stray-dog-with-puppies_credit_AlRahmeh.jpg",
        "reporters": ["bilal.hussain", "maryam.siddiqui"],
        "description": "Mother dog with three small puppies living in an empty plot at Narh Mor. She looks weak and the pups need shelter.",
        "minutes_ago": 3 * 60,
    },
    {
        "title": "Two Dogs — Bus Stand",
        "species": "dog",
        "area": "Bus Stand",
        "severity": "medium",
        "status": "assigned",
        "assigned": True,
        "latitude": 33.60120,
        "longitude": 73.47210,
        "image": "reports/images (1).jpg",
        "reporters": ["maryam.siddiqui"],
        "description": "Two dogs lying by the wall at the bus stand all day. One has a wound on its back leg.",
        "minutes_ago": 5 * 60,
    },
    {
        "title": "Street Cats — Main Bazaar",
        "species": "cat",
        "area": "Main Bazaar",
        "severity": "low",
        "status": "in_progress",
        "assigned": True,
        "latitude": 33.58800,
        "longitude": 73.50100,
        "image": "reports/gang-cats-Alaksa.webp",
        "reporters": ["usman.tariq"],
        "description": "A group of cats near the butcher shops. One Siamese is limping and the white one has a runny eye.",
        "minutes_ago": 26 * 60,
    },
]

# Organization notes on the open Ducky paws cases (added to CASE_NOTES below).
DUCKY_PAWS_CASE_NOTES = {
    "Two Dogs — Bus Stand": ["We've got this one. A volunteer will check on them after the evening feeding round."],
    "Street Cats — Main Bazaar": [
        "Traps are set near the butcher shops. The shopkeepers are helping us keep the cats in one spot.",
        "Caught the limping Siamese. It's a thorn in the paw, already out. Going back for the white one tomorrow.",
    ],
}
CASE_NOTES.update(DUCKY_PAWS_CASE_NOTES)

# People who also reported a Ducky paws animal's case (the reporter-side history for Maryam).
DUCKY_PAWS_EXTRA_REPORTS = {"Rocky": "maryam.siddiqui", "Kali": "maryam.siddiqui"}

# (applicant, animal, status, hours ago applied, hours ago decided)
DUCKY_PAWS_APPLICATIONS = [
    ("maryam.siddiqui", "Chai", "pending", 30, None),
    ("bilal.hussain", "Chai", "pending", 20, None),
    ("hina.malik", "Kali", "pending", 9, None),
    ("usman.tariq", "Bholu", "approved", 12 * 24, 3 * 24 + 2),
]

# (sponsor, animal, PKR, monthly, status, hours ago)
DUCKY_PAWS_PLEDGES = [
    ("maryam.siddiqui", "Rocky", 1000, True, "confirmed", 40),
    ("hamza.iqbal", "Rocky", 2000, False, "confirmed", 50),
    ("ali.raza", "Mano", 1500, False, "confirmed", 6 * 24),
    ("zainab.qureshi", "Mano", 1500, True, "pending", 4),
    ("fatima.khan", "Kali", 500, False, "confirmed", 10 * 24),
]

# Chats with Ducky paws, oldest message first: (who, minutes ago, text, photo).
# "org_read" is how many minutes ago the team last opened the chat (None = never read the last
# member message, so it shows as unread for the team).
DUCKY_PAWS_CHATS = [
    {
        "member": "maryam.siddiqui", "case": "Two Dogs — Bus Stand", "member_read": 200, "org_read": None,
        "messages": [
            ("org", 4 * 60 + 40, "Hi Maryam, thank you for reporting the two dogs at the bus stand. We've accepted the case.", None),
            ("member", 4 * 60 + 30, "Thank you! The brown one has a wound on its back leg. They're both friendly with the tea stall owner.", None),
            ("org", 3 * 60 + 20, "That helps a lot. Could you ask the tea stall owner to keep some food out so they stay nearby? We'll come after the evening round.", None),
            ("member", 15, "He's put food out and they're still there. The brown one is licking the wound a lot.", "reports/images (1).jpg"),
        ],
    },
    {
        "member": "maryam.siddiqui", "animal": "Chai", "member_read": 3 * 60, "org_read": 20 * 60,
        "messages": [
            ("member", 29 * 60, "Hi! I've applied to adopt Chai. We have a small yard. Is she okay with kids?", None),
            ("org", 20 * 60, "Hi Maryam! Chai loves kids, she gets excited and jumpy at first but settles quickly. We'll call you to set up a visit.", None),
            ("org", 2 * 60, "Would Saturday at 11am work for a visit to meet Chai at our shelter?", None),
        ],
    },
    {
        "member": "hamza.iqbal", "animal": "Rocky", "member_read": 30, "org_read": 25,
        "messages": [
            ("member", 3 * 24 * 60, "I'm the one who called about Rocky at the bazaar. Is he going to be okay?", None),
            ("org", 3 * 24 * 60 - 45, "He is! The cut needed stitches but there's no fracture. Thank you for calling us so quickly.", None),
            ("member", 26 * 60, "I've sent Rs 2,000 for his treatment. Please give him a hug from me.", None),
            ("org", 25, "Received and confirmed, thank you Hamza! He took his first walk around the yard yesterday.", None),
        ],
    },
    {
        "member": "usman.tariq", "case": "Street Cats — Main Bazaar", "member_read": 10, "org_read": None,
        "messages": [
            ("member", 25 * 60, "The cats are near the butcher shops most mornings. The Siamese is the one limping.", None),
            ("org", 22 * 60, "Thanks Usman. We've set traps there and the shopkeepers are helping.", None),
            ("org", 3 * 60, "We caught the Siamese. It was a thorn in the paw, already out!", None),
            ("member", 8, "Brilliant! The white one is still there this morning, near the second shop.", None),
        ],
    },
    {
        "member": "hina.malik", "animal": "Kali", "member_read": 7 * 60, "org_read": 6 * 60,
        "messages": [
            ("member", 9 * 60, "I applied for Kali. I live alone in a quiet flat, so I think she'd be happy. Does she need a special diet?", None),
            ("org", 6 * 60, "Hi Hina! No special diet, just regular cat food and fresh water. A quiet home sounds perfect for her.", None),
        ],
    },
]


class Command(BaseCommand):
    help = "Create fake but consistent StrayAid demo data for Islamabad and Rawalpindi."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help=f"Delete all {DEMO_DOMAIN} demo accounts (and everything they own) before seeding.",
        )
        parser.add_argument(
            "--stories",
            action="store_true",
            help="Only bring every demo story back inside its 24-hour window (and add any missing ones).",
        )
        parser.add_argument(
            "--production",
            action="store_true",
            help="Allow seeding with DEBUG off (a live server). Needs DEMO_PASSWORD to be set.",
        )
        parser.add_argument(
            "--only-ducky-paws",
            action="store_true",
            help=f"Only add the animals and posts for {DUCKY_PAWS_NAME} (needs the demo reporters to exist).",
        )

    def handle(self, *args, **options):
        self.password = self.demo_password(options["production"])
        self.own_photos_only = not settings.DEBUG
        self.seed(options)

    def real_photo(self, relative, crop=None):
        """A photo from images/, optionally cropped to (left, top, right, bottom) fractions.
        On a live server the downloaded photos, which aren't ours to publish, are swapped for
        one of the team's own Stitch images."""
        path = REAL_IMAGES / relative
        if self.own_photos_only:
            own = sorted(image for image in STITCH_IMAGES.iterdir() if "logo" not in image.name)
            path = own[sum(relative.encode()) % len(own)]
            crop = None
        if crop is None:
            return ContentFile(path.read_bytes(), name=path.name)
        from io import BytesIO

        from PIL import Image

        with Image.open(path) as image:
            image = image.convert("RGB")
            width, height = image.size
            left, top, right, bottom = crop
            image = image.crop((int(left * width), int(top * height), int(right * width), int(bottom * height)))
            buffer = BytesIO()
            image.save(buffer, format="JPEG", quality=88)
        return ContentFile(buffer.getvalue(), name=f"{path.stem}-closeup.jpg")

    def demo_password(self, production):
        if settings.DEBUG:
            return os.getenv("DEMO_PASSWORD") or LOCAL_DEMO_PASSWORD
        if not production:
            raise CommandError("DEBUG is off, so this looks like a live server. Re-run with --production to seed it anyway.")
        password = os.getenv("DEMO_PASSWORD", "")
        if len(password) < 12:
            raise CommandError("Set DEMO_PASSWORD (12+ characters) so the demo accounts don't share a known password.")
        return password

    @transaction.atomic
    def seed(self, options):
        if options["stories"]:
            organizations = {
                data["key"]: organization
                for data in ORGANIZATIONS
                if (organization := Organization.objects.filter(user__email=f"{data['key']}{DEMO_DOMAIN}").first())
            }
            self.seed_stories(organizations)
            ducky = Organization.objects.filter(name__iexact=DUCKY_PAWS_NAME).first()
            if ducky:
                self.seed_ducky_paws_stories(ducky)
            self.stdout.write(self.style.SUCCESS("Stories refreshed: they stay up for the next 24 hours."))
            return

        if options["only_ducky_paws"]:
            self.seed_ducky_paws()
            return

        if options["reset"]:
            deleted, _ = User.objects.filter(email__endswith=DEMO_DOMAIN).exclude(is_superuser=True).delete()
            self.stdout.write(self.style.WARNING(f"Reset: removed {deleted} demo records."))

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
        # After the notifications rebuild, which would otherwise wipe the ones it adds.
        self.seed_ducky_paws()

        self.stdout.write(self.style.SUCCESS("Demo data ready."))
        if settings.DEBUG:
            self.stdout.write(f"Password for every demo account: {self.password}")
        self.stdout.write("Reporters: " + ", ".join(f"{username}{DEMO_DOMAIN}" for username, _, _ in REPORTERS))
        self.stdout.write("Organizations: " + ", ".join(f"{org['key']}{DEMO_DOMAIN}" for org in ORGANIZATIONS))
        self.stdout.write(f"Applications, messages and notifications to demo: {SHOWCASE}{DEMO_DOMAIN}")

    def seed_organizations(self):
        organizations = {}
        for data in ORGANIZATIONS:
            user, _ = User.objects.get_or_create(
                email=f"{data['key']}{DEMO_DOMAIN}",
                defaults={"username": data["key"].replace("-", "_"), "role": "organization"},
            )
            user.role = "organization"
            user.set_password(self.password)
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
            user.set_password(self.password)
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
                    },
                )
                attach_photo(report, "image", data["image"])
                score_report(report)
                backdate(report, minutes=data["minutes_ago"] - index * 3)
            # AI confidence from the real detector on the demo photos (spec section 4).
            refresh_case_score(case)
            backdate(case, minutes=data["minutes_ago"])

    def seed_case_history(self, cases=None):
        """Rebuild every demo case's "Case Updates" (or just `cases`): one entry per status step it
        has been through, spread between the report and now, plus organization notes on open cases."""
        now = timezone.now()
        if cases is None:
            cases = Case.objects.filter(reported_by__email__endswith=DEMO_DOMAIN)
        for case in cases.select_related("organization"):
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
            if org_key not in organizations:
                continue
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

    def seed_ducky_paws(self):
        """Animals at every stage, each with a few posts, for Ducky paws Rescue (see DUCKY_PAWS_ANIMALS)."""
        organization = Organization.objects.filter(name__iexact=DUCKY_PAWS_NAME).first()
        if organization is None:
            self.stdout.write(f"Skipped {DUCKY_PAWS_NAME}: no organization with that name.")
            return
        emails = [f"{username}{DEMO_DOMAIN}" for username, _, _ in REPORTERS]
        people = {user.email.split("@")[0]: user for user in User.objects.filter(email__in=emails)}
        if not people:
            self.stdout.write(f"Skipped {DUCKY_PAWS_NAME}: run the full seed first to create the demo reporters.")
            return
        likers = list(people.values())
        maryam = self.seed_kahuta_reporter()
        people[KAHUTA_REPORTER["key"]] = maryam

        for data in DUCKY_PAWS_ANIMALS:
            reporter = people.get(data["reporter"]) or likers[0]
            hours_in_care = data["days_in_care"] * 24
            case, _ = Case.objects.update_or_create(
                title=f"{data['species']} — {data['area']}",
                reported_by=reporter,
                defaults={
                    "description": data["description"],
                    "species": data["species"].lower(),
                    "area": data["area"],
                    "severity": data["severity"],
                    "status": CASE_STATUS_FOR_ANIMAL[data["status"]],
                    "organization": organization,
                    "assigned_to": organization.user,
                    "latitude": data["latitude"],
                    "longitude": data["longitude"],
                    "resolved_at": timezone.now() - timedelta(days=3) if data["status"] == Animal.STATUS_ADOPTED else None,
                },
            )
            report, _ = Report.objects.get_or_create(
                case=case,
                user=reporter,
                defaults={
                    "description": data["description"],
                    "latitude": data["latitude"],
                    "longitude": data["longitude"],
                },
            )
            if not report.image:
                report.image.save(Path(data["image"]).name, self.real_photo(data["image"]), save=True)
                score_report(report)
            refresh_case_score(case)
            backdate(case, hours=hours_in_care + 3)
            backdate(report, hours=hours_in_care + 3)

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
                    "sponsor_goal": 6,
                    "funding_goal_pkr": data["funding_goal"],
                },
            )
            if not animal.image:
                animal.image.save(Path(data["image"]).name, self.real_photo(data["image"]), save=True)
            backdate(animal, hours=hours_in_care)

            kept = []
            for index, (title, content, category, photo_kind, hours_ago) in enumerate(data["posts"]):
                post, _ = Post.objects.update_or_create(
                    animal=animal,
                    organization=organization,
                    title=f"{data['name']}: {title}",
                    defaults={"content": content, "category": category},
                )
                if photo_kind and not post.image:
                    crop = data["crop"] if photo_kind == "crop" else None
                    post.image.save(Path(data["image"]).name, self.real_photo(data["image"], crop), save=True)
                backdate(post, hours=hours_ago)
                kept.append(post.id)
                # A few likes and a comment, so the feed doesn't look empty.
                for user in likers[: 2 + (len(content) + index) % 5]:
                    PostLike.objects.get_or_create(post=post, user=user)
                if index == 0:
                    comment, _ = PostComment.objects.get_or_create(
                        post=post,
                        user=likers[(len(data["name"]) + 1) % len(likers)],
                        body=DUCKY_PAWS_COMMENTS[len(data["name"]) % len(DUCKY_PAWS_COMMENTS)],
                        parent=None,
                    )
                    backdate(comment, hours=max(hours_ago - 1, 0))
            # Posts dropped from the list above are removed on the next run.
            Post.objects.filter(animal=animal, organization=organization).exclude(id__in=kept).delete()

        self.seed_ducky_paws_stories(organization)
        cases = self.seed_ducky_paws_cases(organization, people)
        self.seed_case_history(Case.objects.filter(Q(organization=organization) | Q(id__in=[case.id for case in cases])))
        self.seed_ducky_paws_people(organization, people, maryam)

        self.stdout.write(
            f"{DUCKY_PAWS_NAME}: {len(DUCKY_PAWS_ANIMALS)} animals with their posts, {len(DUCKY_PAWS_CASES)} reports nearby, "
            f"{len(DUCKY_PAWS_CHATS)} chats."
        )
        self.stdout.write(f"Kahuta reporter: {KAHUTA_REPORTER['key']}{DEMO_DOMAIN}")

    def seed_kahuta_reporter(self):
        data = KAHUTA_REPORTER
        person, _ = User.objects.get_or_create(
            email=f"{data['key']}{DEMO_DOMAIN}",
            defaults={"username": data["key"].replace(".", "_"), "first_name": data["first_name"], "last_name": data["last_name"]},
        )
        person.set_password(self.password)
        for field in ("area", "phone", "alert_latitude", "alert_longitude"):
            setattr(person, field, data[field])
        person.field_ready = True
        person.radius_alerts = True
        person.date_joined = timezone.now() - timedelta(days=data["joined_days"])
        person.save()
        return person

    def seed_ducky_paws_cases(self, organization, people):
        cases = []
        for data in DUCKY_PAWS_CASES:
            case, _ = Case.objects.update_or_create(
                title=data["title"],
                reported_by=people[data["reporters"][0]],
                defaults={
                    "description": data["description"],
                    "species": data["species"],
                    "area": data["area"],
                    "severity": data["severity"],
                    "status": data["status"],
                    "organization": organization if data["assigned"] else None,
                    "assigned_to": organization.user if data["assigned"] else None,
                    "latitude": data["latitude"],
                    "longitude": data["longitude"],
                },
            )
            for index, username in enumerate(data["reporters"]):
                # Follow-up reports sit a few feet from the first one (inside the 15 ft merge radius).
                report, _ = Report.objects.get_or_create(
                    case=case,
                    user=people[username],
                    defaults={
                        "description": data["description"],
                        "latitude": data["latitude"] + index * 0.00001,
                        "longitude": data["longitude"],
                    },
                )
                if not report.image:
                    report.image.save(Path(data["image"]).name, self.real_photo(data["image"]), save=True)
                    score_report(report)
                backdate(report, minutes=data["minutes_ago"] - index * 40)
            refresh_case_score(case)
            backdate(case, minutes=data["minutes_ago"])
            cases.append(case)

        # Maryam also reported two of the animals the team now cares for.
        for name, username in DUCKY_PAWS_EXTRA_REPORTS.items():
            animal = Animal.objects.filter(name=name, organization=organization).select_related("case").first()
            if animal and animal.case:
                case = animal.case
                report, _ = Report.objects.get_or_create(
                    case=case,
                    user=people[username],
                    defaults={
                        "description": case.description,
                        "latitude": case.latitude + 0.00001,
                        "longitude": case.longitude,
                    },
                )
                first = case.reports.exclude(pk=report.pk).order_by("created_at").first()
                if first:
                    type(report).objects.filter(pk=report.pk).update(created_at=first.created_at + timedelta(minutes=35))
                if not report.image and first and first.image:
                    report.image.save(Path(first.image.name).name, ContentFile(first.image.read()), save=True)
                refresh_case_score(case)
        return cases

    def seed_ducky_paws_people(self, organization, people, maryam):
        animals = {animal.name: animal for animal in Animal.objects.filter(organization=organization)}
        now = timezone.now()

        for username, name, status, applied_hours, decided_hours in DUCKY_PAWS_APPLICATIONS:
            person, animal = people[username], animals.get(name)
            if animal is None:
                continue
            application, _ = AdoptionApplication.objects.update_or_create(
                animal=animal,
                applicant=person,
                defaults={
                    "full_name": person.get_full_name() or person.username,
                    "phone": KAHUTA_REPORTER["phone"] if person == maryam else f"+92 300 77{len(username):02d}{len(name):03d}",
                    "home_type": "house" if len(username) % 2 else "apartment",
                    "has_other_pets": False,
                    "city": "Kahuta" if person == maryam else "Rawalpindi",
                    "ownership": "own",
                    "landlord_allows_pets": None,
                    "household_size": 2 + len(username) % 4,
                    "has_children": person == maryam,
                    "hours_alone": 3,
                    "experience": "some",
                    "reason": f"We've followed {name}'s posts from {organization.name} and have a calm home with time to "
                    f"care for a {animal.species.lower()}. We'd love to give {name} a forever family.",
                    "care_plan": "Family members look after pets when we travel.",
                    "agrees_home_visit": True,
                    "agrees_return_policy": True,
                    "status": status,
                    "decided_at": now - timedelta(hours=decided_hours) if decided_hours else None,
                },
            )
            backdate(application, hours=applied_hours)

        for username, name, amount, monthly, status, hours in DUCKY_PAWS_PLEDGES:
            animal = animals.get(name)
            if animal is None:
                continue
            pledge, _ = Sponsorship.objects.update_or_create(
                animal=animal,
                sponsor=people[username],
                defaults={"amount_pkr": amount, "monthly": monthly, "status": status},
            )
            backdate(pledge, hours=hours)

        # Maryam follows the team, the animal she helped report and her open case.
        OrganizationFollow.objects.get_or_create(user=maryam, organization=organization)
        if "Rocky" in animals:
            AnimalFollow.objects.get_or_create(user=maryam, animal=animals["Rocky"])
        bus_stand = Case.objects.filter(title="Two Dogs — Bus Stand", reported_by=maryam).first()
        if bus_stand:
            CaseFollow.objects.get_or_create(user=maryam, case=bus_stand)
        chai_post = Post.objects.filter(animal=animals.get("Chai"), category=Post.CATEGORY_ADOPTION).first()
        if chai_post:
            SavedPost.objects.get_or_create(post=chai_post, user=maryam)
        rocky_post = Post.objects.filter(animal=animals.get("Rocky")).order_by("created_at").first()
        if rocky_post:
            comment, _ = PostComment.objects.get_or_create(
                post=rocky_post, user=maryam, parent=None, body="I saw him at the bazaar that morning. So glad he's with you now 💚"
            )
            backdate(comment, hours=60)

        self.seed_ducky_paws_chats(organization, people)
        self.seed_ducky_paws_notifications(organization, people, maryam)

    def seed_ducky_paws_chats(self, organization, people):
        now = timezone.now()
        for data in DUCKY_PAWS_CHATS:
            member = people[data["member"]]
            case = Case.objects.filter(title=data["case"], organization=organization).first() if data.get("case") else None
            animal = Animal.objects.filter(name=data["animal"], organization=organization).first() if data.get("animal") else None
            conversation, _ = Conversation.objects.get_or_create(member=member, organization=organization, case=case, animal=animal)

            kept = []
            for who, minutes_ago, body, image in data["messages"]:
                sender = member if who == "member" else organization.user
                message, _ = Message.objects.update_or_create(
                    conversation=conversation, sender=sender, body=body, defaults={"created_at": now - timedelta(minutes=minutes_ago)}
                )
                if image and not message.image:
                    message.image.save(Path(image).name, self.real_photo(image), save=True)
                kept.append(message.id)
            conversation.messages.exclude(id__in=kept).delete()

            ordered = conversation.messages.order_by("created_at")
            conversation.created_at = ordered.first().created_at
            conversation.last_message_at = ordered.last().created_at
            conversation.member_read_at = now - timedelta(minutes=data["member_read"])
            if data["org_read"] is None:
                # The team read everything up to its own last reply, so the member's newest message is unread.
                org_last = conversation.messages.filter(sender=organization.user).order_by("-created_at").first()
                conversation.organization_read_at = org_last.created_at if org_last else None
            else:
                conversation.organization_read_at = now - timedelta(minutes=data["org_read"])
            conversation.save()

    def seed_ducky_paws_notifications(self, organization, people, maryam):
        """Rebuilt each run (tagged with a "seed:ducky" group key) so nothing piles up on the
        team's own account, which the demo reset never touches."""
        now = timezone.now()
        team = organization.user
        Notification.objects.filter(user__in=[team, *people.values()], group_key__startswith="seed:ducky").delete()

        def add(user, kind, title, body, data, minutes_ago, read=None, key=""):
            read = minutes_ago > 120 if read is None else read
            Notification.objects.create(
                user=user, kind=kind, title=title, body=body, data=data, group_key=f"seed:ducky:{key or kind}",
                created_at=now - timedelta(minutes=minutes_ago), read_at=now if read else None,
            )

        # The team: new reports in its area, applications, a receipt to check, unread chats.
        for data in DUCKY_PAWS_CASES:
            case = Case.objects.get(title=data["title"], reported_by=people[data["reporters"][0]])
            if data["status"] != "reported":
                continue
            if data["severity"] == "critical":
                add(team, "alert", "Critical report nearby", f"Critical: **{data['title'].split(' — ')[0]}** reported on {data['area']}, near your base.",
                    {"type": "critical_case", "case_id": case.id}, data["minutes_ago"] - 1, read=False, key=f"case:{case.id}")
            else:
                add(team, "rescue", "New report nearby", f"**{data['title'].split(' — ')[0]}** reported on {data['area']}, inside your service area.",
                    {"type": "case", "case_id": case.id}, data["minutes_ago"] - 1, key=f"case:{case.id}")
        for application in AdoptionApplication.objects.filter(animal__organization=organization, status="pending"):
            minutes = (now - application.created_at).total_seconds() / 60
            add(team, "adoption", "Adoption", f"**{application.full_name}** wants to adopt **{application.animal.name}**.",
                {"type": "adoption_application", "application_id": application.id, "animal_id": application.animal_id},
                minutes, key=f"application:{application.id}")
        for pledge in Sponsorship.objects.filter(animal__organization=organization, status="pending"):
            minutes = (now - pledge.created_at).total_seconds() / 60
            add(team, "sponsorship", "Sponsorship",
                f"**{pledge.sponsor.get_full_name()}** pledged PKR {pledge.amount_pkr:,} for **{pledge.animal.name}**. Check the receipt.",
                {"type": "sponsorship", "sponsorship_id": pledge.id, "animal_id": pledge.animal_id}, minutes, key=f"pledge:{pledge.id}")

        # Maryam: her reports moving along, her pledge, a new post, and her unread chat.
        bus_stand = Case.objects.get(title="Two Dogs — Bus Stand", reported_by=maryam)
        add(maryam, "rescue", "Rescue Update", f"Your report at the bus stand was accepted by **{organization.name}**.",
            {"type": "case_status", "case_id": bus_stand.id, "status": "assigned"}, 4 * 60 + 40, key=f"case:{bus_stand.id}")
        rocky = Animal.objects.filter(name="Rocky", organization=organization).first()
        if rocky:
            add(maryam, "rescue", "Rescue Update", f"Good news: the dog you reported has been rescued by **{organization.name}**. Meet **Rocky**!",
                {"type": "case_status", "case_id": rocky.case_id, "status": "rescued"}, 3 * 24 * 60 - 30, key=f"case:{rocky.case_id}")
            pledge = Sponsorship.objects.filter(sponsor=maryam, animal=rocky).first()
            if pledge:
                add(maryam, "sponsorship", "Sponsorship", f"**{organization.name}** confirmed your PKR {pledge.amount_pkr:,} monthly pledge for **Rocky**. Thank you! 💚",
                    {"type": "sponsorship", "sponsorship_id": pledge.id, "animal_id": rocky.id}, 30 * 60, key=f"pledge:{pledge.id}")
        chai_post = Post.objects.filter(animal__name="Chai", animal__organization=organization, category=Post.CATEGORY_ADOPTION).first()
        if chai_post:
            add(maryam, "community", "Community", f"New post from **{organization.name}**: Chai is ready for a home.",
                {"type": "new_post", "post_id": chai_post.id, "animal_id": chai_post.animal_id}, 2 * 24 * 60, key=f"post:{chai_post.id}")

        for conversation in Conversation.objects.filter(organization=organization).select_related("member"):
            for viewer, label in ((conversation.member, organization.name), (team, conversation.member.get_full_name())):
                if conversation.unread_for(viewer):
                    minutes = (now - conversation.last_message_at).total_seconds() / 60
                    add(viewer, "chat", "Chat", f"New message from **{label}**.",
                        {"type": "chat_message", "conversation_id": conversation.id}, minutes, read=False, key=f"chat:{conversation.id}")

    def seed_ducky_paws_stories(self, organization):
        for category, image, crop, caption, headline, animal_name, hours_ago in DUCKY_PAWS_STORIES:
            story, created = Story.objects.get_or_create(
                organization=organization,
                category=category,
                caption=caption,
                defaults={"image": self.real_photo(image, crop)},
            )
            story.animal = Animal.objects.filter(name=animal_name, organization=organization).first() if animal_name else None
            story.headline = headline
            story.save(update_fields=["animal", "headline"])
            # Stories stay fresh: every run moves them back inside the 24-hour window.
            backdate(story, hours=hours_ago)
