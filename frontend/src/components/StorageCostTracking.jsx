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
  Tooltip
} from '@mui/material';
import {
  Storage,
  Money,
  TrendingUp,
  TrendingDown,
  Refresh,
  Info,
  PieChart,
  BarChart
} from '@mui/icons-material';
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { mediaAPI } from '../services/api';

const StorageCostTracking = ({ refreshTrigger }) => {
  const [costData, setCostData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCostData();
  }, [refreshTrigger]);

  const fetchCostData = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await mediaAPI.getStorageCosts();
      setCostData(response.data);
    } catch (error) {
      console.error('Error fetching cost data:', error);
      setError('Failed to load cost data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4
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

  if (loading) {
    return (
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Loading Storage Costs
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
            No cost data available. Upload some files to see storage costs.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Convert cost_breakdown object to array for charts
  const tierBreakdown = costData.cost_breakdown ? Object.entries(costData.cost_breakdown).map(([tier, cost]) => ({
    tier,
    monthly_cost: cost,
    file_count: 0, // We don't have file count per tier in the current API
    total_size: 0  // We don't have size per tier in the current API
  })) : [];

  const pieData = tierBreakdown.map(tier => ({
    name: tier.tier.replace('_', ' ').toUpperCase(),
    value: tier.monthly_cost,
    color: getTierColor(tier.tier)
  }));

  const barData = tierBreakdown.map(tier => ({
    tier: tier.tier.replace('_', ' ').toUpperCase(),
    cost: tier.monthly_cost,
    files: tier.file_count,
    size: tier.total_size
  }));

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Money color="primary" />
            <Typography variant="h6">
              Storage Cost Analysis
            </Typography>
          </Box>
          <IconButton onClick={fetchCostData} color="primary">
            <Refresh />
          </IconButton>
        </Box>

        <Grid container spacing={3}>
          {/* Summary Cards */}
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Money color="primary" />
                  <Typography variant="h6">
                    {formatCurrency(costData.total_monthly_cost)}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Total Monthly Cost
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Storage color="info" />
                  <Typography variant="h6">
                    {formatFileSize(costData.total_storage_size)}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Total Storage Used
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <TrendingUp color="success" />
                  <Typography variant="h6">
                    {costData.total_files}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Total Files
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Cost Breakdown Chart */}
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>
              Cost Distribution
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(value) => formatCurrency(value)} />
              </RechartsPieChart>
            </ResponsiveContainer>
          </Grid>

          {/* Tier Comparison Chart */}
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>
              Tier Comparison
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsBarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tier" />
                <YAxis />
                <RechartsTooltip 
                  formatter={(value, name) => [
                    name === 'cost' ? formatCurrency(value) : value,
                    name === 'cost' ? 'Cost' : 'Files'
                  ]}
                />
                <Legend />
                <Bar dataKey="cost" fill="#8884d8" name="Monthly Cost" />
              </RechartsBarChart>
            </ResponsiveContainer>
          </Grid>

          {/* Detailed Breakdown Table */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Detailed Breakdown
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Storage Tier</TableCell>
                    <TableCell align="right">Files</TableCell>
                    <TableCell align="right">Size</TableCell>
                    <TableCell align="right">Monthly Cost</TableCell>
                    <TableCell align="right">Cost per GB</TableCell>
                    <TableCell align="right">Avg File Size</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tierBreakdown.map((tier) => (
                    <TableRow key={tier.tier}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box
                            sx={{
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              backgroundColor: getTierColor(tier.tier)
                            }}
                          />
                          <Typography variant="body2">
                            {tier.tier.replace('_', ' ').toUpperCase()}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Chip label={tier.file_count} size="small" />
                      </TableCell>
                      <TableCell align="right">
                        {formatFileSize(tier.total_size)}
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="bold">
                          {formatCurrency(tier.monthly_cost)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(tier.cost_per_gb)}
                      </TableCell>
                      <TableCell align="right">
                        {formatFileSize(tier.avg_file_size)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
        </Grid>

        {/* Cost Optimization Tips */}
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>Cost Optimization Tips:</strong>
            <br />
            • Move rarely accessed files to Glacier or Deep Archive for up to 90% cost savings
            <br />
            • Use Intelligent Tiering for automatic cost optimization
            <br />
            • Consider lifecycle policies for automatic tier transitions
          </Typography>
        </Alert>
      </CardContent>
    </Card>
  );
};

export default StorageCostTracking;
