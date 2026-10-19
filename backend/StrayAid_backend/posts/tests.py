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

    def test_organizations_upload_stories_about_their_own_animals(self):
        from animals.tests import make_png

        from .models import Story

        story = {"category": "rescue_update", "headline": "Luna is eating again", "caption": "Day 3",
                 "animal_id": self.post.animal_id}
        self.client.force_authenticate(user=self.org_user)
        response = self.client.post("/api/posts/stories/", {**story, "image": make_png("story.png")}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["organization"]["name"], "Paws & Care")
        self.assertEqual(response.data["animal"]["name"], "Luna")
        self.assertTrue(Story.objects.filter(headline="Luna is eating again", organization=self.organization).exists())

        missing_image = self.client.post("/api/posts/stories/", story, format="multipart")
        self.assertEqual(missing_image.status_code, status.HTTP_400_BAD_REQUEST)

        other_user = User.objects.create_user(email="o3@example.com", username="o3", password="x", role="organization")
        Organization.objects.create(user=other_user, name="Other Shelter")
        self.client.force_authenticate(user=other_user)
        not_theirs = self.client.post("/api/posts/stories/", {**story, "image": make_png("s.png")}, format="multipart")
        self.assertEqual(not_theirs.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.reporter)
        reporter = self.client.post("/api/posts/stories/", {**story, "image": make_png("s.png")}, format="multipart")
        self.assertEqual(reporter.status_code, status.HTTP_403_FORBIDDEN)

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


class CommentsAndSavesTests(MediaEnabledAPITestCase):
    """The post page and comments sheet (Stitch 22 and 23)."""

    def setUp(self):
        from animals.models import Sponsorship

        from .models import PostComment

        self.org_user = User.objects.create_user(email="org3@example.com", username="org3", password="x", role="organization")
        self.organization = Organization.objects.create(user=self.org_user, name="Hope Animal Shelter")
        self.reporter = User.objects.create_user(email="rep@example.com", username="rep", password="x", first_name="Sara", last_name="Ahmed")
        self.donor = User.objects.create_user(email="don@example.com", username="don", password="x", first_name="Bilal")
        case = Case.objects.create(description="Kitten", latitude=33.7, longitude=73.0, reported_by=self.reporter)
        self.animal = Animal.objects.create(case=case, organization=self.organization, name="Coco", species="Cat")
        Sponsorship.objects.create(animal=self.animal, sponsor=self.donor, amount_pkr=1000, status="confirmed")
        self.post = Post.objects.create(animal=self.animal, organization=self.organization, title="Coco", content="Warm now")
        self.first = PostComment.objects.create(post=self.post, user=self.reporter, body="So glad Coco is safe")

    def url(self, suffix=""):
        return f"/api/posts/{self.post.id}/{suffix}"

    def test_comments_have_badges_replies_and_likes(self):
        from notifications.models import Notification

        self.client.force_authenticate(user=self.org_user)
        reply = self.client.post(self.url("comments/"), {"body": "Thank you Sara!", "parent": self.first.id}, format="json")
        self.assertEqual(reply.status_code, status.HTTP_201_CREATED, reply.data)
        self.client.force_authenticate(user=self.donor)
        self.client.post(self.url("comments/"), {"body": "Sending love"}, format="json")
        self.client.post(f"/api/posts/comments/{self.first.id}/like/")

        self.client.force_authenticate(user=None)
        data = self.client.get(self.url("comments/")).data
        self.assertEqual(data["count"], 3)
        top = data["results"][0]
        self.assertEqual((top["author"]["badge"], top["like_count"], top["liked_by_me"]), ("Reporter", 1, False))
        reply_author = top["replies"][0]["author"]
        self.assertEqual((reply_author["badge"], reply_author["name"]), ("Author", "Hope Animal Shelter"))
        self.assertEqual(data["results"][1]["author"]["badge"], "Donor")
        # The reporter heard about the reply, the organization about the new comment.
        self.assertTrue(Notification.objects.filter(user=self.reporter, body__contains="replied").exists())
        self.assertTrue(Notification.objects.filter(user=self.org_user, body__contains="commented").exists())

    def test_only_the_organization_pins_and_pinned_comes_first(self):
        from .models import PostComment

        newer = PostComment.objects.create(post=self.post, user=self.donor, body="Newest")
        self.client.force_authenticate(user=self.donor)
        self.assertEqual(self.client.post(f"/api/posts/comments/{newer.id}/pin/").status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(user=self.org_user)
        self.assertTrue(self.client.post(f"/api/posts/comments/{self.first.id}/pin/").data["is_pinned"])
        results = self.client.get(self.url("comments/?sort=new")).data["results"]
        self.assertEqual([row["body"] for row in results], ["So glad Coco is safe", "Newest"])
        self.assertTrue(results[0]["is_pinned"])

    def test_deleting_is_for_the_writer_or_the_organization(self):
        self.client.force_authenticate(user=self.donor)
        self.assertEqual(self.client.delete(f"/api/posts/comments/{self.first.id}/").status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(user=self.reporter)
        self.assertEqual(self.client.delete(f"/api/posts/comments/{self.first.id}/").status_code, status.HTTP_204_NO_CONTENT)

    def test_saving_sharing_and_the_saved_list(self):
        self.client.force_authenticate(user=self.reporter)
        self.assertTrue(self.client.post(self.url("save/")).data["saved_by_me"])
        self.assertTrue(self.client.get(self.url()).data["saved_by_me"])
        self.assertEqual([row["id"] for row in self.client.get("/api/posts/saved/").data], [self.post.id])
        self.client.delete(self.url("save/"))
        self.assertEqual(self.client.get("/api/posts/saved/").data, [])
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.post(self.url("share/")).data["share_count"], 1)
        self.assertEqual(self.client.post(self.url("save/")).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_stories_show_the_animal_and_whether_you_watched_them(self):
        from django.core.files.uploadedfile import SimpleUploadedFile

        from .models import Story

        story = Story.objects.create(organization=self.organization, category="rescue_update", animal=self.animal,
                                     headline="Warm and safe", image=SimpleUploadedFile("s.jpg", b"x", content_type="image/jpeg"))
        self.client.force_authenticate(user=self.reporter)
        group = self.client.get("/api/posts/stories/").data[0]
        self.assertFalse(group["seen"])
        self.assertEqual(group["stories"][0]["animal"]["sponsor_count"], 1)
        self.assertEqual(group["stories"][0]["animal"]["update_number"], 2)
        self.client.post(f"/api/posts/stories/{story.id}/seen/")
        self.assertTrue(self.client.get("/api/posts/stories/").data[0]["seen"])
