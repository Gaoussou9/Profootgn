
from rest_framework.routers import DefaultRouter
from .views import MatchViewSet, GoalViewSet, CardViewSet, RoundViewSet

router = DefaultRouter()
router.register(r'matches', MatchViewSet, basename='match')
router.register(r'goals', GoalViewSet, basename='goal')
router.register(r'cards', CardViewSet, basename='card')
router.register(r'rounds', RoundViewSet, basename='round')

urlpatterns = router.urls
