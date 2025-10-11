import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Avatar,
  Divider,
  Paper,
  IconButton,
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Stack
} from '@mui/material';
import {
  Storage,
  CloudUpload,
  Archive,
  RestoreFromTrash,
  TrendingUp,
  TrendingDown,
  PieChart,
  BarChart,
  Timeline,
  Refresh,
  Info,
  Warning,
  CheckCircle,
  Error,
  Schedule,
  Speed,
  Folder,
  InsertDriveFile,
  Image,
  VideoFile,
  AudioFile,
  Description,
  Code,
  Archive as ArchiveIcon,
  CloudDone,
  CloudSync,
  CloudOff
} from '@mui/icons-material';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';

const StorageAnalytics = ({ files = [], jobs = [], loading = false, onRefresh }) => {
  const [timeRange, setTimeRange] = useState('7d');
  const [viewMode, setViewMode] = useState('overview');
  const [detailedView, setDetailedView] = useState(null);

  // Calculate analytics data
  const analytics = React.useMemo(() => {
    const totalFiles = files.length;
    const totalSize = files.reduce((sum, file) => sum + file.file_size, 0);
    
    // File type distribution
    const typeDistribution = files.reduce((acc, file) => {
      const type = file.file_type.split('/')[0];
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    // Status distribution
    const statusDistribution = files.reduce((acc, file) => {
      acc[file.status] = (acc[file.status] || 0) + 1;
      return acc;
    }, {});

    // Size distribution
    const sizeDistribution = files.reduce((acc, file) => {
      const sizeMB = file.file_size / (1024 * 1024);
      if (sizeMB < 1) acc['< 1MB'] = (acc['< 1MB'] || 0) + 1;
      else if (sizeMB < 10) acc['1-10MB'] = (acc['1-10MB'] || 0) + 1;
      else if (sizeMB < 100) acc['10-100MB'] = (acc['10-100MB'] || 0) + 1;
      else if (sizeMB < 1000) acc['100MB-1GB'] = (acc['100MB-1GB'] || 0) + 1;
      else acc['> 1GB'] = (acc['> 1GB'] || 0) + 1;
      return acc;
    }, {});

    // Storage efficiency
    const archivedFiles = files.filter(f => f.status === 'archived').length;
    const archivedSize = files
      .filter(f => f.status === 'archived')
      .reduce((sum, file) => sum + file.file_size, 0);
    
    const storageEfficiency = totalSize > 0 ? (archivedSize / totalSize) * 100 : 0;

    // Recent activity
    const recentFiles = files
      .sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at))
      .slice(0, 5);

    // Job statistics
    const completedJobs = jobs.filter(j => j.status === 'completed').length;
    const failedJobs = jobs.filter(j => j.status === 'failed').length;
    const inProgressJobs = jobs.filter(j => j.status === 'in_progress').length;

    return {
      totalFiles,
      totalSize,
      typeDistribution,
      statusDistribution,
      sizeDistribution,
      storageEfficiency,
      archivedFiles,
      archivedSize,
      recentFiles,
      completedJobs,
      failedJobs,
      inProgressJobs
    };
  }, [files, jobs]);

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get file type icon
  const getFileTypeIcon = (type) => {
    switch (type) {
      case 'image': return <Image color="primary" />;
      case 'video': return <VideoFile color="secondary" />;
      case 'audio': return <AudioFile color="success" />;
      case 'application': return <Description color="error" />;
      case 'text': return <Code color="info" />;
      default: return <InsertDriveFile color="action" />;
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'uploaded': return 'success';
      case 'archiving': return 'warning';
      case 'archived': return 'info';
      case 'restoring': return 'warning';
      case 'restored': return 'success';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  // Chart data for file types
  const typeChartData = Object.entries(analytics.typeDistribution).map(([type, count]) => ({
    name: type,
    value: count,
    percentage: ((count / analytics.totalFiles) * 100).toFixed(1)
  }));

  // Chart data for status
  const statusChartData = Object.entries(analytics.statusDistribution).map(([status, count]) => ({
    name: status,
    value: count,
    percentage: ((count / analytics.totalFiles) * 100).toFixed(1)
  }));

  // Chart data for size distribution
  const sizeChartData = Object.entries(analytics.sizeDistribution).map(([range, count]) => ({
    name: range,
    value: count
  }));

  // COLORS for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h1">
          Storage Analytics
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              label="Time Range"
            >
              <MenuItem value="24h">Last 24 hours</MenuItem>
              <MenuItem value="7d">Last 7 days</MenuItem>
              <MenuItem value="30d">Last 30 days</MenuItem>
              <MenuItem value="90d">Last 90 days</MenuItem>
              <MenuItem value="1y">Last year</MenuItem>
            </Select>
          </FormControl>
          <IconButton onClick={onRefresh} disabled={loading}>
            <Refresh />
          </IconButton>
        </Box>
      </Box>

      {/* Overview Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Total Files
                  </Typography>
                  <Typography variant="h4">
                    {analytics.totalFiles}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'primary.light' }}>
                  <InsertDriveFile />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Total Storage
                  </Typography>
                  <Typography variant="h4">
                    {formatFileSize(analytics.totalSize)}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'success.light' }}>
                  <Storage />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Archived Files
                  </Typography>
                  <Typography variant="h4">
                    {analytics.archivedFiles}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'info.light' }}>
                  <Archive />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Storage Efficiency
                  </Typography>
                  <Typography variant="h4">
                    {analytics.storageEfficiency.toFixed(1)}%
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'warning.light' }}>
                  <TrendingUp />
                </Avatar>
              </Box>
              <LinearProgress
                variant="determinate"
                value={analytics.storageEfficiency}
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* File Type Distribution */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                File Type Distribution
              </Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <RechartsTooltip />
                    <Pie
                      data={typeChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) => `${name} (${percentage}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {typeChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                  </RechartsPieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Status Distribution */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                File Status Distribution
              </Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart data={statusChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <RechartsTooltip />
                    <Bar dataKey="value" fill="#8884d8" />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Size Distribution */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                File Size Distribution
              </Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart data={sizeChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <RechartsTooltip />
                    <Bar dataKey="value" fill="#82ca9d" />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Storage Efficiency Trend */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Storage Efficiency Trend
              </Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={[
                    { name: 'Week 1', efficiency: 45 },
                    { name: 'Week 2', efficiency: 52 },
                    { name: 'Week 3', efficiency: 48 },
                    { name: 'Week 4', efficiency: 61 },
                    { name: 'Current', efficiency: analytics.storageEfficiency }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <RechartsTooltip />
                    <Area type="monotone" dataKey="efficiency" stroke="#8884d8" fill="#8884d8" />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Detailed Analytics */}
      <Grid container spacing={3}>
        {/* File Type Breakdown */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                File Type Breakdown
              </Typography>
              <List dense>
                {Object.entries(analytics.typeDistribution).map(([type, count]) => (
                  <ListItem key={type}>
                    <ListItemIcon>
                      {getFileTypeIcon(type)}
                    </ListItemIcon>
                    <ListItemText
                      primary={type.charAt(0).toUpperCase() + type.slice(1)}
                      secondary={`${count} files`}
                    />
                    <Chip
                      label={`${((count / analytics.totalFiles) * 100).toFixed(1)}%`}
                      size="small"
                      variant="outlined"
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Status Breakdown */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Status Breakdown
              </Typography>
              <List dense>
                {Object.entries(analytics.statusDistribution).map(([status, count]) => (
                  <ListItem key={status}>
                    <ListItemIcon>
                      <Chip
                        label={status}
                        color={getStatusColor(status)}
                        size="small"
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={status.charAt(0).toUpperCase() + status.slice(1)}
                      secondary={`${count} files`}
                    />
                    <Chip
                      label={`${((count / analytics.totalFiles) * 100).toFixed(1)}%`}
                      size="small"
                      variant="outlined"
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Activity
              </Typography>
              <List>
                {analytics.recentFiles.map((file, index) => (
                  <React.Fragment key={file.id}>
                    <ListItem>
                      <ListItemIcon>
                        <Avatar sx={{ bgcolor: 'primary.light' }}>
                          <InsertDriveFile />
                        </Avatar>
                      </ListItemIcon>
                      <ListItemText
                        primary={file.original_filename}
                        secondary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption">
                              {formatFileSize(file.file_size)}
                            </Typography>
                            <Chip
                              label={file.status}
                              color={getStatusColor(file.status)}
                              size="small"
                            />
                            <Typography variant="caption" color="text.secondary">
                              {new Date(file.uploaded_at).toLocaleDateString()}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < analytics.recentFiles.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Job Statistics */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Job Statistics
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <CheckCircle color="success" sx={{ fontSize: 48, mb: 1 }} />
                    <Typography variant="h4">{analytics.completedJobs}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Completed Jobs
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Schedule color="warning" sx={{ fontSize: 48, mb: 1 }} />
                    <Typography variant="h4">{analytics.inProgressJobs}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      In Progress
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Error color="error" sx={{ fontSize: 48, mb: 1 }} />
                    <Typography variant="h4">{analytics.failedJobs}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Failed Jobs
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default StorageAnalytics;
