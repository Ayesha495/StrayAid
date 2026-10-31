"""Uploads are public files by default, which is right for animal photos but not for bank
receipts or private chat pictures. Those two folders only open with a signed, expiring link
that the API hands to the people allowed to see them."""

import posixpath
from urllib.parse import quote

from django.conf import settings
from django.core.signing import BadSignature, TimestampSigner
from django.http import Http404
from django.views.static import serve

PROTECTED_FOLDERS = ("receipts/", "chat/")
LINK_LIFETIME_SECONDS = 6 * 60 * 60

signer = TimestampSigner(salt="strayaid.media")


def _clean(path):
    return posixpath.normpath(path).lstrip("/")


def is_protected(path):
    return _clean(path).lower().startswith(PROTECTED_FOLDERS)


def media_url(request, file):
    """The address of an upload, signed when the file is a private one."""
    if not file:
        return None
    url = file.url
    if is_protected(file.name):
        url = f"{url}?sig={quote(signer.sign(_clean(file.name)))}"
    return request.build_absolute_uri(url) if request else url


def signed_media_ok(path, signature):
    if not is_protected(path):
        return True
    if not signature:
        return False
    try:
        return signer.unsign(signature, max_age=LINK_LIFETIME_SECONDS) == _clean(path)
    except BadSignature:
        return False


def serve_media(request, path):
    # Not found rather than forbidden: a wrong link says nothing about whether the file exists.
    if not signed_media_ok(path, request.GET.get("sig")):
        raise Http404
    return serve(request, path, document_root=settings.MEDIA_ROOT)
