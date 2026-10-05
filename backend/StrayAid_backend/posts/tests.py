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


class CommunityEngagementTests(MediaEnabledAPITestCase):
    """Likes, comment counts and 24-hour stories behind the home feed."""

    def setUp(self):
        from datetime import timedelta

        from django.core.files.uploadedfile import SimpleUploadedFile
        from django.utils import timezone

        from .models import PostComment, PostLike, Story

        self.org_user = User.objects.create_user(
            email="org2@example.com", username="org2", password="secret123", role="organization"
        )
        self.organization = Organization.objects.create(user=self.org_user, name="Paws & Care", email=self.org_user.email)
        self.reporter = User.objects.create_user(
            email="reporter@example.com", username="reporter", password="secret123"
        )
        case = Case.objects.create(description="Case", latitude=33.68, longitude=73.04, reported_by=self.reporter)
        animal = Animal.objects.create(case=case, organization=self.organization, name="Luna")
        self.post = Post.objects.create(animal=animal, organization=self.organization, title="Luna", content="Safe now")
        PostLike.objects.create(post=self.post, user=self.org_user)
        PostComment.objects.create(post=self.post, user=self.org_user, body="Lovely")
        PostComment.objects.create(post=self.post, user=self.org_user, body="Get well soon")

        image = lambda: SimpleUploadedFile("story.jpg", b"filecontent", content_type="image/jpeg")
        Story.objects.create(organization=self.organization, category="adoption", image=image(), caption="Meet Luna")
        Story.objects.create(organization=self.organization, category="happy_ending", image=image())
        Story.objects.create(
            organization=self.organization,
            category="sanctuary",
            image=image(),
            created_at=timezone.now() - timedelta(hours=25),
        )

    def test_feed_includes_engagement_counts_for_guests(self):
        response = self.client.get("/api/posts/public-feed/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        item = response.data[0]
        self.assertEqual(item["like_count"], 1)
        self.assertEqual(item["comment_count"], 2)
        self.assertFalse(item["liked_by_me"])

    def test_like_requires_login(self):
        response = self.client.post(f"/api/posts/{self.post.id}/like/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_reporter_can_like_and_unlike_any_post(self):
        self.client.force_authenticate(self.reporter)

        liked = self.client.post(f"/api/posts/{self.post.id}/like/")
        again = self.client.post(f"/api/posts/{self.post.id}/like/")
        feed = self.client.get("/api/posts/public-feed/")
        unliked = self.client.delete(f"/api/posts/{self.post.id}/like/")

        self.assertEqual(liked.data, {"liked_by_me": True, "like_count": 2})
        self.assertEqual(again.data["like_count"], 2)  # liking twice counts once
        self.assertTrue(feed.data[0]["liked_by_me"])
        self.assertEqual(unliked.data, {"liked_by_me": False, "like_count": 1})

    def test_story_groups_only_include_last_24_hours(self):
        response = self.client.get("/api/posts/stories/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        categories = [group["category"] for group in response.data]
        self.assertEqual(categories, ["happy_ending", "adoption"])  # category order, expired sanctuary story hidden
        self.assertEqual(response.data[1]["label"], "Adoption")
        self.assertEqual(response.data[1]["stories"][0]["caption"], "Meet Luna")
        self.assertEqual(response.data[1]["stories"][0]["organization"]["name"], "Paws & Care")

    def test_feed_is_newest_first_even_with_engagement_counts(self):
        from datetime import timedelta

        from django.utils import timezone

        older = Post.objects.create(
            animal=self.post.animal, organization=self.organization, title="Older", content="Earlier update"
        )
        Post.objects.filter(pk=older.pk).update(created_at=timezone.now() - timedelta(days=2))
        Post.objects.filter(pk=self.post.pk).update(created_at=timezone.now())

        response = self.client.get("/api/posts/public-feed/")

        self.assertEqual([item["title"] for item in response.data], ["Luna", "Older"])
