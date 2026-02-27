from google.oauth2 import id_token
from google.auth.transport import requests
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.conf import settings
from .models import User
from rest_framework_simplejwt.tokens import RefreshToken

@api_view(['POST'])
def google_login(request):
    token = request.data.get("token")

    try:
        idinfo = id_token.verify_oauth2_token(
            token,
            requests.Request(),
            "998658289609-9afrhr6aesljjbf2o9kdbc10k6vlq1ac.apps.googleusercontent.com"
        )

        email = idinfo['email']
        name = idinfo.get('name', '')

        user, created = User.objects.get_or_create(
            username=email,
            defaults={
                'email': email,
                'first_name': name
            }
        )

        refresh = RefreshToken.for_user(user)

        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        })

    except ValueError:
        return Response({"error": "Invalid token"}, status=400)