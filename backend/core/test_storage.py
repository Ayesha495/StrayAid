from types import SimpleNamespace

from django.test import SimpleTestCase, override_settings

from core.media import media_url
from core.storage import MediaStorage

BUCKET = dict(
    AWS_STORAGE_BUCKET_NAME="media",
    AWS_S3_ENDPOINT_URL="https://storage.example.neon.tech",
    AWS_S3_REGION_NAME="us-east-2",
    AWS_S3_ADDRESSING_STYLE="path",
    AWS_S3_SIGNATURE_VERSION="s3v4",
    AWS_S3_ACCESS_KEY_ID="test-key",
    AWS_S3_SECRET_ACCESS_KEY="test-secret",
    AWS_QUERYSTRING_AUTH=True,
    AWS_QUERYSTRING_EXPIRE=6 * 60 * 60,
)


@override_settings(**BUCKET)
class MediaStorageTests(SimpleTestCase):
    """Uploads go to the bucket; the demo photos that ship with the server stay on its disk."""

    def test_uploads_get_a_signed_link_to_the_bucket(self):
        url = MediaStorage().url("animals/abc123.jpg")
        self.assertTrue(url.startswith("https://storage.example.neon.tech/media/animals/abc123.jpg?"))
        self.assertIn("X-Amz-Signature=", url)

    def test_demo_photos_stay_on_the_server(self):
        self.assertEqual(MediaStorage().url("demo/05_s15_milo_rescue_dog.jpg"), "/media/demo/05_s15_milo_rescue_dog.jpg")
        self.assertTrue(MediaStorage.is_local("demo/x.jpg"))
        self.assertFalse(MediaStorage.is_local("animals/demo.jpg"))

    def test_a_bucket_link_for_a_receipt_is_not_signed_twice(self):
        storage = MediaStorage()
        receipt = SimpleNamespace(name="receipts/r1.jpg", url=storage.url("receipts/r1.jpg"))
        url = media_url(None, receipt)
        self.assertNotIn("sig=", url)
        self.assertIn("X-Amz-Signature=", url)
