#!/bin/bash

echo "🧪 Setting up local testing environment..."

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ AWS CLI not configured. Please run 'aws configure' first."
    exit 1
fi

# Create test user in local database
echo "👤 Creating test user..."
docker-compose -f docker-compose.local.yml exec backend python manage.py shell -c "
from django.contrib.auth.models import User
from api.models import MediaFile

# Create test user
user, created = User.objects.get_or_create(
    username='testuser',
    defaults={
        'email': 'test@example.com',
        'is_active': True
    }
)
if created:
    user.set_password('testpass123')
    user.save()
    print('✅ Test user created: testuser / testpass123')
else:
    print('ℹ️  Test user already exists')

# Create test folder
folder, created = MediaFile.objects.get_or_create(
    filename='testfolder/',
    original_filename='testfolder',
    file_type='folder',
    user=user,
    defaults={
        'relative_path': 'testfolder',
        'file_size': 0,
        'status': 'uploaded'
    }
)
if created:
    print('✅ Test folder created: testfolder')
else:
    print('ℹ️  Test folder already exists')

# Create another test folder with different relative_path
folder2, created = MediaFile.objects.get_or_create(
    filename='dehaat/',
    original_filename='dehaat',
    file_type='folder',
    user=user,
    defaults={
        'relative_path': 'dehaat',
        'file_size': 0,
        'status': 'uploaded'
    }
)
if created:
    print('✅ Test folder created: dehaat')
else:
    print('ℹ️  Test folder already exists')

print('🎉 Test data setup complete!')
"

echo ""
echo "🚀 Local testing environment ready!"
echo ""
echo "📋 Test Credentials:"
echo "   Username: testuser"
echo "   Password: testpass123"
echo ""
echo "🌐 Access URLs:"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:8000/api/"
echo ""
echo "📁 Test Folders Created:"
echo "   - testfolder"
echo "   - dehaat"
echo ""
echo "🧪 To test the folder display fix:"
echo "   1. Open http://localhost:3000"
echo "   2. Login with testuser/testpass123"
echo "   3. Check if both folders appear in the dashboard"
echo "   4. Try creating a new folder to test the fix"
