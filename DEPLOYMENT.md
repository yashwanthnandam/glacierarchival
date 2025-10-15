# Data Hibernate - CI/CD Pipeline

## 🚀 GitHub Actions CI/CD Pipeline

Your repository now has an **automatic deployment pipeline** that deploys to production on every push to the `main` branch.

### **Repository**: [yashwanthnandam/glacierarchival](https://github.com/yashwanthnandam/glacierarchival)

---

## 🔧 Setup (One-time)

### **Step 1: Add Secrets to GitHub**
Go to: https://github.com/yashwanthnandam/glacierarchival/settings/secrets/actions

Add these secrets:
- **`SSH_PRIVATE_KEY`**: Your SSH private key (`cat ~/.ssh/datahibernate-key.pem`)
- **`AWS_ACCESS_KEY_ID`**: Your AWS access key
- **`AWS_SECRET_ACCESS_KEY`**: Your AWS secret key  
- **`EMAIL_HOST_PASSWORD`**: Your email password
- **`RAZORPAY_KEY_ID`**: Your Razorpay key ID
- **`RAZORPAY_KEY_SECRET`**: Your Razorpay key secret
- **`SECRET_KEY`**: Django secret key (generate with: `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`)
- **`ENCRYPTION_KEY`**: Fernet encryption key (generate with: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`)

### **Step 2: Initialize Git on Server**
```bash
ssh -i ~/.ssh/datahibernate-key.pem ec2-user@3.110.26.97 << 'EOF'
cd /home/ec2-user
git init
git remote add origin https://github.com/yashwanthnandam/glacierarchival.git
git fetch origin
git reset --hard origin/main
EOF
```

---

## 🎯 How It Works

### **Automatic Deployment Flow:**
1. **Push to `main`** → Triggers GitHub Actions
2. **Build Frontend** → Installs dependencies & builds
3. **Commit Build Files** → Commits `frontend/dist/` to Git
4. **Deploy to Server** → SSH to server, pull code, deploy with Docker
5. **Health Check** → Verifies deployment success

### **Pipeline Steps:**
- ✅ Checkout code
- ✅ Setup Node.js 18
- ✅ Install frontend dependencies
- ✅ Build frontend
- ✅ Commit build files
- ✅ Deploy to server via SSH
- ✅ Run database migrations
- ✅ Collect static files
- ✅ Restart services
- ✅ Health check

---

## 🚀 Usage

### **Deploy Changes:**
```bash
# Make your changes
git add .
git commit -m "Your changes"
git push origin main
# Deployment happens automatically!
```

### **Monitor Deployment:**
- **Actions Tab**: https://github.com/yashwanthnandam/glacierarchival/actions
- **Live Logs**: Click on any workflow run to see real-time logs
- **Deployment Status**: Green checkmark = success, red X = failed

---

## 🔍 Troubleshooting

### **If Deployment Fails:**
1. **Check Actions Logs**: Click on failed workflow
2. **Common Issues**:
   - SSH key not added to secrets
   - Server not running
   - Database connection issues
   - Docker build failures

### **Manual Deployment (Emergency):**
```bash
./deploy.sh
```

### **Check Server Status:**
```bash
ssh -i ~/.ssh/datahibernate-key.pem ec2-user@3.110.26.97 'docker-compose -f docker-compose.production.yml ps'
```

---

## 📊 Benefits

- **🔄 Automatic**: Zero manual steps
- **📈 Reliable**: Consistent deployment environment
- **🔍 Trackable**: Full deployment history
- **⚡ Fast**: Optimized build process
- **🛡️ Secure**: SSH key stored in GitHub Secrets
- **🔄 Rollback**: Easy to revert commits

---

## 🎉 You're All Set!

Your CI/CD pipeline is ready. Just push to `main` and watch your application deploy automatically! 🚀