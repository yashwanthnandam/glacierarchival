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
import secureTokenStorage from '../utils/secureTokenStorage';
import { authAPI } from '../services/api';
import {
  Storage,
  CloudUpload,
  AcUnit,
  Notifications,
  Settings,
  Logout,
  Security,
  Lock,
  LockOpen,
  Info
} from '../utils/muiImports';

// Import our simplified components
import SimplifiedOverview from './SimplifiedOverview';
import HibernationPlanDashboard from './HibernationPlanDashboard';
import DataHibernateManager from './DataHibernateManager';
import FilePreview from './FilePreview';
import MasterPasswordDialog from './MasterPasswordDialog';
import WhyDataHibernate from './WhyDataHibernate';
import encryptionService from '../services/encryptionService';

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
  
  // Encryption state
  const [encryptionEnabled, setEncryptionEnabled] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [encryptionStatus, setEncryptionStatus] = useState(null);

  // Navigation items - simplified
  const navigationItems = [
    { id: 'overview', label: 'Overview', icon: <Storage />, view: 'overview' },
    { id: 'hibernate', label: 'Data Manager', icon: <AcUnit />, view: 'hibernate' },
    { id: 'plans', label: 'Plans', icon: <CloudUpload />, view: 'plans' },
    { id: 'why', label: 'Why Data Hibernate', icon: <Info />, view: 'why' }
  ];

  // Load user data on component mount
  useEffect(() => {
    loadUserData();
    checkEncryptionStatus();
    
    // Check for hash fragment to set initial tab
    const hash = window.location.hash.substring(1); // Remove the # symbol
    if (hash && ['overview', 'hibernate', 'plans', 'why'].includes(hash)) {
      setCurrentView(hash);
    }
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

  // Check encryption status
  const checkEncryptionStatus = () => {
    const status = encryptionService.getEncryptionStatus();
    setEncryptionEnabled(status.enabled);
    setEncryptionStatus(status);
  };

  // Handle encryption toggle
  const handleEncryptionToggle = () => {
    if (encryptionEnabled) {
      // Disable encryption
      encryptionService.disableEncryption();
      setEncryptionEnabled(false);
      setEncryptionStatus(null);
    } else {
      // Show password dialog to enable encryption
      setShowPasswordDialog(true);
    }
  };

  // Handle password set
  const handlePasswordSet = (password) => {
    checkEncryptionStatus();
    setShowPasswordDialog(false);
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      const useSecureAuth = import.meta.env.VITE_USE_SECURE_AUTH === 'true';
      
      if (useSecureAuth) {
        // Use secure logout endpoint to clear httpOnly cookies
        await authAPI.secureLogout();
      } else {
        // Legacy logout - clear localStorage
        secureTokenStorage.clearTokens();
      }
      
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
      
      case 'why':
        return <WhyDataHibernate />;
      
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
        <Toolbar sx={{ 
          minHeight: { xs: 56, sm: 64 },
          px: { xs: 1, sm: 2 },
          flexWrap: { xs: 'wrap', sm: 'nowrap' }
        }}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            mr: { xs: 2, sm: 4 },
            minWidth: { xs: 'auto', sm: 'auto' }
          }}>
            <Box
              component="img"
              src="/icon.png"
              alt="DataHibernate Logo"
              sx={{
                width: { xs: 28, sm: 32 },
                height: { xs: 28, sm: 32 },
                mr: { xs: 1, sm: 1.5 },
                borderRadius: 1
              }}
            />
            <Typography 
              variant="h6" 
              component="div" 
              sx={{ 
                fontWeight: 'bold',
                fontSize: { xs: '1rem', sm: '1.25rem' },
                display: { xs: 'none', sm: 'block' } // Hide text on very small screens
              }}
            >
              Data Hibernate
            </Typography>
          </Box>

          {/* Navigation Tabs */}
          <Tabs
            value={currentView}
            onChange={handleTabChange}
            sx={{ 
              flexGrow: 1,
              '& .MuiTab-root': {
                minHeight: { xs: 40, sm: 48 },
                fontSize: { xs: '0.75rem', sm: '0.875rem' },
                px: { xs: 1, sm: 2 },
                textTransform: 'none',
                fontWeight: 600
              },
              '& .MuiTabs-indicator': {
                height: { xs: 2, sm: 3 }
              }
            }}
            variant={isMobile ? 'scrollable' : 'standard'}
            scrollButtons="auto"
            allowScrollButtonsMobile
          >
            {navigationItems.map((item) => (
              <Tab
                key={item.id}
                value={item.view}
                label={item.label}
                icon={item.icon}
                iconPosition="start"
                sx={{ 
                  minHeight: { xs: 40, sm: 48 },
                  fontSize: { xs: '0.75rem', sm: '0.875rem' },
                  px: { xs: 1, sm: 2 },
                  '& .MuiSvgIcon-root': {
                    fontSize: { xs: '1rem', sm: '1.25rem' }
                  }
                }}
              />
            ))}
          </Tabs>

          {/* Right side actions */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: { xs: 0.5, sm: 1 },
            ml: { xs: 1, sm: 2 }
          }}>
            {/* Encryption Toggle */}
            <IconButton 
              color="inherit" 
              onClick={handleEncryptionToggle}
              title={encryptionEnabled ? 'Disable E2E Encryption' : 'Enable E2E Encryption'}
              size="small"
              sx={{ 
                color: encryptionEnabled ? 'success.main' : 'text.secondary',
                '&:hover': {
                  bgcolor: encryptionEnabled ? 'success.light' : 'action.hover'
                },
                p: { xs: 0.5, sm: 1 }
              }}
            >
              {encryptionEnabled ? <Lock /> : <LockOpen />}
            </IconButton>

            <IconButton color="inherit" size="small" sx={{ p: { xs: 0.5, sm: 1 } }}>
              <Badge badgeContent={0} color="error">
                <Notifications />
              </Badge>
            </IconButton>

            <IconButton color="inherit" onClick={handleProfileMenuOpen} size="small" sx={{ p: { xs: 0.5, sm: 1 } }}>
              <Avatar sx={{ 
                width: { xs: 28, sm: 32 }, 
                height: { xs: 28, sm: 32 }, 
                bgcolor: 'primary.main',
                fontSize: { xs: '0.75rem', sm: '0.875rem' }
              }}>
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

      {/* Master Password Dialog */}
      <MasterPasswordDialog
        open={showPasswordDialog}
        onClose={() => setShowPasswordDialog(false)}
        onPasswordSet={handlePasswordSet}
      />
    </Box>
  );
};

export default ModernDashboard;