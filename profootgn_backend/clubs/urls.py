
from rest_framework.routers import DefaultRouter
from .views import ClubViewSet

router = DefaultRouter()
router.register(r'clubs', ClubViewSet, basename='club')

urlpatterns = router.urls
