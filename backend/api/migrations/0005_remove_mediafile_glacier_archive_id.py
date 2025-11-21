from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0004_add_archive_bundle'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='mediafile',
            name='glacier_archive_id',
        ),
    ]


