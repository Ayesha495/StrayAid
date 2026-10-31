from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import AuditEvent


class Command(BaseCommand):
    help = "Delete audit events older than the retention period (default 180 days)."

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=180)

    def handle(self, *args, **options):
        cutoff = timezone.now() - timedelta(days=options["days"])
        deleted, _ = AuditEvent.objects.filter(created_at__lt=cutoff).delete()
        self.stdout.write(f"Deleted {deleted} audit events older than {options['days']} days.")
