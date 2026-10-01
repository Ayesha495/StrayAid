from django.urls import path
from . import views

urlpatterns = [
    path("register-token/", views.register_push_token, name="register_push_token"),
    path("follow/animal/<int:animal_id>/", views.toggle_animal_follow, name="toggle_animal_follow"),
    path("follow/organization/<int:organization_id>/", views.toggle_organization_follow, name="toggle_organization_follow"),
    path("my-follows/", views.my_follows, name="my_follows"),
    path("follow-status/", views.follow_status, name="follow_status"),
]
