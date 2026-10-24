from django.urls import path
from . import views

urlpatterns = [
    path("", views.notification_list, name="notification_list"),
    path("unread-counts/", views.unread_counts, name="notification_unread_counts"),
    path("<int:notification_id>/read/", views.mark_notification_read, name="notification_read"),
    path("read-all/", views.mark_all_notifications_read, name="notification_read_all"),
    path("clear-read/", views.clear_read_notifications, name="notification_clear_read"),
    path("register-token/", views.register_push_token, name="register_push_token"),
    path("follow/animal/<int:animal_id>/", views.toggle_animal_follow, name="toggle_animal_follow"),
    path("follow/organization/<int:organization_id>/", views.toggle_organization_follow, name="toggle_organization_follow"),
    path("my-follows/", views.my_follows, name="my_follows"),
    path("follow-status/", views.follow_status, name="follow_status"),
]
