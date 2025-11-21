# Generated migration for FileBatchJob unified progress tracking
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('api', '0005_remove_mediafile_glacier_archive_id'),
    ]

    operations = [
        migrations.CreateModel(
            name='FileBatchJob',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('operation', models.CharField(choices=[('upload', 'Upload'), ('delete', 'Delete'), ('archive', 'Archive'), ('restore', 'Restore')], db_index=True, max_length=20)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('in_progress', 'In Progress'), ('completed', 'Completed'), ('failed', 'Failed'), ('cancelled', 'Cancelled')], db_index=True, default='pending', max_length=20)),
                ('total_files', models.IntegerField(default=0, help_text='Total files in this batch')),
                ('processed_files', models.IntegerField(default=0, help_text='Files processed (success + failed)')),
                ('succeeded_files', models.IntegerField(default=0, help_text='Successfully processed files')),
                ('failed_files', models.IntegerField(default=0, help_text='Failed files')),
                ('total_size_bytes', models.BigIntegerField(default=0, help_text='Total size of all files')),
                ('processed_size_bytes', models.BigIntegerField(default=0, help_text='Size processed so far')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('started_at', models.DateTimeField(blank=True, null=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('error_message', models.TextField(blank=True, null=True)),
                ('failed_file_ids', models.JSONField(default=list, help_text='List of failed file IDs')),
                ('user', models.ForeignKey(db_index=True, on_delete=django.db.models.deletion.CASCADE, related_name='file_batches', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'File Batch Job',
                'verbose_name_plural': 'File Batch Jobs',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='filebatchjob',
            index=models.Index(fields=['user', 'status'], name='api_filebat_user_status_idx'),
        ),
        migrations.AddIndex(
            model_name='filebatchjob',
            index=models.Index(fields=['user', 'operation'], name='api_filebat_user_op_idx'),
        ),
        migrations.AddIndex(
            model_name='filebatchjob',
            index=models.Index(fields=['status', 'created_at'], name='api_filebat_status_created_idx'),
        ),
        migrations.AddField(
            model_name='mediafile',
            name='batch_job',
            field=models.ForeignKey(blank=True, help_text='Batch job this file belongs to', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='files', to='api.filebatchjob'),
        ),
    ]

