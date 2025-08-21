# profootgn/urls.py
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse

from matches.admin_views import quick_add_match_view
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
        ],
    })

urlpatterns = [
    path("", root_ping, name="root"),

    # vues admin custom
    path("admin/matches/quick/", admin.site.admin_view(quick_add_match_view), name="admin_quick_match"),
    path("admin/livefootgn/",   admin.site.admin_view(quick_add_match_view), name="admin_livefootgn"),

    # admin Django
    path("admin/", admin.site.urls),

    # auth JWT
    path("api/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    # APIs des apps
    path("api/", include("clubs.urls")),
    path("api/", include("players.urls")),
    path("api/", include("matches.urls")),   # <- OK, pas de double /api/ dans matches/urls.py
    path("api/stats/", include("stats.urls")),
    path("api/", include("news.urls")),
    path("api/", include("recruitment.urls")),
    path("api/", include("users.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
