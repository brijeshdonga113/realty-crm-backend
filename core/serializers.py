# DRF Serializers

from rest_framework import serializers
from .models import Lead, FollowUp

class FollowUpSerializer(serializers.ModelSerializer):
    class Meta:
        model = FollowUp
        fields = '__all__'

class LeadSerializer(serializers.ModelSerializer):
    followups = FollowUpSerializer(many=True, read_only=True)

    class Meta:
        model = Lead
        fields = '__all__'