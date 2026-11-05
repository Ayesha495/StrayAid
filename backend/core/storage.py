"""Where uploads live. The free host wipes the server's disk on every restart, so when MEDIA_BUCKET
is set, uploads go to that Neon Object Storage bucket (S3-compatible, private) and are handed out
as signed, expiring links. The demo photos ship inside the server image under media/demo, so
names starting with demo/ keep coming from the local disk."""

from django.core.files.storage import FileSystemStorage
from storages.backends.s3 import S3Storage

LOCAL_PREFIX = "demo/"


class MediaStorage(S3Storage):
    def __init__(self, **settings):
        super().__init__(**settings)
        self.local = FileSystemStorage()

    @staticmethod
    def is_local(name):
        return str(name).replace("\\", "/").lstrip("/").startswith(LOCAL_PREFIX)

    def _open(self, name, mode="rb"):
        return self.local._open(name, mode) if self.is_local(name) else super()._open(name, mode)

    def exists(self, name):
        return self.local.exists(name) if self.is_local(name) else super().exists(name)

    def delete(self, name):
        return self.local.delete(name) if self.is_local(name) else super().delete(name)

    def size(self, name):
        return self.local.size(name) if self.is_local(name) else super().size(name)

    def url(self, name, parameters=None, expire=None, http_method=None):
        if self.is_local(name):
            return self.local.url(name)
        return super().url(name, parameters=parameters, expire=expire, http_method=http_method)
