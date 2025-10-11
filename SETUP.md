# Glacier Archival - Quick Setup Guide

## 🚀 One-Command Setup

Run the setup script to get everything running:

```bash
./setup.sh
```

This script will:
- ✅ Start all Docker services (PostgreSQL, Backend, Frontend)
- ✅ Create a superuser account
- ✅ Test API endpoints
- ✅ Provide access information

## 🔑 Default Login Credentials

**Username:** `admin`  
**Password:** `admin123`  
**Email:** `admin@example.com`

## 🌐 Access URLs

- **Frontend Application:** http://localhost:5173/
- **Backend API:** http://localhost:8000/api/
- **Django Admin Panel:** http://localhost:8000/admin/

## 📚 Manual Commands

If you prefer to set up manually:

### 1. Start Services
```bash
docker-compose up -d
```

### 2. Create Superuser
```bash
docker-compose exec backend python manage.py create_superuser
```

### 3. Check Status
```bash
docker-compose ps
```

## 🛠️ Useful Commands

- **View logs:** `docker-compose logs -f`
- **Stop services:** `docker-compose down`
- **Restart services:** `docker-compose restart`
- **Create new superuser:** `docker-compose exec backend python manage.py create_superuser --username myuser --password mypass`

## 🔧 Custom Superuser

To create a custom superuser:

```bash
docker-compose exec backend python manage.py create_superuser \
  --username your_username \
  --email your_email@example.com \
  --password your_password
```

## 📊 API Testing

Test the storage costs API (requires authentication):

```bash
# Get auth token
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | \
  grep -o '"access":"[^"]*"' | cut -d'"' -f4)

# Test storage costs API
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/media-files/get_storage_costs/
```

## 🐛 Troubleshooting

### Backend Not Starting
```bash
docker-compose logs backend
```

### Database Issues
```bash
docker-compose exec postgres psql -U postgres -c "SELECT 1;"
```

### Reset Everything
```bash
docker-compose down
docker-compose up -d
```

## 📝 Notes

- The system uses PostgreSQL for the database
- All data is stored in Docker volumes
- The frontend runs on Vite development server
- The backend uses Django REST Framework
- Smart Tier Suggestions are temporarily disabled to prevent API overload
