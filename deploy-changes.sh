#!/bin/bash

# Deploy changes to EC2 instance
# This script copies the updated files directly to the EC2 instance

INSTANCE_ID="i-0263514e81974182c"
REGION="ap-south-1"
PUBLIC_IP="3.110.26.97"

echo "🚀 Deploying changes to EC2 instance..."

# Copy updated files to EC2
echo "📂 Copying updated files..."

# Copy frontend components
scp -i ~/.ssh/datahibernate-key.pem frontend/src/components/LandingPage.jsx ec2-user@$PUBLIC_IP:/home/ec2-user/frontend/src/components/
scp -i ~/.ssh/datahibernate-key.pem frontend/src/components/ModernDashboard.jsx ec2-user@$PUBLIC_IP:/home/ec2-user/frontend/src/components/
scp -i ~/.ssh/datahibernate-key.pem frontend/src/components/Login.jsx ec2-user@$PUBLIC_IP:/home/ec2-user/frontend/src/components/
scp -i ~/.ssh/datahibernate-key.pem frontend/src/components/Register.jsx ec2-user@$PUBLIC_IP:/home/ec2-user/frontend/src/components/
scp -i ~/.ssh/datahibernate-key.pem frontend/src/components/ForgotPassword.jsx ec2-user@$PUBLIC_IP:/home/ec2-user/frontend/src/components/
scp -i ~/.ssh/datahibernate-key.pem frontend/src/components/ResetPassword.jsx ec2-user@$PUBLIC_IP:/home/ec2-user/frontend/src/components/
scp -i ~/.ssh/datahibernate-key.pem frontend/src/App.jsx ec2-user@$PUBLIC_IP:/home/ec2-user/frontend/src/
scp -i ~/.ssh/datahibernate-key.pem frontend/index.html ec2-user@$PUBLIC_IP:/home/ec2-user/frontend/
scp -i ~/.ssh/datahibernate-key.pem frontend/public/icon.png ec2-user@$PUBLIC_IP:/home/ec2-user/frontend/public/
scp -i ~/.ssh/datahibernate-key.pem frontend/nginx.conf ec2-user@$PUBLIC_IP:/home/ec2-user/frontend/

# Copy backend files
scp -i ~/.ssh/datahibernate-key.pem backend/api/models.py ec2-user@$PUBLIC_IP:/home/ec2-user/backend/api/
scp -i ~/.ssh/datahibernate-key.pem backend/api/views.py ec2-user@$PUBLIC_IP:/home/ec2-user/backend/api/
scp -i ~/.ssh/datahibernate-key.pem backend/api/urls.py ec2-user@$PUBLIC_IP:/home/ec2-user/backend/api/
scp -i ~/.ssh/datahibernate-key.pem backend/api/services.py ec2-user@$PUBLIC_IP:/home/ec2-user/backend/api/
scp -i ~/.ssh/datahibernate-key.pem backend/api/migrations/0021_passwordresettoken.py ec2-user@$PUBLIC_IP:/home/ec2-user/backend/api/migrations/
scp -i ~/.ssh/datahibernate-key.pem backend/deeparchival/security.py ec2-user@$PUBLIC_IP:/home/ec2-user/backend/deeparchival/
scp -i ~/.ssh/datahibernate-key.pem backend/api/security_middleware.py ec2-user@$PUBLIC_IP:/home/ec2-user/backend/api/
scp -i ~/.ssh/datahibernate-key.pem backend/deeparchival/settings.py ec2-user@$PUBLIC_IP:/home/ec2-user/backend/deeparchival/
scp -i ~/.ssh/datahibernate-key.pem backend/api/middleware.py ec2-user@$PUBLIC_IP:/home/ec2-user/backend/api/

# Copy docker-compose file
scp -i ~/.ssh/datahibernate-key.pem docker-compose.production.yml ec2-user@$PUBLIC_IP:/home/ec2-user/

# Copy backend .env file
scp -i ~/.ssh/datahibernate-key.pem backend/.env ec2-user@$PUBLIC_IP:/home/ec2-user/backend/

echo "✅ Files copied successfully!"

# Rebuild and restart containers
echo "🔄 Rebuilding containers..."
ssh -i ~/.ssh/datahibernate-key.pem ec2-user@$PUBLIC_IP << 'EOF'
cd /home/ec2-user

# Stop all containers
docker-compose -f docker-compose.production.yml down

# Rebuild and start backend first
echo "Building backend..."
docker-compose -f docker-compose.production.yml up -d --build backend

# Wait for backend to be ready
echo "Waiting for backend to start..."
sleep 30

# Run migrations
echo "Running migrations..."
docker-compose -f docker-compose.production.yml exec backend python manage.py migrate

# Rebuild and start frontend
echo "Building frontend..."
docker-compose -f docker-compose.production.yml up -d --build frontend

# Start other services
docker-compose -f docker-compose.production.yml up -d postgres redis

echo "✅ All containers rebuilt and started!"
EOF

echo "🎉 Deployment complete!"

