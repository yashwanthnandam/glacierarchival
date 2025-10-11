#!/bin/bash

# Glacier Archival Setup Script
# This script sets up the development environment for the Glacier Archival project

set -e  # Exit on any error

echo "🚀 Glacier Archival Setup Script"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

print_status "Docker is running"

# Check if docker-compose is available
if ! command -v docker-compose > /dev/null 2>&1; then
    print_error "docker-compose is not installed. Please install it and try again."
    exit 1
fi

print_status "docker-compose is available"

# Stop any running containers
print_info "Stopping existing containers..."
docker-compose down

# Start the services
print_info "Starting services..."
docker-compose up -d postgres
sleep 5  # Wait for postgres to be ready

docker-compose up -d backend
sleep 10  # Wait for backend to be ready

# Check if services are running
print_info "Checking service status..."
if docker-compose ps | grep -q "Up"; then
    print_status "Services are running"
else
    print_error "Some services failed to start"
    docker-compose logs --tail=20
    exit 1
fi

# Wait for backend to be ready
print_info "Waiting for backend to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:8000/api/media-files/ > /dev/null 2>&1; then
        print_status "Backend is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        print_error "Backend failed to start within 30 seconds"
        docker-compose logs backend --tail=20
        exit 1
    fi
    sleep 1
done

# Create superuser
print_info "Creating superuser..."
docker-compose exec backend python manage.py create_superuser

# Test the API
print_info "Testing API endpoints..."
if curl -s http://localhost:8000/api/media-files/get_storage_costs/ | grep -q "Authentication credentials"; then
    print_status "Storage costs API is working (requires authentication)"
else
    print_warning "Storage costs API test failed"
fi

# Start frontend
print_info "Starting frontend..."
docker-compose up -d frontend

# Final status check
print_info "Final status check..."
docker-compose ps

echo ""
echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "📋 Access Information:"
echo "  • Frontend: http://localhost:5173/"
echo "  • Backend API: http://localhost:8000/api/"
echo "  • Django Admin: http://localhost:8000/admin/"
echo ""
echo "🔑 Login Credentials:"
echo "  • Username: admin"
echo "  • Password: admin123"
echo ""
echo "📚 Useful Commands:"
echo "  • View logs: docker-compose logs -f"
echo "  • Stop services: docker-compose down"
echo "  • Restart services: docker-compose restart"
echo "  • Create new superuser: docker-compose exec backend python manage.py create_superuser"
echo ""
print_status "Setup completed successfully!"
