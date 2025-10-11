# Razorpay Payment Integration Setup

## Environment Variables

Add these to your `.env` file in the backend:

```bash
# Razorpay Configuration
RAZORPAY_KEY_ID=rzp_test_your_test_key_id
RAZORPAY_KEY_SECRET=your_test_key_secret
```

## Getting Razorpay Credentials

1. **Sign up at Razorpay**: https://razorpay.com/
2. **Get Test Credentials**:
   - Go to Dashboard → Settings → API Keys
   - Generate Test Key ID and Secret
3. **For Production**:
   - Complete KYC verification
   - Switch to Live mode
   - Use Live Key ID and Secret

## Test Cards

Use these test card numbers for testing:

- **Success**: 4111 1111 1111 1111
- **Failure**: 4000 0000 0000 0002
- **CVV**: Any 3 digits
- **Expiry**: Any future date
- **Name**: Any name

## Payment Flow

1. User selects hibernation plan
2. Frontend creates payment order via backend
3. Razorpay modal opens for payment
4. User completes payment
5. Backend verifies payment signature
6. Subscription is activated

## Security Notes

- Never expose Razorpay secret key in frontend
- Always verify payment signatures on backend
- Use HTTPS in production
- Implement proper error handling
