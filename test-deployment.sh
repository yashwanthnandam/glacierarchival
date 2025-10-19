#!/bin/bash

# Test Deployment Script
# This script helps test the deployment process locally before pushing to GitHub

set -e

echo "🧪 Testing deployment configuration..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "docker-compose.production.yml" ]; then
    log_error "docker-compose.production.yml not found. Please run this script from the project root."
    exit 1
fi

# Check if .env file exists
if [ ! -f "backend/.env" ]; then
    log_error "backend/.env file not found. Please create it with required environment variables."
    exit 1
fi

log_info "Checking Docker Compose configuration..."
if docker-compose -f docker-compose.production.yml config > /dev/null 2>&1; then
    log_success "Docker Compose configuration is valid"
else
    log_error "Docker Compose configuration has errors"
    exit 1
fi

log_info "Checking frontend build..."
cd frontend
if npm run build > /dev/null 2>&1; then
    log_success "Frontend builds successfully"
else
    log_error "Frontend build failed"
    exit 1
fi
cd ..

log_info "Checking backend models..."
# Check if virtual environment exists
if [ -d "venv" ]; then
    log_info "Activating virtual environment..."
    source venv/bin/activate
fi

cd backend
if python manage.py check > /dev/null 2>&1; then
    log_success "Django models are valid"
else
    log_error "Django models have errors"
    log_info "Run 'source venv/bin/activate && cd backend && python manage.py check' for details"
    exit 1
fi

log_info "Checking for pending migrations..."
if python manage.py makemigrations --check --dry-run > /dev/null 2>&1; then
    log_success "No pending migrations"
else
    log_info "Pending migrations found (this is normal for development)"
fi
cd ..

log_success "All deployment checks passed!"
log_info "You can now safely push to GitHub for deployment."

echo ""
echo "🚀 Next steps:"
echo "1. git add ."
echo "2. git commit -m 'Fix deployment pipeline'"
echo "3. git push origin main"
echo ""
echo "📊 Monitor deployment at: https://github.com/yashwanthnandam/glacierarchival/actions"
