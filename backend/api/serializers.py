from rest_framework import serializers
from django.contrib.auth.models import User
from .models import MediaFile, ArchiveJob, S3Config, HibernationPlan, UserHibernationPlan, Payment

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
    file_size_mb = serializers.ReadOnlyField()
    is_archived = serializers.ReadOnlyField()
    is_restored = serializers.ReadOnlyField()

    class Meta:
        model = MediaFile
        fields = (
            'id', 'filename', 'original_filename', 'file_size', 'file_size_mb', 
            'file_type', 's3_key', 'status', 'uploaded_at', 'archived_at', 
            'description', 'username', 'checksum', 'is_archived', 'is_restored', 'relative_path'
        )
        read_only_fields = ('uploaded_at', 'archived_at', 'status', 's3_key', 'checksum')

class ArchiveJobSerializer(serializers.ModelSerializer):
    media_file_name = serializers.CharField(source='media_file.original_filename', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    duration = serializers.ReadOnlyField()
    is_completed = serializers.ReadOnlyField()
    is_failed = serializers.ReadOnlyField()

    class Meta:
        model = ArchiveJob
        fields = (
            'id', 'job_type', 'status', 'started_at', 'completed_at', 
            'error_message', 'progress', 'media_file', 'media_file_name', 
            'username', 'retry_count', 'duration', 'is_completed', 'is_failed'
        )
        read_only_fields = ('started_at', 'completed_at', 'progress', 'retry_count')


class HibernationPlanSerializer(serializers.ModelSerializer):
    storage_size_bytes = serializers.ReadOnlyField()
    monthly_cost_usd = serializers.ReadOnlyField()
    
    class Meta:
        model = HibernationPlan
        fields = (
            'id', 'name', 'storage_tier', 'aws_storage_type', 'restore_time_hours',
            'user_cost_inr', 'annual_price_inr', 'margin_inr', 'free_retrieval_gb',
            'retrieval_period_months', 'user_message', 'description', 'is_active', 
            'storage_size_bytes', 'monthly_cost_usd', 'created_at', 'updated_at'
        )
        read_only_fields = ('created_at', 'updated_at')


class PaymentSerializer(serializers.ModelSerializer):
    """Serializer for Payment model"""
    hibernation_plan = HibernationPlanSerializer(read_only=True)
    hibernation_plan_id = serializers.IntegerField(write_only=True)
    
    class Meta:
        model = Payment
        fields = (
            'id', 'user', 'hibernation_plan', 'hibernation_plan_id', 'user_hibernation_plan',
            'razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature',
            'amount_inr', 'currency', 'payment_method', 'status',
            'created_at', 'updated_at', 'paid_at'
        )
        read_only_fields = ('id', 'user', 'user_hibernation_plan', 'razorpay_payment_id', 
                          'razorpay_signature', 'status', 'created_at', 'updated_at', 'paid_at')


class CreatePaymentSerializer(serializers.Serializer):
    """Serializer for creating payment orders"""
    plan_id = serializers.IntegerField()
    amount_inr = serializers.DecimalField(max_digits=10, decimal_places=2)
    currency = serializers.CharField(default='INR')
    
    def validate_plan_id(self, value):
        try:
            plan = HibernationPlan.objects.get(id=value, is_active=True)
            return value
        except HibernationPlan.DoesNotExist:
            raise serializers.ValidationError("Invalid plan ID")


class VerifyPaymentSerializer(serializers.Serializer):
    """Serializer for verifying payments"""
    razorpay_order_id = serializers.CharField()
    razorpay_payment_id = serializers.CharField()
    razorpay_signature = serializers.CharField()


class UserHibernationPlanSerializer(serializers.ModelSerializer):
    plan = HibernationPlanSerializer(read_only=True)
    plan_id = serializers.IntegerField(write_only=True)
    storage_used_percentage = serializers.ReadOnlyField()
    retrieval_remaining_gb = serializers.ReadOnlyField()
    
    class Meta:
        model = UserHibernationPlan
        fields = (
            'id', 'plan', 'plan_id', 'subscribed_at', 'expires_at', 'is_active',
            'storage_used_bytes', 'retrieval_used_gb', 'retrieval_period_start',
            'storage_used_percentage', 'retrieval_remaining_gb'
        )
        read_only_fields = ('subscribed_at', 'storage_used_bytes', 'retrieval_used_gb', 'retrieval_period_start')
    
    def create(self, validated_data):
        plan_id = validated_data.pop('plan_id')
        plan = HibernationPlan.objects.get(id=plan_id)
        validated_data['plan'] = plan
        return super().create(validated_data)


