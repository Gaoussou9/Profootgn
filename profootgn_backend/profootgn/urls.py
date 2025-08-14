# profootgn/urls.py
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse

from matches.admin_views import quick_add_match_view
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView


def root_ping(request):
    """Petit JSON d’accueil pour éviter le 404 sur / (facultatif)."""
    return JsonResponse({
        "name": "ProFootGN API",
        "admin": "/admin/",
        "auth": {
            "token": "/api/auth/token/",
            "refresh": "/api/auth/token/refresh/",
        },
        "endpoints": [
            "/api/",
            "/api/stats/",
        ],
    })


urlpatterns = [
    # Accueil API
    path("", root_ping, name="root"),

    # --- VUES ADMIN CUSTOM (doivent être AVANT admin.site.urls) ---
    path("admin/matches/quick/", admin.site.admin_view(quick_add_match_view), name="admin_quick_match"),
    path("admin/livefootgn/",   admin.site.admin_view(quick_add_match_view), name="admin_livefootgn"),

    # Admin Django
    path("admin/", admin.site.urls),

    # Auth JWT
    path("api/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    # API des apps
    path("api/", include("clubs.urls")),
    path("api/", include("players.urls")),
    path("api/", include("matches.urls")),
    path("api/stats/", include("stats.urls")),   # /api/stats/standings/, /api/stats/topscorers/
    path("api/", include("news.urls")),
    path("api/", include("recruitment.urls")),
    path("api/", include("users.urls")),
]

# Fichiers médias en dev
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
