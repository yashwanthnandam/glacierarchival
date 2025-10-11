import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Typography,
  IconButton,
  Button,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Slider,
  Checkbox,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Tooltip,
  Badge,
  Avatar,
  Stack,
  Autocomplete,
  Popper,
  Fade,
  ClickAwayListener
} from '@mui/material';
import {
  Search,
  FilterList,
  Clear,
  History,
  TrendingUp,
  Star,
  Schedule,
  Folder,
  InsertDriveFile,
  Image,
  VideoFile,
  AudioFile,
  Description,
  Code,
  Archive as ArchiveIcon,
  CloudDownload,
  Archive,
  RestoreFromTrash,
  MoreVert,
  ExpandMore,
  Close,
  Check,
  Refresh
} from '@mui/icons-material';

const SmartSearch = ({ 
  files = [], 
  onSearch, 
  onFilter, 
  onFileSelect,
  loading = false,
  searchHistory = [],
  onClearHistory
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    type: 'all',
    status: 'all',
    sizeRange: [0, 1000],
    dateRange: 'all',
    tags: []
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [popularSearches, setPopularSearches] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // File type options
  const fileTypes = [
    { value: 'all', label: 'All Types' },
    { value: 'image', label: 'Images' },
    { value: 'video', label: 'Videos' },
    { value: 'audio', label: 'Audio' },
    { value: 'application', label: 'Documents' },
    { value: 'text', label: 'Text' },
    { value: 'archive', label: 'Archives' }
  ];

  // Status options
  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'uploaded', label: 'Uploaded' },
    { value: 'archiving', label: 'Archiving' },
    { value: 'archived', label: 'Archived' },
    { value: 'restoring', label: 'Restoring' },
    { value: 'restored', label: 'Restored' },
    { value: 'failed', label: 'Failed' }
  ];

  // Date range options
  const dateRangeOptions = [
    { value: 'all', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'year', label: 'This Year' }
  ];

  // Popular search terms
  const popularTerms = [
    'recent files',
    'large files',
    'images',
    'videos',
    'archived',
    'failed uploads'
  ];

  // Search suggestions based on current query
  const searchSuggestions = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    
    const suggestions = [];
    
    // File name suggestions
    const nameMatches = files
      .filter(file => 
        file.original_filename.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .slice(0, 5)
      .map(file => ({
        type: 'file',
        label: file.original_filename,
        value: file.original_filename,
        icon: <InsertDriveFile />
      }));
    
    // File type suggestions
    const typeMatches = fileTypes
      .filter(type => 
        type.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .map(type => ({
        type: 'filter',
        label: `Type: ${type.label}`,
        value: `type:${type.value}`,
        icon: <FilterList />
      }));
    
    // Status suggestions
    const statusMatches = statusOptions
      .filter(status => 
        status.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .map(status => ({
        type: 'filter',
        label: `Status: ${status.label}`,
        value: `status:${status.value}`,
        icon: <FilterList />
      }));
    
    return [...nameMatches, ...typeMatches, ...statusMatches];
  }, [searchQuery, files]);

  // Perform search
  const performSearch = (query, filterOptions = filters) => {
    setIsSearching(true);
    
    let results = [...files];
    
    // Text search
    if (query) {
      const searchTerms = query.toLowerCase().split(' ');
      results = results.filter(file => {
        const filename = file.original_filename.toLowerCase();
        const fileType = file.file_type.toLowerCase();
        const status = file.status.toLowerCase();
        
        return searchTerms.every(term => 
          filename.includes(term) || 
          fileType.includes(term) || 
          status.includes(term)
        );
      });
    }
    
    // Apply filters
    if (filterOptions.type !== 'all') {
      results = results.filter(file => 
        file.file_type.startsWith(filterOptions.type)
      );
    }
    
    if (filterOptions.status !== 'all') {
      results = results.filter(file => file.status === filterOptions.status);
    }
    
    if (filterOptions.sizeRange[0] > 0 || filterOptions.sizeRange[1] < 1000) {
      results = results.filter(file => {
        const sizeMB = file.file_size / (1024 * 1024);
        return sizeMB >= filterOptions.sizeRange[0] && sizeMB <= filterOptions.sizeRange[1];
      });
    }
    
    // Date filter
    if (filterOptions.dateRange !== 'all') {
      const now = new Date();
      const cutoff = new Date();
      
      switch (filterOptions.dateRange) {
        case 'today':
          cutoff.setHours(0, 0, 0, 0);
          break;
        case 'week':
          cutoff.setDate(now.getDate() - 7);
          break;
        case 'month':
          cutoff.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          cutoff.setFullYear(now.getFullYear() - 1);
          break;
      }
      
      results = results.filter(file => 
        new Date(file.uploaded_at) >= cutoff
      );
    }
    
    setSearchResults(results);
    setIsSearching(false);
    
    if (onSearch) {
      onSearch(results, query, filterOptions);
    }
  };

  // Handle search input change
  const handleSearchChange = (event) => {
    const value = event.target.value;
    setSearchQuery(value);
    
    if (value.length >= 2) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  // Handle search submit
  const handleSearchSubmit = (event) => {
    event.preventDefault();
    performSearch(searchQuery);
    setShowSuggestions(false);
    
    // Add to recent searches
    if (searchQuery && !recentSearches.includes(searchQuery)) {
      setRecentSearches(prev => [searchQuery, ...prev.slice(0, 9)]);
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion) => {
    if (suggestion.type === 'file') {
      setSearchQuery(suggestion.value);
      performSearch(suggestion.value);
    } else if (suggestion.type === 'filter') {
      // Parse filter and apply
      const [filterType, filterValue] = suggestion.value.split(':');
      setFilters(prev => ({
        ...prev,
        [filterType]: filterValue
      }));
      performSearch(searchQuery, { ...filters, [filterType]: filterValue });
    }
    setShowSuggestions(false);
  };

  // Handle filter change
  const handleFilterChange = (filterType, value) => {
    const newFilters = { ...filters, [filterType]: value };
    setFilters(newFilters);
    performSearch(searchQuery, newFilters);
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowSuggestions(false);
    if (onSearch) {
      onSearch(files, '', filters);
    }
  };

  // Clear filters
  const clearFilters = () => {
    const defaultFilters = {
      type: 'all',
      status: 'all',
      sizeRange: [0, 1000],
      dateRange: 'all',
      tags: []
    };
    setFilters(defaultFilters);
    performSearch(searchQuery, defaultFilters);
  };

  // Get file type icon
  const getFileIcon = (file) => {
    const type = file.file_type.toLowerCase();
    if (type.startsWith('image/')) return <Image color="primary" />;
    if (type.startsWith('video/')) return <VideoFile color="secondary" />;
    if (type.startsWith('audio/')) return <AudioFile color="success" />;
    if (type.includes('pdf') || type.includes('document')) return <Description color="error" />;
    if (type.includes('text') || type.includes('code')) return <Code color="info" />;
    if (type.includes('zip') || type.includes('archive')) return <ArchiveIcon color="warning" />;
    return <InsertDriveFile color="action" />;
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

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Search Bar */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box component="form" onSubmit={handleSearchSubmit}>
          <TextField
            fullWidth
            placeholder="Search files, types, status..."
            value={searchQuery}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  {searchQuery && (
                    <IconButton onClick={clearSearch} size="small">
                      <Clear />
                    </IconButton>
                  )}
                  <IconButton 
                    onClick={() => setShowFilters(!showFilters)} 
                    size="small"
                    color={showFilters ? 'primary' : 'default'}
                  >
                      <Badge badgeContent={Object.values(filters).filter(v => v !== 'all' && JSON.stringify(v) !== JSON.stringify([0, 1000])).length} color="primary">
                      <FilterList />
                    </Badge>
                  </IconButton>
                </InputAdornment>
              )
            }}
            sx={{ mb: 1 }}
          />
          
          {/* Search Suggestions */}
          {showSuggestions && searchSuggestions.length > 0 && (
            <Paper sx={{ position: 'absolute', zIndex: 1000, width: '100%', maxHeight: 300, overflow: 'auto' }}>
              <List dense>
                {searchSuggestions.map((suggestion, index) => (
                  <ListItem
                    key={index}
                    button
                    onClick={() => handleSuggestionClick(suggestion)}
                    sx={{ '&:hover': { bgcolor: 'action.hover' } }}
                  >
                    <ListItemIcon>
                      {suggestion.icon}
                    </ListItemIcon>
                    <ListItemText primary={suggestion.label} />
                  </ListItem>
                ))}
              </List>
            </Paper>
          )}
        </Box>

        {/* Quick Search Suggestions */}
        {!searchQuery && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Popular searches:
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {popularTerms.map((term, index) => (
                <Chip
                  key={index}
                  label={term}
                  size="small"
                  onClick={() => {
                    setSearchQuery(term);
                    performSearch(term);
                  }}
                  sx={{ mb: 1 }}
                />
              ))}
            </Stack>
          </Box>
        )}
      </Paper>

      {/* Advanced Filters */}
      {showFilters && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Filters</Typography>
            <Button size="small" onClick={clearFilters}>
              Clear All
            </Button>
          </Box>
          
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>File Type</InputLabel>
                <Select
                  value={filters.type}
                  onChange={(e) => handleFilterChange('type', e.target.value)}
                  label="File Type"
                >
                  {fileTypes.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  label="Status"
                >
                  {statusOptions.map((status) => (
                    <MenuItem key={status.value} value={status.value}>
                      {status.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Date Range</InputLabel>
                <Select
                  value={filters.dateRange}
                  onChange={(e) => handleFilterChange('dateRange', e.target.value)}
                  label="Date Range"
                >
                  {dateRangeOptions.map((range) => (
                    <MenuItem key={range.value} value={range.value}>
                      {range.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Box>
                <Typography variant="body2" gutterBottom>
                  File Size (MB): {filters.sizeRange[0]} - {filters.sizeRange[1]}
                </Typography>
                <Slider
                  value={filters.sizeRange}
                  onChange={(e, newValue) => handleFilterChange('sizeRange', newValue)}
                  valueLabelDisplay="auto"
                  min={0}
                  max={1000}
                  step={10}
                />
              </Box>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <Paper sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Search Results ({searchResults.length})
            </Typography>
            <Button size="small" onClick={clearSearch}>
              Clear Results
            </Button>
          </Box>
          
          <List>
            {searchResults.map((file, index) => (
              <React.Fragment key={file.id}>
                <ListItem
                  button
                  onClick={() => onFileSelect && onFileSelect(file, 'view')}
                  sx={{ '&:hover': { bgcolor: 'action.hover' } }}
                >
                  <ListItemIcon>
                    {getFileIcon(file)}
                  </ListItemIcon>
                  <ListItemText
                    primary={file.original_filename}
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
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
                  <ListItemSecondaryAction>
                    <IconButton size="small">
                      <MoreVert />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
                {index < searchResults.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </Paper>
      )}

      {/* Recent Searches */}
      {recentSearches.length > 0 && !searchQuery && (
        <Paper sx={{ p: 2, mt: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Recent Searches</Typography>
            <Button size="small" onClick={() => setRecentSearches([])}>
              Clear History
            </Button>
          </Box>
          
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {recentSearches.map((search, index) => (
              <Chip
                key={index}
                label={search}
                size="small"
                onClick={() => {
                  setSearchQuery(search);
                  performSearch(search);
                }}
                onDelete={() => {
                  setRecentSearches(prev => prev.filter((_, i) => i !== index));
                }}
                sx={{ mb: 1 }}
              />
            ))}
          </Stack>
        </Paper>
      )}
    </Box>
  );
};

export default SmartSearch;
