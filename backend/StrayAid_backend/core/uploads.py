import uuid
from pathlib import PurePath

from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils.deconstruct import deconstructible
from PIL import Image, UnidentifiedImageError

ALLOWED_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP", "GIF", "HEIF", "MPO"}
SAFE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"}


def max_upload_bytes():
    return getattr(settings, "MAX_UPLOAD_BYTES", 10 * 1024 * 1024)


def validate_image_size(file):
    limit = max_upload_bytes()
    if file and file.size > limit:
        raise ValidationError(f"Choose a photo smaller than {limit // (1024 * 1024) or 1} MB.")


def validate_image_upload(file):
    """Refuse anything that is too big or isn't really a photo, whatever its name or type says."""
    validate_image_size(file)
    try:
        file.seek(0)
        with Image.open(file) as image:
            image_format = image.format
            image.verify()
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError) as error:
        raise ValidationError("That file isn't a photo. Choose a JPG, PNG or WebP image.") from error
    finally:
        file.seek(0)
    if image_format not in ALLOWED_IMAGE_FORMATS:
        raise ValidationError("That file isn't a photo. Choose a JPG, PNG or WebP image.")


@deconstructible
class UniqueUploadPath:
    """Store uploads under a random name, so file names never reveal who uploaded what and
    one upload's URL can't be guessed from another's."""

    def __init__(self, folder):
        self.folder = folder

    def __call__(self, instance, filename):
        extension = PurePath(filename).suffix.lower()
        if extension not in SAFE_EXTENSIONS:
            extension = ".bin"
        return f"{self.folder}/{uuid.uuid4().hex}{extension}"

    def __eq__(self, other):
        return isinstance(other, UniqueUploadPath) and other.folder == self.folder
