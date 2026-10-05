from django.apps import AppConfig


class RescueConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'rescue'

    def ready(self):
        from .models import Case
        from .signals import connect_signals

        connect_signals(Case)

        # Load the AI model while the server starts (runserver's worker process or gunicorn),
        # not for migrations, tests or other management commands.
        import os
        import sys

        if os.environ.get("RUN_MAIN") == "true" or "gunicorn" in os.path.basename(sys.argv[0]):
            from .ai.detector import warm_up

            warm_up()
