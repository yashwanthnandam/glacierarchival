import Razorpay from 'razorpay';
import { paymentAPI } from './api';

class PaymentService {
  constructor() {
    this.razorpay = null;
  }

  initializeRazorpay(keyId) {
    if (typeof window !== 'undefined') {
      if (!keyId) {
        throw new Error('Razorpay key ID is required');
      }
      
      // Check if Razorpay is loaded
      if (typeof window.Razorpay === 'undefined') {
        throw new Error('Razorpay script not loaded. Please refresh the page and try again.');
      }
      
      // Check if we're in production or development
      const isProduction = import.meta.env.VITE_ENVIRONMENT === 'production';
      const environment = isProduction ? 'production' : 'development';
      
      this.razorpay = new window.Razorpay({
        key: keyId,
        currency: 'INR',
        name: 'Glacier Archival',
        description: 'Hibernation Plan Subscription',
        image: '/logo.png', // Add your logo
        theme: {
          color: '#10b981'
        },
        // Production-specific settings
        ...(isProduction && {
          modal: {
            ondismiss: () => {
              console.log('Payment modal dismissed');
            }
          }
        })
      });
      
      console.log(`Razorpay initialized in ${environment} mode with key: ${keyId.substring(0, 10)}...`);
    } else {
      throw new Error('Razorpay can only be initialized in browser environment');
    }
  }

  async createPaymentOrder(planId, amountInr) {
    try {
      const response = await paymentAPI.createOrder(planId, amountInr);
      return response.data;
    } catch (error) {
      console.error('Error creating payment order:', error);
      throw new Error(error.response?.data?.error || 'Failed to create payment order');
    }
  }

  async processPayment(paymentData) {
    return new Promise((resolve, reject) => {
      if (!this.razorpay) {
        reject(new Error('Razorpay not initialized'));
        return;
      }

      const options = {
        order_id: paymentData.razorpay_order_id,
        amount: paymentData.amount,
        currency: paymentData.currency,
        name: paymentData.plan.name,
        description: `${paymentData.plan.storage_tier} - ${paymentData.plan.name}`,
        prefill: {
          name: '', // You can get this from user profile
          email: '', // You can get this from user profile
        },
        notes: {
          plan_id: paymentData.plan.id,
          payment_id: paymentData.payment_id
        },
        handler: async (response) => {
          try {
            // Verify payment on backend
            const verificationResponse = await paymentAPI.verifyPayment(
              paymentData.payment_id,
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature
            );
            
            resolve({
              success: true,
              paymentData: verificationResponse.data,
              razorpayResponse: response
            });
          } catch (error) {
            console.error('Payment verification failed:', error);
            reject(new Error(error.response?.data?.error || 'Payment verification failed'));
          }
        },
        modal: {
          ondismiss: () => {
            reject(new Error('Payment cancelled by user'));
          }
        }
      };

      this.razorpay.open(options);
    });
  }

  async getPaymentStatus(paymentId) {
    try {
      const response = await paymentAPI.getPaymentStatus(paymentId);
      return response.data;
    } catch (error) {
      console.error('Error getting payment status:', error);
      throw new Error(error.response?.data?.error || 'Failed to get payment status');
    }
  }

  // Format amount for display
  formatAmount(amountInr) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amountInr);
  }

  // Get payment methods available
  getPaymentMethods() {
    return [
      { id: 'card', name: 'Credit/Debit Card', icon: '💳' },
      { id: 'upi', name: 'UPI', icon: '📱' },
      { id: 'netbanking', name: 'Net Banking', icon: '🏦' },
      { id: 'wallet', name: 'Wallet', icon: '👛' }
    ];
  }
}

export default PaymentService;
