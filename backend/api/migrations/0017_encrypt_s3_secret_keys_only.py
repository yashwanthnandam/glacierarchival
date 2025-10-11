# Generated manually for security fix

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0016_add_missing_price_columns'),
    ]

    operations = [
        # Add the encrypted field
        migrations.AddField(
            model_name='s3config',
            name='aws_secret_key_encrypted',
            field=models.TextField(blank=True, null=True),
        ),
        # Remove the plain text field
        migrations.RemoveField(
            model_name='s3config',
            name='aws_secret_key',
        ),
    ]