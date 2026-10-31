from django.conf import settings
from rest_framework.settings import api_settings
from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle, UserRateThrottle


def client_ip(request):
    """Who is really calling. Clients can write anything into X-Forwarded-For, and a rate limit
    keyed on a forged value is no limit at all, so only an address a trusted proxy wrote counts:
    the host's own header when it sets one (CLIENT_IP_HEADER), otherwise the entry NUM_PROXIES
    from the end of X-Forwarded-For, otherwise the connection itself."""
    meta = getattr(request, "META", {})
    header = getattr(settings, "CLIENT_IP_HEADER", "")
    if header and meta.get(header):
        return meta[header].split(",")[0].strip()
    forwarded = meta.get("HTTP_X_FORWARDED_FOR")
    proxies = api_settings.NUM_PROXIES
    if forwarded and proxies:
        addresses = [address.strip() for address in forwarded.split(",")]
        return addresses[-min(proxies, len(addresses))]
    return meta.get("REMOTE_ADDR", "")


class TrustedIpMixin:
    def get_ident(self, request):
        return client_ip(request)


class AnonymousRateThrottle(TrustedIpMixin, AnonRateThrottle):
    pass


class SignedInRateThrottle(TrustedIpMixin, UserRateThrottle):
    pass


class ClientRateThrottle(TrustedIpMixin, SimpleRateThrottle):
    """Counts requests per client IP whether or not they are signed in, for endpoints that
    guess-and-check passwords or codes."""

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class AuthRateThrottle(ClientRateThrottle):
    scope = "auth"


class PasswordResetRateThrottle(ClientRateThrottle):
    scope = "password_reset"


class SearchRateThrottle(ClientRateThrottle):
    """Search scans text columns, so it gets a tighter limit than ordinary reads."""

    scope = "search"
