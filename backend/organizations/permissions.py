from rest_framework.permissions import BasePermission


class IsOrganizationUser(BasePermission):
    message = "Organization access is required."

    def has_permission(self, request, view):
        user = request.user
        # The role alone isn't enough: every organization view works on the team's own profile.
        return bool(
            user and user.is_authenticated and user.role == "organization" and getattr(user, "organization_profile", None)
        )
