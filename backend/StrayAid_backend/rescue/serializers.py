from rest_framework import serializers
from .models import Case, Report

class ReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Report
        fields = '__all__'

class CaseSerializer(serializers.ModelSerializer):
    reports = ReportSerializer(many = True, read_only = True)

    class Meta:
        model = Case
        fields = '__all__'
