# Glacier Archival Platform

A comprehensive cloud storage platform with intelligent hibernation capabilities, designed for cost-effective long-term data archival using AWS S3 and Glacier services.

## 🌟 Features

### Core Functionality
- **Smart File Management**: Upload, organize, and manage files with intuitive folder structures
- **Intelligent Hibernation**: Automatically move files to cost-effective Glacier storage
- **Multi-tier Storage**: Hot, Warm, and Cold storage tiers with automatic transitions
- **Bulk Operations**: Upload, hibernate, restore, and delete multiple files efficiently
- **Real-time Progress**: Live upload progress tracking with Web Workers
- **Offline Support**: Continue uploads even when connection is interrupted

### Advanced Features
- **Comprehensive Validation**: Pre-upload validation for file sizes, types, and storage limits
- **Rate Limiting**: DoS protection and concurrent upload limits
- **Error Handling**: Detailed error messages with actionable feedback
- **Payment Integration**: Razorpay integration for subscription management
- **Email Verification**: Secure user registration with email confirmation
- **Responsive Design**: Modern UI that works on all devices

### Security Features
- **File Type Validation**: Only allow safe file types
- **Path Traversal Protection**: Prevent directory traversal attacks
- **Rate Limiting**: Prevent abuse and DoS attacks
- **Authentication**: Secure JWT-based authentication
- **CORS Protection**: Proper cross-origin resource sharing

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Python 3.11+ and pip
- PostgreSQL 13+
- Redis (for Celery)
- AWS Account with S3 and Glacier access

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/glacierarchival.git
   cd glacierarchival
   ```

2. **Backend Setup**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   cp .env.example .env
   # Edit .env with your configuration
   python manage.py migrate
   python manage.py createsuperuser
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   cp env.example .env
   # Edit .env with your configuration
   npm run build
   ```

4. **Environment Configuration**
   
   **Backend (.env)**:
   ```env
   DEBUG=True
   SECRET_KEY=your-secret-key
   DATABASE_URL=postgresql://user:password@localhost:5432/glacierarchival
   AWS_ACCESS_KEY_ID=your-aws-access-key
   AWS_SECRET_ACCESS_KEY=your-aws-secret-key
   AWS_STORAGE_BUCKET_NAME=your-s3-bucket
   AWS_S3_REGION_NAME=us-east-1
   EMAIL_HOST=smtp.gmail.com
   EMAIL_HOST_USER=your-email@gmail.com
   EMAIL_HOST_PASSWORD=your-app-password
   RAZORPAY_KEY_ID=your-razorpay-key
   RAZORPAY_KEY_SECRET=your-razorpay-secret
   ```

   **Frontend (.env)**:
   ```env
   VITE_API_BASE_URL=http://localhost:8000/api
   VITE_APP_NAME=Glacier Archival
   ```

5. **Run the Application**
   ```bash
   # Backend
   cd backend
   python manage.py runserver
   
   # Frontend (in another terminal)
   cd frontend
   npm run dev
   ```

6. **Access the Application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000/api
   - Admin Panel: http://localhost:8000/admin

## 📁 Project Structure

```
glacierarchival/
├── backend/                 # Django backend
│   ├── api/                # Main API application
│   │   ├── models.py       # Database models
│   │   ├── views.py        # API views
│   │   ├── serializers.py  # Data serializers
│   │   ├── services.py     # Business logic
│   │   ├── middleware.py   # Custom middleware
│   │   └── upload_error_handling.py  # Error handling
│   ├── uppy_upload/        # Upload handling
│   ├── deeparchival/       # Django settings
│   └── requirements.txt    # Python dependencies
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── services/       # API services
│   │   ├── utils/          # Utility functions
│   │   └── constants.js    # App constants
│   └── package.json        # Node dependencies
├── docs/                   # Documentation
│   ├── SETUP.md           # Setup guide
│   ├── CONTRIBUTING.md    # Contribution guidelines
│   ├── E2E_ENCRYPTION.md  # Encryption details
│   └── ...                # More docs
├── docker-compose.yml      # Docker configuration
└── README.md               # This file
```

## 🔧 Configuration

### AWS S3 Setup
1. Create an S3 bucket for file storage
2. Configure CORS policy for the bucket
3. Set up IAM user with S3 and Glacier permissions
4. Configure lifecycle policies for automatic archival

