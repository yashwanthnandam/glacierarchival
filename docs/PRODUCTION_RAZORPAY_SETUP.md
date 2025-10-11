# Production Razorpay Setup Guide

## 1. Create Razorpay Account

1. **Sign up**: Go to https://razorpay.com/
2. **Complete KYC**: Upload required documents
3. **Verify business**: Complete business verification
4. **Get credentials**: Go to Dashboard → Settings → API Keys

## 2. Environment Configuration

### Backend (.env file)
```bash
# Razorpay Configuration
RAZORPAY_KEY_ID=rzp_live_your_live_key_id
RAZORPAY_KEY_SECRET=your_live_key_secret

# For development/testing
RAZORPAY_TEST_KEY_ID=rzp_test_your_test_key_id
RAZORPAY_TEST_KEY_SECRET=your_test_key_secret

# Environment
ENVIRONMENT=production  # or development
```

### Frontend (.env file)
```bash
VITE_RAZORPAY_KEY_ID=rzp_live_your_live_key_id
VITE_ENVIRONMENT=production
```

## 3. Webhook Configuration

### Webhook URL
```
https://yourdomain.com/api/payments/webhook/
```

### Events to Subscribe
- `payment.captured`
- `payment.failed`
- `order.paid`

## 4. Test Cards (Development)

### Success Cards
- **Card**: 4111 1111 1111 1111
- **CVV**: Any 3 digits
- **Expiry**: Any future date
- **Name**: Any name

### Failure Cards
- **Card**: 4000 0000 0000 0002
- **CVV**: Any 3 digits
- **Expiry**: Any future date

## 5. Production Checklist

- [ ] KYC completed
- [ ] Business verification done
- [ ] Live API keys obtained
- [ ] Webhook URL configured
- [ ] SSL certificate installed
- [ ] Error handling implemented
- [ ] Payment logging added
- [ ] Test payments completed

## 6. Security Best Practices

- Never expose secret keys in frontend
- Always verify webhook signatures
- Use HTTPS in production
- Implement proper error handling
- Log all payment attempts
- Set up monitoring and alerts
