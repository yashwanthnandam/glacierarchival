import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Grid,
  Chip,
  Alert,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider
} from '@mui/material';
import {
  CurrencyRupee,
  TrendingDown,
  TrendingUp,
  Refresh,
  Info,
  AutoAwesome,
  Schedule,
  Money,
  Storage,
  PieChart,
  BarChart
} from '@mui/icons-material';
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, BarChart as RechartsBarChart, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { mediaAPI } from '../services/api';

const RegionalPricingDashboard = ({ refreshTrigger }) => {
  const [costData, setCostData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [autoHibernateDialogOpen, setAutoHibernateDialogOpen] = useState(false);
  const [hibernationOptions, setHibernationOptions] = useState({
    days_threshold: 30,
    min_size: 10485760, // 10MB
    dry_run: true
  });
  const [hibernationResult, setHibernationResult] = useState(null);
  const [hibernationLoading, setHibernationLoading] = useState(false);

  useEffect(() => {
    fetchCostData();
  }, [refreshTrigger]);

  const fetchCostData = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await mediaAPI.getStorageCostsINR();
      setCostData(response.data);
    } catch (error) {
      console.error('Error fetching cost data:', error);
      setError('Failed to load cost data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrencyINR = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getTierColor = (tier) => {
    switch (tier) {
      case 'standard': return '#4caf50';
      case 'ia': return '#ff9800';
      case 'glacier': return '#2196f3';
      case 'deep_archive': return '#9c27b0';
      default: return '#757575';
    }
  };

  const handleAutoHibernate = async () => {
    setHibernationLoading(true);
    try {
      const response = await mediaAPI.autoHibernateFiles(hibernationOptions);
      setHibernationResult(response.data);
      if (!hibernationOptions.dry_run) {
        // Refresh cost data after hibernation
        await fetchCostData();
      }
    } catch (error) {
      console.error('Error auto-hibernating files:', error);
      setError('Failed to auto-hibernate files');
    } finally {
      setHibernationLoading(false);
    }
  };

  if (loading) {
    return (
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Loading Pricing Data
          </Typography>
          <LinearProgress />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Alert severity="error" action={
            <IconButton color="inherit" size="small" onClick={fetchCostData}>
              <Refresh />
            </IconButton>
          }>
            {error}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!costData) {
    return (
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Alert severity="info">
            No cost data available. Upload some files to see pricing.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const pieData = Object.entries(costData.cost_breakdown_inr).map(([tier, cost]) => ({
    name: tier.replace('_', ' ').toUpperCase(),
    value: cost,
    color: getTierColor(tier)
  })).filter(item => item.value > 0);

  return (
    <>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CurrencyRupee color="primary" />
              <Typography variant="h6">
                Pricing Dashboard
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <IconButton onClick={fetchCostData} color="primary">
                <Refresh />
              </IconButton>
              <Button
                variant="outlined"
                startIcon={<AutoAwesome />}
                onClick={() => setAutoHibernateDialogOpen(true)}
              >
                Auto Hibernate
              </Button>
            </Box>
          </Box>

          <Grid container spacing={4}>
            {/* Summary Cards */}
            <Grid item xs={12} md={3}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <CurrencyRupee color="primary" />
                    <Typography variant="h6">
                      {formatCurrencyINR(costData.total_monthly_cost_inr)}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Monthly Cost (before GST)
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={3}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Money color="warning" />
                    <Typography variant="h6">
                      {formatCurrencyINR(costData.gst_amount)}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    GST ({costData.gst_rate}%)
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={3}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <TrendingUp color="success" />
                    <Typography variant="h6">
                      {formatCurrencyINR(costData.total_with_gst)}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Total Cost (with GST)
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={3}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Storage color="info" />
                    <Typography variant="h6">
                      {costData.total_size_gb} GB
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Total Storage
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Cost Distribution Chart */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                Cost Distribution
              </Typography>
              <ResponsiveContainer width="100%" height={380}>
                <RechartsPieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={110}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value) => formatCurrencyINR(value)} />
                </RechartsPieChart>
              </ResponsiveContainer>
            </Grid>

            {/* Detailed Breakdown Table */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                Detailed Breakdown
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 460 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Storage Tier</TableCell>
                      <TableCell align="right">Monthly Cost</TableCell>
                      <TableCell align="right">Cost per GB</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(costData.cost_breakdown_inr).map(([tier, cost]) => (
                      <TableRow key={tier}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box
                              sx={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                backgroundColor: getTierColor(tier)
                              }}
                            />
                            <Typography variant="body2">
                              {tier.replace('_', ' ').toUpperCase()}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight="bold">
                            {formatCurrencyINR(cost)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {cost > 0 ? formatCurrencyINR(cost / costData.total_size_gb) : '₹0.00'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
          </Grid>

          {/* Indian Market Benefits */}
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Indian Market Benefits:</strong>
              <br />
              • Pricing in Indian Rupees (INR) with GST included
              <br />
              • Up to 95% cost savings with Deep Archive storage
              <br />
              • Automatic hibernation for unused files
              <br />
              • Pay only for what you use - no hidden charges
            </Typography>
          </Alert>
        </CardContent>
      </Card>

      {/* Auto Hibernate Dialog */}
      <Dialog open={autoHibernateDialogOpen} onClose={() => setAutoHibernateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoAwesome color="primary" />
            <Typography variant="h6">Auto Hibernate Files</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Automatically move unused files to Deep Archive storage to save up to 95% on costs.
          </Alert>

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Days Since Last Access"
                type="number"
                value={hibernationOptions.days_threshold}
                onChange={(e) => setHibernationOptions({
                  ...hibernationOptions,
                  days_threshold: parseInt(e.target.value)
                })}
                helperText="Files not accessed for this many days will be hibernated"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Minimum File Size (MB)"
                type="number"
                value={hibernationOptions.min_size / (1024 * 1024)}
                onChange={(e) => setHibernationOptions({
                  ...hibernationOptions,
                  min_size: parseInt(e.target.value) * 1024 * 1024
                })}
                helperText="Only files larger than this will be considered"
              />
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={hibernationOptions.dry_run}
                    onChange={(e) => setHibernationOptions({
                      ...hibernationOptions,
                      dry_run: e.target.checked
                    })}
                  />
                }
                label="Dry Run (preview only - no actual hibernation)"
              />
            </Grid>
          </Grid>

          {hibernationResult && (
            <Box sx={{ mt: 2 }}>
              <Alert severity={hibernationResult.dry_run ? "info" : "success"}>
                <Typography variant="body2">
                  <strong>
                    {hibernationResult.dry_run ? 'Preview Results:' : 'Hibernation Complete:'}
                  </strong>
                  <br />
                  • Files analyzed: {hibernationResult.candidates_found}
                  <br />
                  • Files hibernated: {hibernationResult.files_hibernated}
                  <br />
                  • Monthly savings: {formatCurrencyINR(hibernationResult.total_monthly_savings_inr)}
                </Typography>
              </Alert>

              {hibernationResult.hibernated_files.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Hibernated Files:
                  </Typography>
                  <List dense>
                    {hibernationResult.hibernated_files.slice(0, 10).map((file, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <Storage />
                        </ListItemIcon>
                        <ListItemText
                          primary={file.filename}
                          secondary={`${file.file_size_mb.toFixed(2)} MB • Savings: ${formatCurrencyINR(file.monthly_savings_inr)}/month`}
                        />
                      </ListItem>
                    ))}
                    {hibernationResult.hibernated_files.length > 10 && (
                      <ListItem>
                        <ListItemText
                          primary={`... and ${hibernationResult.hibernated_files.length - 10} more files`}
                        />
                      </ListItem>
                    )}
                  </List>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setAutoHibernateDialogOpen(false)}>
            Close
          </Button>
          <Button 
            onClick={handleAutoHibernate} 
            variant="contained" 
            color="primary"
            disabled={hibernationLoading}
            startIcon={hibernationLoading ? <LinearProgress size={20} /> : <AutoAwesome />}
          >
            {hibernationLoading ? 'Processing...' : hibernationOptions.dry_run ? 'Preview' : 'Hibernate Files'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default RegionalPricingDashboard;
