#!/bin/bash

# Production Razorpay Setup Script
# This script helps you set up Razorpay for production

echo "🚀 Setting up Production Razorpay Integration..."

# Check if required environment variables are set
check_env_var() {
    if [ -z "${!1}" ]; then
        echo "❌ Error: $1 is not set"
        echo "Please set $1 in your environment or .env file"
        exit 1
    else
        echo "✅ $1 is set"
    fi
}

echo "📋 Checking environment variables..."

# Check production environment variables
if [ "$ENVIRONMENT" = "production" ]; then
    check_env_var "RAZORPAY_KEY_ID"
    check_env_var "RAZORPAY_KEY_SECRET"
else
    echo "ℹ️  Running in development mode"
    check_env_var "RAZORPAY_TEST_KEY_ID"
    check_env_var "RAZORPAY_TEST_KEY_SECRET"
fi

echo ""
echo "🔧 Setting up backend..."

# Install Python dependencies
echo "Installing Python dependencies..."
pip install razorpay python-dotenv

# Run database migrations
echo "Running database migrations..."
python manage.py makemigrations
python manage.py migrate

# Create superuser if needed
echo "Creating superuser (if needed)..."
python manage.py shell -c "
from django.contrib.auth.models import User
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@example.com', 'admin123')
    print('Superuser created: admin/admin123')
else:
    print('Superuser already exists')
"

echo ""
echo "🎨 Setting up frontend..."

# Install frontend dependencies
cd frontend
npm install razorpay

# Build frontend
echo "Building frontend..."
npm run build

cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Get your Razorpay credentials from https://razorpay.com/"
echo "2. Update your .env files with real credentials"
echo "3. Configure webhook URL: https://yourdomain.com/api/payments/webhook/"
echo "4. Test payments with test cards"
echo "5. Deploy to production server"
echo ""
echo "🧪 Test Cards:"
echo "Success: 4111 1111 1111 1111"
echo "Failure: 4000 0000 0000 0002"
echo "CVV: Any 3 digits"
echo "Expiry: Any future date"
