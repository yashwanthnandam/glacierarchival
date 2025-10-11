# Razorpay Integration Troubleshooting Guide

## Common Issues and Solutions

### 1. "key_id or oauthToken is mandatory" Error

**Symptoms:**
- Error: `key_id or oauthToken is mandatory`
- Payment modal doesn't open
- Razorpay initialization fails

**Causes & Solutions:**

#### A. Razorpay Script Not Loaded
**Solution:** Ensure Razorpay script is included in HTML
```html
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```

#### B. Invalid Key ID
**Solution:** Check if key is properly retrieved from API
```javascript
// Debug the key retrieval
const response = await hibernationAPI.getPlansGroupedByTier();
console.log('Razorpay key:', response.data.razorpay_key_id);
```

#### C. Key ID is null/undefined
**Solution:** Check backend configuration
```bash
# Check if Razorpay key is set in environment
echo $RAZORPAY_KEY_ID
```

### 2. Payment Modal Not Opening

**Symptoms:**
- No error but payment modal doesn't appear
- Console shows Razorpay initialized but no modal

**Solutions:**

#### A. Check Razorpay Object
```javascript
if (typeof window.Razorpay === 'undefined') {
  console.error('Razorpay script not loaded');
}
```

#### B. Verify Payment Order Creation
```javascript
const paymentData = await paymentService.createPaymentOrder(planId, amount);
console.log('Payment order:', paymentData);
```

### 3. Payment Verification Fails

**Symptoms:**
- Payment completes but verification fails
- "Invalid signature" error

**Solutions:**

#### A. Check Webhook Configuration
- Ensure webhook URL is correct: `https://yourdomain.com/api/payments/webhook/`
- Verify webhook secret matches backend configuration

#### B. Verify Signature Generation
```python
# Backend signature verification
import hmac
import hashlib

def verify_signature(razorpay_order_id, razorpay_payment_id, razorpay_signature):
    message = f"{razorpay_order_id}|{razorpay_payment_id}"
    expected_signature = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode('utf-8'),
        message.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(expected_signature, razorpay_signature)
```

### 4. Environment Configuration Issues

**Development vs Production:**

#### Development Mode
```javascript
// Allow test keys in development
const isDevelopment = process.env.NODE_ENV === 'development' || 
                     window.location.hostname === 'localhost';

if (!isDevelopment && keyId === 'rzp_test_1234567890') {
  throw new Error('Test key not allowed in production');
}
```

#### Production Mode
```bash
# Set production environment variables
ENVIRONMENT=production
RAZORPAY_KEY_ID=rzp_live_your_live_key_id
RAZORPAY_KEY_SECRET=your_live_key_secret
```

### 5. Test Cards Not Working

**Valid Test Cards:**
- **Success:** 4111 1111 1111 1111
- **Failure:** 4000 0000 0000 0002
- **CVV:** Any 3 digits
- **Expiry:** Any future date
- **Name:** Any name

**Common Issues:**
- Using live cards with test keys
- Incorrect CVV format
- Expired test dates

### 6. Network and CORS Issues

**Symptoms:**
- Payment requests fail
- CORS errors in console

**Solutions:**

#### A. Check API Endpoints
```bash
# Test payment endpoints
curl -X POST http://localhost:8000/api/payments/create_order/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"plan_id": 1, "amount_inr": 100}'
```

#### B. Verify CORS Configuration
```python
# Django CORS settings
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5174",
]
```

### 7. Debugging Steps

#### Step 1: Check Browser Console
```javascript
// Add debugging to PaymentService
console.log('Razorpay available:', typeof window.Razorpay);
console.log('Key ID:', keyId);
console.log('Environment:', import.meta.env.VITE_ENVIRONMENT);
```

#### Step 2: Test API Endpoints
```bash
# Test plans endpoint
curl http://localhost:8000/api/hibernation-plans/grouped_by_tier/

# Test payment creation
curl -X POST http://localhost:8000/api/payments/create_order/ \
  -H "Content-Type: application/json" \
  -d '{"plan_id": 1, "amount_inr": 100}'
```

#### Step 3: Check Backend Logs
```bash
# Monitor Django logs
tail -f backend/logs/django.log

# Check for Razorpay API errors
grep -i razorpay backend/logs/django.log
```

### 8. Production Deployment Checklist

- [ ] Razorpay live credentials configured
- [ ] Webhook URL set in Razorpay dashboard
- [ ] SSL certificate installed
- [ ] CORS configured for production domain
- [ ] Error monitoring set up
- [ ] Payment logging enabled
- [ ] Test payments completed

### 9. Support Resources

- **Razorpay Documentation:** https://razorpay.com/docs/
- **Razorpay Support:** https://razorpay.com/support/
- **Test Cards:** https://razorpay.com/docs/payment-gateway/test-cards/
- **Webhook Testing:** https://razorpay.com/docs/payment-gateway/webhooks/

### 10. Quick Fix Commands

```bash
# Restart development servers
cd frontend && npm run dev
cd backend && python manage.py runserver

# Clear browser cache
# Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

# Check environment variables
echo $RAZORPAY_KEY_ID
echo $RAZORPAY_KEY_SECRET

# Test API connectivity
curl http://localhost:8000/api/hibernation-plans/grouped_by_tier/
```
