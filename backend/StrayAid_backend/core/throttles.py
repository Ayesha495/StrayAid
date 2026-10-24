from rest_framework.throttling import SimpleRateThrottle


class ClientRateThrottle(SimpleRateThrottle):
    """Counts requests per client IP whether or not they are signed in, for endpoints that
    guess-and-check passwords or codes."""

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class AuthRateThrottle(ClientRateThrottle):
    scope = "auth"


class PasswordResetRateThrottle(ClientRateThrottle):
    scope = "password_reset"
