from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from api.models import MediaFile
from api.services import S3Service
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Calculate storage costs in Indian Rupees (INR) with GST'

    def add_arguments(self, parser):
        parser.add_argument(
            '--user',
            type=str,
            help='Calculate costs for specific user only',
        )
        parser.add_argument(
            '--gst-rate',
            type=float,
            default=18.0,
            help='GST rate percentage (default: 18.0)',
        )

    def handle(self, *args, **options):
        user_filter = options.get('user')
        gst_rate = options['gst_rate']
        
        self.stdout.write(
            self.style.SUCCESS('Calculating storage costs in INR with GST...')
        )
        
        # Get users to process
        if user_filter:
            try:
                users = [User.objects.get(username=user_filter)]
            except User.DoesNotExist:
                self.stdout.write(
                    self.style.ERROR(f'User "{user_filter}" not found')
                )
                return
        else:
            users = User.objects.all()
        
        for user in users:
            self.calculate_user_costs_inr(user, gst_rate)

    def calculate_user_costs_inr(self, user, gst_rate):
        """Calculate costs in INR for a specific user"""
        files = MediaFile.objects.filter(user=user, is_deleted=False)
        
        if not files.exists():
            self.stdout.write(f'No files found for user: {user.username}')
            return
        
        # INR pricing (as of 2024) - per GB per month
        pricing_inr = {
            'standard': 1.92,      # ₹1.92/GB/month (S3 Standard)
            'ia': 1.04,            # ₹1.04/GB/month (S3 Standard-IA)
            'glacier': 0.33,       # ₹0.33/GB/month (S3 Glacier)
            'deep_archive': 0.08   # ₹0.08/GB/month (S3 Glacier Deep Archive)
        }
        
        total_cost_inr = 0
        cost_breakdown = {
            'standard': 0,
            'ia': 0,
            'glacier': 0,
            'deep_archive': 0
        }
        
        for file in files:
            file_size_gb = file.file_size / (1024 ** 3)
            
            if file.status == 'uploaded':
                tier = 'standard'
            elif file.status == 'archived':
                tier = 'deep_archive'
            else:
                tier = 'standard'
            
            monthly_cost_inr = file_size_gb * pricing_inr[tier]
            cost_breakdown[tier] += monthly_cost_inr
            total_cost_inr += monthly_cost_inr
        
        # Calculate GST
        gst_amount = total_cost_inr * (gst_rate / 100)
        total_with_gst = total_cost_inr + gst_amount
        
        self.stdout.write(f'\n--- Cost Analysis for {user.username} ---')
        self.stdout.write(f'Total Storage Cost (before GST): ₹{total_cost_inr:.2f}')
        self.stdout.write(f'GST ({gst_rate}%): ₹{gst_amount:.2f}')
        self.stdout.write(f'Total Cost (with GST): ₹{total_with_gst:.2f}')
        self.stdout.write(f'Total Files: {files.count()}')
        self.stdout.write(f'Total Storage: {sum(f.file_size for f in files) / (1024**3):.2f} GB')
        
        self.stdout.write('\nCost Breakdown by Tier:')
        for tier, cost in cost_breakdown.items():
            if cost > 0:
                self.stdout.write(f'  {tier.replace("_", " ").title()}: ₹{cost:.2f}')
        
        # Show potential savings
        if cost_breakdown['standard'] > 0:
            potential_savings = cost_breakdown['standard'] - (cost_breakdown['standard'] * pricing_inr['deep_archive'] / pricing_inr['standard'])
            self.stdout.write(f'\nPotential Savings (if all files hibernated): ₹{potential_savings:.2f}/month')
