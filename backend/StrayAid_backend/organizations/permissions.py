from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsOrganizationUser(BasePermission):
    message = "Organization access is required."

    def has_permission(self, request, view):
        # A role check is enough because the profile is enforced elsewhere.
        user = request.user
        return bool(user and user.is_authenticated and user.role == "organization")


class IsOrganizationOwnerOrReadOnly(BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        # Writable organization objects should belong to the current user.
        return getattr(obj, "user_id", None) == request.user.id
