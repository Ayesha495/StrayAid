from rest_framework.permissions import BasePermission


class IsOrganizationUser(BasePermission):
    message = "Organization access is required."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role == "organization")
