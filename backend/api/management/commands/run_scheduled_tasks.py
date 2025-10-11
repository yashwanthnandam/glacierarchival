from django.core.management.base import BaseCommand
from django.core.management import call_command
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Run scheduled tasks for auto-hibernation and cleanup'

    def add_arguments(self, parser):
        parser.add_argument(
            '--task',
            type=str,
            choices=['auto_hibernate', 'cleanup', 'all'],
            default='all',
            help='Which task to run (default: all)',
        )

    def handle(self, *args, **options):
        task = options['task']
        
        self.stdout.write(
            self.style.SUCCESS(f'Starting scheduled tasks: {task}')
        )
        
        if task in ['auto_hibernate', 'all']:
            self.stdout.write('Running auto-hibernation...')
            try:
                call_command('auto_hibernate', '--days=30', '--min-size=10485760')
                self.stdout.write(
                    self.style.SUCCESS('Auto-hibernation completed successfully')
                )
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'Auto-hibernation failed: {e}')
                )
        
        if task in ['cleanup', 'all']:
            self.stdout.write('Running cleanup...')
            try:
                call_command('cleanup_orphaned_files')
                self.stdout.write(
                    self.style.SUCCESS('Cleanup completed successfully')
                )
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'Cleanup failed: {e}')
                )
        
        self.stdout.write(
            self.style.SUCCESS('Scheduled tasks completed')
        )
