from django.core.management.base import BaseCommand
from api.models import UserHibernationPlan
from django.utils import timezone


class Command(BaseCommand):
    help = 'Reset retrieval periods for all users based on their plan settings'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be reset without actually doing it',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No changes will be made'))
        
        # Get all active user plans
        user_plans = UserHibernationPlan.objects.filter(is_active=True)
        
        reset_count = 0
        for user_plan in user_plans:
            plan = user_plan.plan
            
            # Check if retrieval period needs to be reset
            if plan.retrieval_period_months > 0:
                # Calculate if period has expired
                period_days = plan.retrieval_period_months * 30  # Approximate
                period_end = user_plan.retrieval_period_start + timezone.timedelta(days=period_days)
                
                if timezone.now() > period_end:
                    if dry_run:
                        self.stdout.write(
                            f"Would reset retrieval period for {user_plan.user.username} "
                            f"(plan: {plan.name}, {plan.storage_tier})"
                        )
                    else:
                        user_plan.reset_retrieval_period()
                        self.stdout.write(
                            f"Reset retrieval period for {user_plan.user.username} "
                            f"(plan: {plan.name}, {plan.storage_tier})"
                        )
                    reset_count += 1
        
        if dry_run:
            self.stdout.write(
                self.style.SUCCESS(f'Would reset {reset_count} retrieval periods')
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(f'Successfully reset {reset_count} retrieval periods')
            )
