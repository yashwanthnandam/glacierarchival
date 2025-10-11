import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '../utils/muiImports';
import { paymentAPI } from '../services/api';
import { LoadingState, ErrorDisplay, useLoadingState } from '../utils/errorHandling';
import { formatDate, formatCurrencyFromPaise, getStatusColor } from '../utils/formatters';

const PaymentMonitoring = () => {
  const [payments, setPayments] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  
  const { loading, error, executeWithLoading } = useLoadingState();

  useEffect(() => {
    loadPaymentData();
  }, []);

  const loadPaymentData = async () => {
    await executeWithLoading(async () => {
      const [paymentsResponse, statsResponse] = await Promise.all([
        paymentAPI.getAll(),
        paymentAPI.getStats()
      ]);
      
      setPayments(paymentsResponse.data.results || paymentsResponse.data);
      setStats(statsResponse.data);
    });
  };

  const handlePaymentDetails = (payment) => {
    setSelectedPayment(payment);
    setDetailsOpen(true);
  };

  if (loading) {
    return <LoadingState message="Loading payment data..." />;
  }

  if (error) {
    return <ErrorDisplay error={error} onRetry={loadPaymentData} />;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Payment Monitoring
      </Typography>

      {/* Stats Cards */}
      {stats && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Total Payments
                </Typography>
                <Typography variant="h4">
                  {stats.total_payments}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Success Rate
                </Typography>
                <Typography variant="h4" color="success.main">
                  {stats.success_rate}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Successful
                </Typography>
                <Typography variant="h4" color="success.main">
                  {stats.successful_payments}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Failed
                </Typography>
                <Typography variant="h4" color="error.main">
                  {stats.failed_payments}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Payments Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Recent Payments
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Payment ID</TableCell>
                  <TableCell>Plan</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{payment.razorpay_order_id}</TableCell>
                    <TableCell>{payment.hibernation_plan?.name}</TableCell>
                    <TableCell>{formatCurrencyFromPaise(payment.amount_inr)}</TableCell>
                    <TableCell>
                      <Chip
                        label={payment.status}
                        color={getStatusColor(payment.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{formatDate(payment.created_at)}</TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        onClick={() => handlePaymentDetails(payment)}
                      >
                        Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Payment Details Dialog */}
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Payment Details</DialogTitle>
        <DialogContent>
          {selectedPayment && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Payment Information
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Payment ID
                  </Typography>
                  <Typography variant="body1">
                    {selectedPayment.razorpay_order_id}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Razorpay Payment ID
                  </Typography>
                  <Typography variant="body1">
                    {selectedPayment.razorpay_payment_id || 'N/A'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Amount
                  </Typography>
                  <Typography variant="body1">
                    {formatCurrencyFromPaise(selectedPayment.amount_inr)}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Status
                  </Typography>
                  <Chip
                    label={selectedPayment.status}
                    color={getStatusColor(selectedPayment.status)}
                    size="small"
                  />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Created At
                  </Typography>
                  <Typography variant="body1">
                    {formatDate(selectedPayment.created_at)}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Paid At
                  </Typography>
                  <Typography variant="body1">
                    {selectedPayment.paid_at ? formatDate(selectedPayment.paid_at) : 'N/A'}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PaymentMonitoring;
