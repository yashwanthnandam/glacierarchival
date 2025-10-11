# Generated manually for security fix

from django.db import migrations
from django.conf import settings
from cryptography.fernet import Fernet


def encrypt_existing_secret_keys(apps, schema_editor):
    """Encrypt existing AWS secret keys"""
    S3Config = apps.get_model('api', 'S3Config')
    
    # Get encryption key
    encryption_key = getattr(settings, 'ENCRYPTION_KEY', None)
    if not encryption_key:
        print("⚠️  No ENCRYPTION_KEY found, skipping encryption of existing secret keys")
        return
    
    try:
        f = Fernet(encryption_key.encode())
        
        for s3_config in S3Config.objects.all():
            if hasattr(s3_config, 'aws_secret_key') and s3_config.aws_secret_key:
                # Encrypt the existing secret key
                encrypted_key = f.encrypt(s3_config.aws_secret_key.encode()).decode()
                s3_config.aws_secret_key_encrypted = encrypted_key
                s3_config.save()
                print(f"✅ Encrypted secret key for S3Config {s3_config.id}")
        
        print("✅ Successfully encrypted all existing AWS secret keys")
        
    except Exception as e:
        print(f"❌ Error encrypting secret keys: {str(e)}")
        raise


def reverse_encrypt_secret_keys(apps, schema_editor):
    """Reverse operation - clear encrypted secret keys (for rollback)"""
    S3Config = apps.get_model('api', 'S3Config')
    
    for s3_config in S3Config.objects.all():
        s3_config.aws_secret_key_encrypted = None
        s3_config.save()
        print(f"✅ Cleared encrypted secret key for S3Config {s3_config.id}")
    
    print("✅ Successfully cleared all encrypted AWS secret keys")


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0017_encrypt_s3_secret_keys_only'),
    ]

    operations = [
        migrations.RunPython(encrypt_existing_secret_keys, reverse_encrypt_secret_keys),
    ]
