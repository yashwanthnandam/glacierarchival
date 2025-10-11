from django.core.management.base import BaseCommand
from api.models import HibernationPlan


class Command(BaseCommand):
    help = 'Populate hibernation plans with the specified pricing structure'

    def handle(self, *args, **options):
        # Clear existing plans
        HibernationPlan.objects.all().delete()
        
        plans_data = [
            # Deep Freeze Plans
            {
                'name': 'deep_freeze',
                'storage_tier': '100gb',
                'aws_storage_type': 'deep_archive',
                'restore_time_hours': 12,
                'user_cost_inr': 199.00,
                'annual_price_inr': 599.00,
                'margin_inr': 400.00,
                'free_retrieval_gb': 10,
                'retrieval_period_months': 6,
                'user_message': 'Your data sleeps safely — wake it only when needed.',
                'description': 'For: Long-term backups, memories, records — "Upload & Forget." Storage: AWS Glacier Deep Archive',
                'monthly_price_inr': 199.00,
                'storage_limit_gb': 100,
                'aws_storage_class': 'DEEP_ARCHIVE',
                'retrieval_policy': '12-hour restore time, 6-month retrieval period, 10GB free retrieval per month'
            },
            {
                'name': 'deep_freeze',
                'storage_tier': '500gb',
                'aws_storage_type': 'deep_archive',
                'restore_time_hours': 12,
                'user_cost_inr': 1020.00,
                'annual_price_inr': 1799.00,
                'margin_inr': 779.00,
                'free_retrieval_gb': 10,
                'retrieval_period_months': 6,
                'user_message': 'Your data sleeps safely — wake it only when needed.',
                'description': 'For: Long-term backups, memories, records — "Upload & Forget." Storage: AWS Glacier Deep Archive',
                'monthly_price_inr': 1020.00,
                'storage_limit_gb': 500,
                'aws_storage_class': 'DEEP_ARCHIVE',
                'retrieval_policy': '12-hour restore time, 6-month retrieval period, 10GB free retrieval per month'
            },
            {
                'name': 'deep_freeze',
                'storage_tier': '1tb',
                'aws_storage_type': 'deep_archive',
                'restore_time_hours': 12,
                'user_cost_inr': 2039.00,
                'annual_price_inr': 2999.00,
                'margin_inr': 960.00,
                'free_retrieval_gb': 10,
                'retrieval_period_months': 6,
                'user_message': 'Your data sleeps safely — wake it only when needed.',
                'description': 'For: Long-term backups, memories, records — "Upload & Forget." Storage: AWS Glacier Deep Archive',
                'monthly_price_inr': 2039.00,
                'storage_limit_gb': 1024,
                'aws_storage_class': 'DEEP_ARCHIVE',
                'retrieval_policy': '12-hour restore time, 6-month retrieval period, 10GB free retrieval per month'
            },
            
            # Flexible Archive Plans
            {
                'name': 'flexible_archive',
                'storage_tier': '100gb',
                'aws_storage_type': 'glacier_flexible',
                'restore_time_hours': 6,
                'user_cost_inr': 448.00,
                'annual_price_inr': 1079.00,
                'margin_inr': 631.00,
                'free_retrieval_gb': 10,
                'retrieval_period_months': 1,
                'user_message': 'Your data wakes up when you call it — within a few hours.',
                'description': 'For: Backups you open once in a while — flexible and affordable Storage: AWS Glacier Flexible Retrieval',
                'monthly_price_inr': 448.00,
                'storage_limit_gb': 100,
                'aws_storage_class': 'GLACIER',
                'retrieval_policy': '6-hour restore time, 1-month retrieval period, 10GB free retrieval per month'
            },
            {
                'name': 'flexible_archive',
                'storage_tier': '500gb',
                'aws_storage_type': 'glacier_flexible',
                'restore_time_hours': 6,
                'user_cost_inr': 2752.00,
                'annual_price_inr': 2879.00,
                'margin_inr': 127.00,
                'free_retrieval_gb': 10,
                'retrieval_period_months': 1,
                'user_message': 'Your data wakes up when you call it — within a few hours.',
                'description': 'For: Backups you open once in a while — flexible and affordable Storage: AWS Glacier Flexible Retrieval',
                'monthly_price_inr': 2752.00,
                'storage_limit_gb': 500,
                'aws_storage_class': 'GLACIER',
                'retrieval_policy': '6-hour restore time, 1-month retrieval period, 10GB free retrieval per month'
            },
            {
                'name': 'flexible_archive',
                'storage_tier': '1tb',
                'aws_storage_type': 'glacier_flexible',
                'restore_time_hours': 6,
                'user_cost_inr': 4587.00,
                'annual_price_inr': 4799.00,
                'margin_inr': 212.00,
                'free_retrieval_gb': 10,
                'retrieval_period_months': 1,
                'user_message': 'Your data wakes up when you call it — within a few hours.',
                'description': 'For: Backups you open once in a while — flexible and affordable Storage: AWS Glacier Flexible Retrieval',
                'monthly_price_inr': 4587.00,
                'storage_limit_gb': 1024,
                'aws_storage_class': 'GLACIER',
                'retrieval_policy': '6-hour restore time, 1-month retrieval period, 10GB free retrieval per month'
            },
            
            # Instant Archive Plans
            {
                'name': 'instant_archive',
                'storage_tier': '100gb',
                'aws_storage_type': 'glacier_instant',
                'restore_time_hours': 0,
                'user_cost_inr': 510.00,
                'annual_price_inr': 1499.00,
                'margin_inr': 989.00,
                'free_retrieval_gb': 0,
                'retrieval_period_months': 0,
                'user_message': 'Your files never sleep — ready when you are.',
                'description': 'For: Data you might need anytime — instant, reliable, affordable Storage: AWS Glacier Instant Retrieval',
                'monthly_price_inr': 510.00,
                'storage_limit_gb': 100,
                'aws_storage_class': 'STANDARD',
                'retrieval_policy': 'Instant restore time, unlimited retrieval, no restrictions'
            },
            {
                'name': 'instant_archive',
                'storage_tier': '500gb',
                'aws_storage_type': 'glacier_instant',
                'restore_time_hours': 0,
                'user_cost_inr': 3133.00,
                'annual_price_inr': 3599.00,
                'margin_inr': 466.00,
                'free_retrieval_gb': 0,
                'retrieval_period_months': 0,
                'user_message': 'Your files never sleep — ready when you are.',
                'description': 'For: Data you might need anytime — instant, reliable, affordable Storage: AWS Glacier Instant Retrieval',
                'monthly_price_inr': 3133.00,
                'storage_limit_gb': 500,
                'aws_storage_class': 'STANDARD',
                'retrieval_policy': 'Instant restore time, unlimited retrieval, no restrictions'
            },
            {
                'name': 'instant_archive',
                'storage_tier': '1tb',
                'aws_storage_type': 'glacier_instant',
                'restore_time_hours': 0,
                'user_cost_inr': 5222.00,
                'annual_price_inr': 5999.00,
                'margin_inr': 777.00,
                'free_retrieval_gb': 0,
                'retrieval_period_months': 0,
                'user_message': 'Your files never sleep — ready when you are.',
                'description': 'For: Data you might need anytime — instant, reliable, affordable Storage: AWS Glacier Instant Retrieval',
                'monthly_price_inr': 5222.00,
                'storage_limit_gb': 1024,
                'aws_storage_class': 'STANDARD',
                'retrieval_policy': 'Instant restore time, unlimited retrieval, no restrictions'
            },
        ]
        
        created_count = 0
        for plan_data in plans_data:
            plan, created = HibernationPlan.objects.get_or_create(
                name=plan_data['name'],
                storage_tier=plan_data['storage_tier'],
                defaults=plan_data
            )
            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f'Created plan: {plan}')
                )
            else:
                self.stdout.write(
                    self.style.WARNING(f'Plan already exists: {plan}')
                )
        
        self.stdout.write(
            self.style.SUCCESS(f'Successfully created {created_count} hibernation plans')
        )