import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  AppBar,
  Toolbar,
  Avatar,
  Menu,
  MenuItem,
  Badge,
  useMediaQuery,
  useTheme,
  Tabs,
  Tab,
  LinearProgress
} from '../utils/muiImports';
import { STORAGE_KEYS } from '../constants';
import {
  Storage,
  CloudUpload,
  AcUnit,
  Notifications,
  Settings,
  Logout
} from '../utils/muiImports';

// Import our simplified components
import SimplifiedOverview from './SimplifiedOverview';
import HibernationPlanDashboard from './HibernationPlanDashboard';
import DataHibernateManager from './DataHibernateManager';
import FilePreview from './FilePreview';
import { authAPI } from '../services/api';

const ModernDashboard = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Simplified state management
  const [currentView, setCurrentView] = useState('overview');
  const [previewFile, setPreviewFile] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileMenuAnchor, setProfileMenuAnchor] = useState(null);
  const [globalSearch, setGlobalSearch] = useState('');

  // Navigation items - simplified
  const navigationItems = [
    { id: 'overview', label: 'Overview', icon: <Storage />, view: 'overview' },
    { id: 'hibernate', label: 'Data Hibernate', icon: <AcUnit />, view: 'hibernate' },
    { id: 'plans', label: 'Plans', icon: <CloudUpload />, view: 'plans' }
  ];

  // Load user data on component mount
  useEffect(() => {
    loadUserData();
  }, []);

  // Load user data
  const loadUserData = async () => {
    try {
      const response = await authAPI.getUser();
      setUser(response.data);
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER);
      window.location.href = '/login';
    } catch (error) {
      // Only log errors in development
      if (import.meta.env.VITE_DEBUG === 'true') {
        console.error('Error during logout:', error);
      }
      window.location.href = '/login';
    }
  };

  // Handle profile menu
  const handleProfileMenuOpen = (event) => {
    setProfileMenuAnchor(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setProfileMenuAnchor(null);
  };

  // Handle file selection
  const handleFileSelect = async (file, action) => {
    if (action === 'view') {
      setPreviewFile(file);
    }
  };

  // Handle folder selection
  const handleFolderSelect = (folderPath) => {
    // Folder selection logic can be added here if needed
  };

  // Render current view - simplified
  const renderCurrentView = () => {
    switch (currentView) {
      case 'overview':
        return <SimplifiedOverview />;
      
      case 'hibernate':
        return (
          <DataHibernateManager
            onFileSelect={handleFileSelect}
            onFolderSelect={handleFolderSelect}
            globalSearchQuery={globalSearch}
          />
        );
      
      case 'plans':
        return <HibernationPlanDashboard />;
      
      default:
        return <SimplifiedOverview />;
    }
  };

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setCurrentView(newValue);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <LinearProgress sx={{ width: '100%', maxWidth: 400 }} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'grey.50' }}>
      {/* Top App Bar */}
      <AppBar position="static" elevation={1} sx={{ bgcolor: 'white', color: 'text.primary' }}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ fontWeight: 'bold', mr: 4 }}>
            Glacier Archival
          </Typography>

          {/* Navigation Tabs */}
          <Tabs
            value={currentView}
            onChange={handleTabChange}
            sx={{ flexGrow: 1 }}
            variant={isMobile ? 'scrollable' : 'standard'}
            scrollButtons="auto"
          >
            {navigationItems.map((item) => (
              <Tab
                key={item.id}
                value={item.view}
                label={item.label}
                icon={item.icon}
                iconPosition="start"
                sx={{ minHeight: 48 }}
              />
            ))}
          </Tabs>

          {/* Right side actions */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton color="inherit">
              <Badge badgeContent={0} color="error">
                <Notifications />
              </Badge>
            </IconButton>

            <IconButton color="inherit" onClick={handleProfileMenuOpen}>
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                {user?.username?.charAt(0) || 'U'}
              </Avatar>
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Main Content Area */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', bgcolor: 'grey.50' }}>
        {renderCurrentView()}
      </Box>

      {/* Profile Menu */}
      {profileMenuAnchor && (
        <Menu
          anchorEl={profileMenuAnchor}
          open={Boolean(profileMenuAnchor)}
          onClose={handleProfileMenuClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <MenuItem onClick={handleProfileMenuClose}>
            <Settings sx={{ mr: 1 }} />
            Settings
          </MenuItem>
          <MenuItem onClick={handleLogout}>
            <Logout sx={{ mr: 1 }} />
            Logout
          </MenuItem>
        </Menu>
      )}

      {/* File Preview Dialog */}
      {previewFile && (
        <FilePreview
          file={previewFile}
          open={Boolean(previewFile)}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </Box>
  );
};

export default ModernDashboard;