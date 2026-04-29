import shutil
import tempfile

from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from animals.models import Animal
from organizations.models import Organization
from rescue.models import Case

from .models import Post


User = get_user_model()


class MediaEnabledAPITestCase(APITestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls._temp_media = tempfile.mkdtemp()
        cls._override = override_settings(MEDIA_ROOT=cls._temp_media)
        cls._override.enable()

    @classmethod
    def tearDownClass(cls):
        cls._override.disable()
        shutil.rmtree(cls._temp_media, ignore_errors=True)
        super().tearDownClass()


class PostApiTests(MediaEnabledAPITestCase):
    def setUp(self):
        self.org_user = User.objects.create_user(
            email="org@example.com",
            username="org",
            password="secret123",
            role="organization",
        )
        self.other_user = User.objects.create_user(
            email="other@example.com",
            username="other",
            password="secret123",
            role="organization",
        )
        self.organization = Organization.objects.create(
            user=self.org_user,
            name="Safe Paws",
            email=self.org_user.email,
            bank_name="Meezan Bank",
            bank_account_title="Safe Paws Rescue",
            bank_account_number="1234567890",
        )
        self.other_organization = Organization.objects.create(user=self.other_user, name="Second Chance", email=self.other_user.email)
        self.case = Case.objects.create(
            description="Own case",
            latitude=31.5,
            longitude=74.3,
            reported_by=self.org_user,
            organization=self.organization,
            assigned_to=self.org_user,
            status="rescued",
        )
        self.other_case = Case.objects.create(
            description="Other case",
            latitude=31.6,
            longitude=74.4,
            reported_by=self.other_user,
            organization=self.other_organization,
            assigned_to=self.other_user,
            status="rescued",
        )
        self.animal = Animal.objects.create(case=self.case, organization=self.organization, name="Milo")
        self.other_animal = Animal.objects.create(case=self.other_case, organization=self.other_organization, name="Luna")

    def test_organization_can_create_post_for_own_animal(self):
        self.client.force_authenticate(user=self.org_user)

        response = self.client.post(
            "/api/posts/",
            {
                "animal": self.animal.id,
                "title": "Recovery update",
                "content": "Milo is eating well.",
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Post.objects.get().organization, self.organization)

    def test_organization_cannot_create_post_for_another_organizations_animal(self):
        self.client.force_authenticate(user=self.org_user)

        response = self.client.post(
            "/api/posts/",
            {
                "animal": self.other_animal.id,
                "title": "Blocked update",
                "content": "Should not save.",
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("animal", response.data)

    def test_public_feed_returns_published_posts(self):
        post = Post.objects.create(
            animal=self.animal,
            organization=self.organization,
            title="Recovery update",
            content="Milo is eating well.",
        )

        response = self.client.get("/api/posts/public-feed/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], post.id)
        self.assertEqual(response.data[0]["animal"]["donation_info"]["bank"], "Meezan Bank")
        self.assertEqual(response.data[0]["animal"]["donation_info"]["account_name"], "Safe Paws Rescue")
        self.assertEqual(response.data[0]["animal"]["donation_info"]["account_number"], "1234567890")

    def test_by_animal_returns_empty_list_for_unknown_animal(self):
        Post.objects.create(
            animal=self.animal,
            organization=self.organization,
            title="Recovery update",
            content="Milo is eating well.",
        )

        response = self.client.get("/api/posts/by-animal/?animal_id=9999")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    def test_public_can_retrieve_post_detail(self):
        post = Post.objects.create(
            animal=self.animal,
            organization=self.organization,
            title="Recovery update",
            content="Milo is eating well.",
        )

        response = self.client.get(f"/api/posts/{post.id}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], post.id)
        self.assertEqual(response.data["title"], "Recovery update")

    def test_public_can_filter_posts_by_animal(self):
        own_post = Post.objects.create(
            animal=self.animal,
            organization=self.organization,
            title="Recovery update",
            content="Milo is eating well.",
        )
        Post.objects.create(
            animal=self.other_animal,
            organization=self.other_organization,
            title="Other update",
            content="Luna is recovering.",
        )

        response = self.client.get(f"/api/posts/by-animal/?animal_id={self.animal.id}")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], own_post.id)

    def test_organization_can_update_own_post(self):
        post = Post.objects.create(
            animal=self.animal,
            organization=self.organization,
            title="Recovery update",
            content="Milo is eating well.",
        )
        self.client.force_authenticate(user=self.org_user)

        response = self.client.patch(
            f"/api/posts/{post.id}/",
            {"title": "Recovery update 2", "content": "Milo is much better."},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        post.refresh_from_db()
        self.assertEqual(post.title, "Recovery update 2")

    def test_organization_cannot_update_another_organizations_post(self):
        post = Post.objects.create(
            animal=self.other_animal,
            organization=self.other_organization,
            title="Other update",
            content="Luna is recovering.",
        )
        self.client.force_authenticate(user=self.org_user)

        response = self.client.patch(
            f"/api/posts/{post.id}/",
            {"title": "Blocked update"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
