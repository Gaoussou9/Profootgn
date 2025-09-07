# profootgn/urls.py
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse

from matches.admin_views import quick_add_match_view, quick_events, quick_events_api
from players.admin_views import quick_add_players_view
from clubs.admin_views import quick_clubs, quick_roster, quick_clubs_api  # <-- ✅ on importe l'API admin

from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView


def root_ping(request):
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
            "/admin/clubs/quick/",
            "/admin/clubs/quick/<id>/",
            "/admin/clubs/quick/api/",        # <-- ✅ exposée dans le ping pour debug
        ],
    })


urlpatterns = [
    path("", root_ping, name="root"),

    # Admin Django + vues admin custom
    path("admin/matches/quick/", admin.site.admin_view(quick_add_match_view), name="admin_quick_match"),
    path("admin/players/quick/", admin.site.admin_view(quick_add_players_view), name="admin_quick_players"),
    path("admin/events/quick/", admin.site.admin_view(quick_events), name="admin_quick_events"),
    path("admin/events/api/", admin.site.admin_view(quick_events_api), name="admin_quick_events_api"),

    # 🔹 Hubs clubs rapides
    path("admin/clubs/quick/", admin.site.admin_view(quick_clubs), name="quick_clubs"),
    path("admin/clubs/quick/<int:club_id>/", admin.site.admin_view(quick_roster), name="quick_roster"),
    path("admin/clubs/quick/api/", admin.site.admin_view(quick_clubs_api), name="quick_clubs_api"),  # <-- ✅ nouvelle route

    path("admin/livefootgn/", admin.site.admin_view(quick_add_match_view), name="admin_livefootgn"),
    path("admin/", admin.site.urls),

    # Auth
    path("api/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    # APIs
    path("api/stats/", include("stats.urls")),
    path("api/", include("clubs.urls")),
    path("api/", include("players.urls")),
    path("api/", include("matches.urls")),
    path("api/", include("news.urls")),
    path("api/", include("recruitment.urls")),
    path("api/", include("users.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
