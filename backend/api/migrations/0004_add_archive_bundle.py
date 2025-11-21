# Generated migration for Archive Bundle feature
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('api', '0003_alter_bulkdownloadjob_options_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='ArchiveBundle',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('bundle_name', models.CharField(help_text='Unique bundle name/ID', max_length=255)),
                ('s3_key', models.CharField(help_text='S3 key for the ZIP bundle', max_length=500)),
                ('glacier_archive_id', models.CharField(blank=True, help_text='Glacier archive ID for the ZIP', max_length=255, null=True)),
                ('status', models.CharField(choices=[('creating', 'Creating'), ('archived', 'Archived'), ('restoring', 'Restoring'), ('restored', 'Restored'), ('failed', 'Failed')], db_index=True, default='creating', max_length=20)),
                ('total_files', models.IntegerField(default=0, help_text='Number of files in this bundle')),
                ('total_size_bytes', models.BigIntegerField(default=0, help_text='Total size of all files in bundle')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('archived_at', models.DateTimeField(blank=True, help_text='When bundle was archived to Glacier', null=True)),
                ('restored_at', models.DateTimeField(blank=True, help_text='When bundle was restored', null=True)),
                ('restore_tier', models.CharField(blank=True, help_text='Glacier restore tier used', max_length=20, null=True)),
                ('estimated_completion', models.DateTimeField(blank=True, help_text='Estimated restore completion time', null=True)),
                ('user', models.ForeignKey(db_index=True, on_delete=django.db.models.deletion.CASCADE, related_name='archive_bundles', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Archive Bundle',
                'verbose_name_plural': 'Archive Bundles',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='archivebundle',
            index=models.Index(fields=['user', 'status'], name='api_archive_bundle_user_status_idx'),
        ),
        migrations.AddIndex(
            model_name='archivebundle',
            index=models.Index(fields=['user', 'created_at'], name='api_archive_bundle_user_created_idx'),
        ),
        migrations.AddField(
            model_name='mediafile',
            name='archive_bundle',
            field=models.ForeignKey(blank=True, help_text='Archive bundle this file belongs to', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='files', to='api.archivebundle'),
        ),
        migrations.AlterField(
            model_name='mediafile',
            name='glacier_archive_id',
            field=models.CharField(blank=True, help_text='Glacier archive ID (deprecated - use bundle)', max_length=255, null=True),
        ),
    ]

