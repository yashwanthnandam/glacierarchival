from rest_framework import serializers
from django.contrib.auth.models import User
from .models import MediaFile, ArchiveJob, S3Config

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password', 'first_name', 'last_name')

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', '')
        )
        return user

class S3ConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = S3Config
        fields = ('id', 'bucket_name', 'aws_access_key', 'aws_secret_key', 'region', 'created_at', 'updated_at')
        extra_kwargs = {
            'aws_secret_key': {'write_only': True}
        }

class MediaFileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = MediaFile
        fields = ('id', 'filename', 'original_filename', 'file_size', 'file_type', 's3_key', 'status', 'uploaded_at', 'archived_at', 'description', 'username')
        read_only_fields = ('uploaded_at', 'archived_at', 'status', 's3_key')

class ArchiveJobSerializer(serializers.ModelSerializer):
    media_file_name = serializers.CharField(source='media_file.original_filename', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = ArchiveJob
        fields = ('id', 'job_type', 'status', 'started_at', 'completed_at', 'error_message', 'progress', 'media_file', 'media_file_name', 'username')
        read_only_fields = ('started_at', 'completed_at', 'progress')
