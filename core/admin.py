from django.contrib import admin
from .models import Lead, FollowUp

@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'email', 'source', 'status', 'created_at')
    search_fields = ('name', 'email', 'source')
    list_filter = ('status', 'source')

@admin.register(FollowUp)
class FollowUpAdmin(admin.ModelAdmin):
    list_display = ('id', 'lead', 'follow_up_date', 'notes')
    search_fields = ('lead__name',)
    list_filter = ('follow_up_date',)