### Database Setup
1. Create PostgreSQL database
2. Run migrations: `python manage.py migrate`
3. Create superuser: `python manage.py createsuperuser`

### Email Configuration
1. Set up SMTP server (Gmail recommended)
2. Generate app-specific password
3. Configure email templates

### Payment Integration
1. Create Razorpay account
2. Get API keys from dashboard
3. Configure webhook endpoints

## 📊 API Documentation

### Authentication
- **POST** `/api/auth/register/` - User registration
- **POST** `/api/auth/login/` - User login
- **POST** `/api/auth/verify-email/` - Email verification

### File Management
- **GET** `/api/media-files/` - List files
- **POST** `/api/media-files/upload/` - Upload file
- **DELETE** `/api/media-files/{id}/` - Delete file
- **POST** `/api/media-files/{id}/archive/` - Archive file
- **POST** `/api/media-files/{id}/restore/` - Restore file

### Upload Management
- **POST** `/api/uppy/presigned-url/` - Get presigned URL
- **POST** `/api/uppy/upload-complete/` - Mark upload complete
- **POST** `/api/uppy/create-session/` - Create upload session

## 🛡️ Security Features

### File Validation
- Maximum file size: 5GB per file
- Total storage limit: 15GB (free tier)
- Allowed file types: Images, videos, audio, documents, archives
- Dangerous file extension blocking
- Path traversal protection

### Rate Limiting
- Upload operations: 10 requests/minute
- File operations: 30 requests/minute
- API calls: 100 requests/minute
- Concurrent uploads: 3 maximum per user

### Error Handling
- Comprehensive error messages
- Proper HTTP status codes
- Detailed error context
- User-friendly error descriptions

## 🚀 Deployment

### Docker Deployment
```bash
docker-compose up -d
```

### Production Checklist
1. Set `DEBUG=False` in production
2. Configure production database
3. Set up SSL certificates
4. Configure domain and DNS
5. Set up monitoring and logging
6. Configure backup strategies

### Environment Variables
See [docs/ENVIRONMENT_SETUP.md](docs/ENVIRONMENT_SETUP.md) for detailed configuration guide.

## 📈 Monitoring

### Logs
- Application logs in `/logs/`
- Error tracking with detailed context
- Performance monitoring
- User activity tracking

### Metrics
- Upload success rates
- Storage usage statistics
- User engagement metrics
- Cost optimization tracking

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a pull request

### Development Guidelines
- Follow PEP 8 for Python code
- Use ESLint for JavaScript code
- Write tests for new features
- Update documentation
- Follow semantic versioning

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for detailed contribution guidelines.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Documentation
- [Setup Guide](docs/SETUP.md)
- [Environment Setup](docs/ENVIRONMENT_SETUP.md)
- [Production Checklist](docs/PRODUCTION_CHECKLIST.md)
- [Codebase Analysis](docs/CODEBASE_ANALYSIS.md)
- [E2E Encryption](docs/E2E_ENCRYPTION.md)
- [Razorpay Setup](docs/RAZORPAY_SETUP.md)
- [Production Razorpay Setup](docs/PRODUCTION_RAZORPAY_SETUP.md)
- [Razorpay Troubleshooting](docs/RAZORPAY_TROUBLESHOOTING.md)

### Troubleshooting
- Check logs for error details
- Verify environment configuration
- Ensure all services are running
- Check AWS credentials and permissions

### Contact
- Create an issue on GitHub
- Check existing issues and discussions
- Review documentation and setup guides

## 🔄 Changelog

### v1.0.0 (Current)
- Initial release with core functionality
- File upload and management
- Hibernation system
- Payment integration
- Comprehensive error handling
- Rate limiting and security features

## 🎯 Roadmap

### Upcoming Features
- [ ] Streaming upload for large files
- [ ] Advanced analytics dashboard
- [ ] Mobile application
- [ ] API rate limiting improvements
- [ ] Advanced search capabilities
- [ ] File versioning
- [ ] Collaboration features

### Performance Improvements
- [ ] CDN integration
- [ ] Database optimization
- [ ] Caching strategies
- [ ] Background job optimization

---

**Built with ❤️ using Django, React, and AWS services.**