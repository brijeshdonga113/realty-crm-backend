from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Lead, FollowUp
from .serializers import LeadSerializer, FollowUpSerializer

class LeadViewSet(viewsets.ModelViewSet):
    queryset = Lead.objects.all().order_by('-created_at')
    serializer_class = LeadSerializer
    permission_classes = [IsAuthenticated]

class FollowUpViewSet(viewsets.ModelViewSet):
    queryset = FollowUp.objects.all()
    serializer_class = FollowUpSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        lead_id = self.kwargs.get('lead_pk') or self.request.query_params.get('lead_id')
        if lead_id:
            return FollowUp.objects.filter(lead_id=lead_id).order_by('-follow_up_date')
        return FollowUp.objects.none()

    def perform_create(self, serializer):
        lead_id = self.kwargs.get('lead_pk')
        if lead_id:
            lead = Lead.objects.get(pk=lead_id)
            serializer.save(lead=lead)
        else:
            serializer.save()