# Production Razorpay Checklist

## Pre-Deployment Checklist

### 1. Razorpay Account Setup
- [ ] Create Razorpay account at https://razorpay.com/
- [ ] Complete KYC verification
- [ ] Complete business verification
- [ ] Get live API credentials
- [ ] Test with live credentials in staging environment

### 2. Environment Configuration
- [ ] Set `ENVIRONMENT=production` in backend
- [ ] Add live `RAZORPAY_KEY_ID` to backend .env
- [ ] Add live `RAZORPAY_KEY_SECRET` to backend .env
- [ ] Add live `VITE_RAZORPAY_KEY_ID` to frontend .env
- [ ] Set `VITE_ENVIRONMENT=production` in frontend

### 3. Webhook Configuration
- [ ] Configure webhook URL: `https://yourdomain.com/api/payments/webhook/`
- [ ] Subscribe to events: `payment.captured`, `payment.failed`, `order.paid`
- [ ] Test webhook with Razorpay webhook testing tool
- [ ] Verify webhook signature validation

### 4. Security Configuration
- [ ] Enable HTTPS on production server
- [ ] Set up proper CORS configuration
- [ ] Implement rate limiting
- [ ] Set up monitoring and alerting
- [ ] Configure logging for payment events

### 5. Database Setup
- [ ] Run migrations: `python manage.py migrate`
- [ ] Create payment monitoring indexes
- [ ] Set up database backups
- [ ] Configure database connection pooling

### 6. Testing
- [ ] Test payment flow with test cards
- [ ] Test webhook handling
- [ ] Test error scenarios
- [ ] Test payment monitoring dashboard
- [ ] Load test payment endpoints

### 7. Monitoring & Logging
- [ ] Set up payment logging
- [ ] Configure error monitoring (Sentry, etc.)
- [ ] Set up payment success/failure alerts
- [ ] Monitor payment statistics
- [ ] Set up uptime monitoring

### 8. Documentation
- [ ] Document payment flow
- [ ] Create troubleshooting guide
- [ ] Document webhook handling
- [ ] Create payment monitoring guide
- [ ] Document error codes and messages

## Post-Deployment Checklist

### 1. Verification
- [ ] Verify payment flow works in production
- [ ] Check webhook delivery
- [ ] Verify payment monitoring dashboard
- [ ] Test error handling
- [ ] Check logs for any issues

### 2. Monitoring
- [ ] Monitor payment success rates
- [ ] Check for failed payments
- [ ] Monitor webhook delivery
- [ ] Watch for error spikes
- [ ] Monitor response times

### 3. Customer Support
- [ ] Train support team on payment issues
- [ ] Create payment troubleshooting guide
- [ ] Set up payment status checking tools
- [ ] Create refund process documentation

## Emergency Procedures

### Payment Issues
1. Check Razorpay dashboard for status
2. Verify webhook delivery
3. Check application logs
4. Contact Razorpay support if needed

### Webhook Issues
1. Check webhook URL accessibility
2. Verify signature validation
3. Check webhook logs in Razorpay dashboard
4. Test webhook manually

### High Failure Rate
1. Check payment gateway status
2. Verify API credentials
3. Check for configuration changes
4. Contact Razorpay support

## Contact Information

- **Razorpay Support**: https://razorpay.com/support/
- **Emergency Contact**: [Your emergency contact]
- **Technical Lead**: [Your technical lead contact]
