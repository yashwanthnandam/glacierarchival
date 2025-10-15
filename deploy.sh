#!/bin/bash

# Simple deployment script for Data Hibernate using Git
# Usage: ./deploy.sh [branch-name]

set -e  # Exit on any error

BRANCH=${1:-"main"}
SERVER_IP="3.110.26.97"
KEY_PATH="~/.ssh/datahibernate-key.pem"
SERVER_USER="ec2-user"
PROJECT_DIR="/home/ec2-user"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

echo "🚀 Starting Data Hibernate deployment using Git..."

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    log_error "Not in a Git repository. Please run this from the project root."
    exit 1
fi

# Check if there are uncommitted changes
if ! git diff-index --quiet HEAD --; then
    log_warning "You have uncommitted changes. Please commit or stash them first."
    log_info "Current changes:"
    git status --short
    echo ""
    read -p "Do you want to continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Deployment cancelled."
        exit 1
    fi
fi

# Check if branch exists
if ! git show-ref --verify --quiet refs/heads/$BRANCH; then
    log_error "Branch '$BRANCH' does not exist locally."
    log_info "Available branches:"
    git branch
    exit 1
fi

# Check if SSH key exists
if [ ! -f ~/.ssh/datahibernate-key.pem ]; then
    log_error "SSH key not found at ~/.ssh/datahibernate-key.pem"
    log_info "Please ensure your SSH key is in the correct location"
    exit 1
fi

# Check if server is reachable
log_info "Checking server connectivity..."
if ! ssh -i ~/.ssh/datahibernate-key.pem -o ConnectTimeout=10 -o BatchMode=yes ec2-user@3.110.26.97 "echo 'Server is reachable'" >/dev/null 2>&1; then
    log_error "Cannot connect to server. Please check:"
    log_info "1. Server is running"
    log_info "2. Security group allows SSH (port 22)"
    log_info "3. SSH key is correct"
    exit 1
fi
log_success "Server is reachable"

# Get current commit hash for tracking
CURRENT_COMMIT=$(git rev-parse HEAD)
CURRENT_COMMIT_SHORT=$(git rev-parse --short HEAD)
log_info "Deploying commit: $CURRENT_COMMIT_SHORT"

# Step 1: Build frontend locally
log_info "Building frontend..."
cd frontend
npm run build
if [ $? -ne 0 ]; then
    log_error "Frontend build failed"
    exit 1
fi
log_success "Frontend built successfully"
cd ..

# Step 2: Commit build files (if not already committed)
if ! git diff-index --quiet HEAD -- frontend/dist/; then
    log_info "Committing frontend build files..."
    git add frontend/dist/
    git commit -m "Build frontend for deployment (commit: $CURRENT_COMMIT_SHORT)"
fi

# Step 3: Push to remote repository
log_info "Pushing to remote repository..."
git push origin $BRANCH
if [ $? -ne 0 ]; then
    log_error "Failed to push to remote repository"
    exit 1
fi
log_success "Code pushed to remote repository"

# Step 4: Deploy on server using Git
log_info "Deploying on server..."
ssh -i ~/.ssh/datahibernate-key.pem ec2-user@3.110.26.97 << EOF
    cd $PROJECT_DIR
    
    echo "🔄 Stopping services..."
    docker-compose -f docker-compose.production.yml down
    
    echo "🔄 Pulling latest code from Git..."
    git fetch origin
    git reset --hard origin/$BRANCH
    
    echo "🔄 Building and starting services..."
    docker-compose -f docker-compose.production.yml up --build -d
    
    echo "⏳ Waiting for services to start..."
    sleep 10
    
    echo "🔄 Running database migrations..."
    docker exec ec2-user-backend-1 python manage.py migrate
    
    echo "🔄 Collecting static files..."
    docker exec ec2-user-backend-1 python manage.py collectstatic --noinput
    
    echo "🔄 Restarting services..."
    docker-compose -f docker-compose.production.yml restart
    
    echo "✅ Deployment completed!"
    echo "Deployed commit: $CURRENT_COMMIT_SHORT"
EOF

if [ $? -ne 0 ]; then
    log_error "Server deployment failed"
    exit 1
fi

log_success "Deployment completed successfully!"
log_info "Deployed commit: $CURRENT_COMMIT_SHORT"
log_info "Your application should be available at: https://datahibernate.in"
log_info "Check logs with: ssh -i ~/.ssh/datahibernate-key.pem ec2-user@3.110.26.97 'docker-compose -f docker-compose.production.yml logs -f'"