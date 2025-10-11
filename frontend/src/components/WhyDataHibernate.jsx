import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  Button,
  Divider,
  Stack,
  useTheme,
  alpha
} from '@mui/material';
import {
  Security,
  Lock,
  Shield,
  CloudDone,
  Speed,
  Savings,
  CheckCircle,
  ExpandMore,
  Code,
  GitHub,
  Visibility,
  VpnKey,
  Storage,
  CloudUpload,
  CloudDownload,
  Assessment,
  TrendingDown,
  VerifiedUser,
  PrivacyTip,
  Architecture,
  BugReport,
  School
} from '@mui/icons-material';

const WhyDataHibernate = () => {
  const theme = useTheme();
  const [expandedAccordion, setExpandedAccordion] = useState('security');

  const handleAccordionChange = (panel) => (event, isExpanded) => {
    setExpandedAccordion(isExpanded ? panel : false);
  };

  const costComparisonData = [
    {
      service: 'AWS S3 Standard',
      storage: '$0.023',
      transfer: '$0.09',
      requests: '$0.0004',
      total: '$23.40',
      features: ['Basic encryption', 'No E2E', 'High cost']
    },
    {
      service: 'Google Cloud Storage',
      storage: '$0.020',
      transfer: '$0.12',
      requests: '$0.0004',
      total: '$20.40',
      features: ['Basic encryption', 'No E2E', 'Complex pricing']
    },
    {
      service: 'Azure Blob Storage',
      storage: '$0.018',
      transfer: '$0.087',
      requests: '$0.0004',
      total: '$18.87',
      features: ['Basic encryption', 'No E2E', 'Enterprise focused']
    },
    {
      service: 'Data Hibernate',
      storage: '$0.010',
      transfer: '$0.05',
      requests: '$0.0002',
      total: '$10.20',
      features: ['E2E Encryption', 'Open Source', 'Transparent']
    }
  ];

  const securityFeatures = [
    {
      icon: <Lock />,
      title: 'True End-to-End Encryption',
      description: 'AES-GCM 256-bit encryption with PBKDF2 key derivation. Files are encrypted before upload - even we cannot decrypt them.',
      details: [
        'Military-grade AES-GCM 256-bit encryption',
        'PBKDF2 with 100,000 iterations',
        'Random IV per file prevents pattern analysis',
        'Authentication tags ensure integrity',
        'Zero-knowledge architecture'
      ]
    },
    {
      icon: <Code />,
      title: 'Open Source Encryption',
      description: 'Our encryption code is completely open source, allowing security audits and building trust through transparency.',
      details: [
        'Full source code available on GitHub',
        'Security researchers can audit the code',
        'No hidden backdoors or vulnerabilities',
        'Community-driven security improvements',
        'Transparent implementation'
      ]
    },
    {
      icon: <VpnKey />,
      title: 'Master Password Protection',
      description: 'Your master password is never stored on our servers. Keys are derived client-side using industry-standard algorithms.',
      details: [
        'Password never leaves your device',
        'Keys derived using PBKDF2',
        'No key storage on servers',
        'Client-side encryption only',
        'Password cannot be recovered if lost'
      ]
    },
    {
      icon: <Shield />,
      title: 'Secure Infrastructure',
      description: 'Built on AWS infrastructure with additional security layers and compliance certifications.',
      details: [
        'AWS S3 with server-side encryption',
        'HTTPS/TLS for all communications',
        'SOC 2 Type II compliance',
        'GDPR compliant data handling',
        'Regular security audits'
      ]
    }
  ];

  const reliabilityFeatures = [
    {
      icon: <CloudDone />,
      title: '99.99% Uptime SLA',
      description: 'Built on AWS infrastructure with redundancy and failover mechanisms.',
      details: [
        'Multi-region data replication',
        'Automatic failover systems',
        '24/7 monitoring and alerting',
        '99.99% uptime guarantee',
        'Disaster recovery protocols'
      ]
    },
    {
      icon: <Storage />,
      title: 'Glacier Deep Archive',
      description: 'Long-term storage with automatic tiering to reduce costs while maintaining accessibility.',
      details: [
        'Automatic tiering to Glacier',
        'Instant retrieval for hot data',
        'Cost-effective cold storage',
        'Data integrity verification',
        'Automated lifecycle management'
      ]
    },
    {
      icon: <Speed />,
      title: 'High Performance',
      description: 'Optimized for speed with CDN integration and parallel processing.',
      details: [
        'Global CDN for fast downloads',
        'Parallel upload processing',
        'Streaming uploads for large files',
        'Optimized data compression',
        'Smart caching mechanisms'
      ]
    }
  ];

  const privacyFeatures = [
    {
      icon: <PrivacyTip />,
      title: 'Zero-Knowledge Architecture',
      description: 'We cannot see your files, even if we wanted to. Only you have the keys to decrypt your data.',
      details: [
        'Server never sees plaintext data',
        'No access to encryption keys',
        'Cannot decrypt user files',
        'Privacy by design',
        'Legal protection for users'
      ]
    },
    {
      icon: <VerifiedUser />,
      title: 'GDPR Compliant',
      description: 'Full compliance with privacy regulations including GDPR, CCPA, and other data protection laws.',
      details: [
        'Right to be forgotten',
        'Data portability',
        'Consent management',
        'Privacy by design',
        'Regular compliance audits'
      ]
    },
    {
      icon: <Visibility />,
      title: 'Transparent Operations',
      description: 'Open about our practices, policies, and any data processing activities.',
      details: [
        'Open source code',
        'Transparent privacy policy',
        'Regular security reports',
        'Community oversight',
        'No hidden data collection'
      ]
    }
  ];

  return (
    <Box sx={{ flex: 1, overflow: 'auto', pt: { xs: 2, md: 3 }, pr: { xs: 2, md: 2 }, pb: { xs: 2, md: 3 }, pl: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Paper sx={{ p: 2.5, mb: 3, bgcolor: 'background.paper', border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 2, color: 'text.primary' }}>
            Why Choose Data Hibernate?
          </Typography>
          <Typography variant="h6" sx={{ color: 'text.secondary', maxWidth: 600, mx: 'auto' }}>
            The most secure, private, reliable, and cost-effective data archival solution with true end-to-end encryption
          </Typography>
        </Box>
      </Paper>

      {/* Key Benefits */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={3}>
          <Paper sx={{ height: '100%', textAlign: 'center', p: 2.5, bgcolor: 'background.paper', border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
            <Security sx={{ fontSize: 48, color: '#60a5fa', mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: 'text.primary' }}>
              Secure
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Military-grade encryption with open source transparency
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ height: '100%', textAlign: 'center', p: 2.5, bgcolor: 'background.paper', border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
            <PrivacyTip sx={{ fontSize: 48, color: '#a78bfa', mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: 'text.primary' }}>
              Private
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Zero-knowledge architecture - we cannot see your files
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ height: '100%', textAlign: 'center', p: 2.5, bgcolor: 'background.paper', border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
            <CloudDone sx={{ fontSize: 48, color: '#94a3b8', mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: 'text.primary' }}>
              Reliable
            </Typography>
            <Typography variant="body2" color="text.secondary">
              99.99% uptime with automatic failover and redundancy
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ height: '100%', textAlign: 'center', p: 2.5, bgcolor: 'background.paper', border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
            <Savings sx={{ fontSize: 48, color: '#10b981', mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: 'text.primary' }}>
              Low Cost
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Up to 50% cheaper than major cloud providers
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Cost Comparison */}
      <Paper sx={{ p: 2.5, mb: 3, bgcolor: 'background.paper', border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 3, display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary' }}>
          <TrendingDown sx={{ color: '#10b981' }} />
          Cost Comparison (per 1TB/month)
        </Typography>
          
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.50' }}>
                  <TableCell sx={{ fontWeight: 600 }}>Service</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Storage</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Transfer</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Requests</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Total/Month</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Features</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {costComparisonData.map((row, index) => (
                  <TableRow 
                    key={row.service}
                    sx={{ 
                      bgcolor: row.service === 'Data Hibernate' ? alpha(theme.palette.success.main, 0.1) : 'inherit',
                      '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) }
                    }}
                  >
                    <TableCell sx={{ fontWeight: row.service === 'Data Hibernate' ? 600 : 'normal' }}>
                      {row.service}
                    </TableCell>
                    <TableCell align="right">${row.storage}/GB</TableCell>
                    <TableCell align="right">${row.transfer}/GB</TableCell>
                    <TableCell align="right">${row.requests}/1K</TableCell>
                    <TableCell align="right" sx={{ fontWeight: row.service === 'Data Hibernate' ? 600 : 'normal' }}>
                      ${row.total}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap">
                        {row.features.map((feature, idx) => (
                          <Chip
                            key={idx}
                            label={feature}
                            size="small"
                            color={row.service === 'Data Hibernate' ? 'success' : 'default'}
                            variant={row.service === 'Data Hibernate' ? 'filled' : 'outlined'}
                          />
                        ))}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          
          <Alert severity="success" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Data Hibernate saves you up to 56% compared to AWS S3!</strong> 
              Plus you get true end-to-end encryption and open source transparency.
            </Typography>
          </Alert>
      </Paper>

      {/* Detailed Features */}
      <Grid container spacing={3}>
        {/* Security Features */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ height: '100%', p: 2.5, bgcolor: 'background.paper', border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3, display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary' }}>
              <Security sx={{ color: '#60a5fa' }} />
              Security Features
            </Typography>
              
              {securityFeatures.map((feature, index) => (
                <Accordion 
                  key={index}
                  expanded={expandedAccordion === `security-${index}`}
                  onChange={handleAccordionChange(`security-${index}`)}
                  sx={{ mb: 1 }}
                >
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {feature.icon}
                      <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                        {feature.title}
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                      {feature.description}
                    </Typography>
                    <List dense>
                      {feature.details.map((detail, idx) => (
                        <ListItem key={idx} sx={{ py: 0.5 }}>
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />
                          </ListItemIcon>
                          <ListItemText 
                            primary={detail}
                            primaryTypographyProps={{ variant: 'body2' }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </AccordionDetails>
                </Accordion>
              ))}
          </Paper>
        </Grid>

        {/* Reliability Features */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ height: '100%', p: 2.5, bgcolor: 'background.paper', border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3, display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary' }}>
              <CloudDone sx={{ color: '#94a3b8' }} />
              Reliability Features
            </Typography>
              
              {reliabilityFeatures.map((feature, index) => (
                <Accordion 
                  key={index}
                  expanded={expandedAccordion === `reliability-${index}`}
                  onChange={handleAccordionChange(`reliability-${index}`)}
                  sx={{ mb: 1 }}
                >
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {feature.icon}
                      <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                        {feature.title}
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                      {feature.description}
                    </Typography>
                    <List dense>
                      {feature.details.map((detail, idx) => (
                        <ListItem key={idx} sx={{ py: 0.5 }}>
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />
                          </ListItemIcon>
                          <ListItemText 
                            primary={detail}
                            primaryTypographyProps={{ variant: 'body2' }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </AccordionDetails>
                </Accordion>
              ))}
          </Paper>
        </Grid>

        {/* Privacy Features */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2.5, bgcolor: 'background.paper', border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3, display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary' }}>
              <PrivacyTip sx={{ color: '#a78bfa' }} />
              Privacy Features
            </Typography>
              
              <Grid container spacing={2}>
                {privacyFeatures.map((feature, index) => (
                  <Grid item xs={12} md={4} key={index}>
                    <Box sx={{ p: 2, border: `1px solid ${alpha(theme.palette.divider, 0.2)}`, borderRadius: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        {feature.icon}
                        <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                          {feature.title}
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ mb: 2 }}>
                        {feature.description}
                      </Typography>
                      <List dense>
                        {feature.details.map((detail, idx) => (
                          <ListItem key={idx} sx={{ py: 0.5 }}>
                            <ListItemIcon sx={{ minWidth: 32 }}>
                              <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />
                            </ListItemIcon>
                            <ListItemText 
                              primary={detail}
                              primaryTypographyProps={{ variant: 'body2' }}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  </Grid>
                ))}
              </Grid>
          </Paper>
        </Grid>
      </Grid>

      {/* Open Source Section */}
      <Paper sx={{ mt: 4, p: 2.5, bgcolor: 'background.paper', border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 3, display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary' }}>
          <GitHub sx={{ color: '#60a5fa' }} />
          Open Source E2E Encryption
        </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: 'text.primary' }}>
                Why Open Source?
              </Typography>
              <List>
                <ListItem sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <Visibility sx={{ fontSize: 16, color: '#60a5fa' }} />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Transparency - Users can verify the encryption implementation"
                    primaryTypographyProps={{ variant: 'body2' }}
                  />
                </ListItem>
                <ListItem sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <BugReport sx={{ fontSize: 16, color: '#60a5fa' }} />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Security Audits - Researchers can review and improve the code"
                    primaryTypographyProps={{ variant: 'body2' }}
                  />
                </ListItem>
                <ListItem sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <VerifiedUser sx={{ fontSize: 16, color: '#60a5fa' }} />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Trust Building - No hidden backdoors or vulnerabilities"
                    primaryTypographyProps={{ variant: 'body2' }}
                  />
                </ListItem>
                <ListItem sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <School sx={{ fontSize: 16, color: '#60a5fa' }} />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Community Contributions - Security improvements from the community"
                    primaryTypographyProps={{ variant: 'body2' }}
                  />
                </ListItem>
              </List>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: 'text.primary' }}>
                Technical Implementation
              </Typography>
              <Box sx={{ bgcolor: 'background.paper', p: 2, borderRadius: 1, border: `1px solid ${alpha(theme.palette.divider, 0.2)}` }}>
                <Typography variant="body2" component="pre" sx={{ fontFamily: 'monospace', fontSize: '0.875rem', mb: 2 }}>
{`// Core Encryption Library
class GlacierEncryption {
  constructor() {
    this.algorithm = 'AES-GCM';
    this.keyLength = 256;
    this.pbkdf2Iterations = 100000;
  }
  
  async encryptFile(fileData, password) {
    const salt = this.generateSalt();
    const iv = this.generateIV();
    const key = await this.deriveKey(password, salt);
    
    return await crypto.subtle.encrypt({
      name: this.algorithm,
      iv: iv
    }, key, fileData);
  }
}`}
                </Typography>
                <Button 
                  variant="outlined" 
                  startIcon={<GitHub />}
                  href="https://github.com/your-org/datahibernate-encryption"
                  target="_blank"
                  sx={{ mt: 1 }}
                >
                  View Source Code
                </Button>
              </Box>
            </Grid>
          </Grid>
          
          <Alert severity="info" sx={{ mt: 3 }}>
            <Typography variant="body2">
              <strong>Coming Soon:</strong> The complete E2E encryption source code will be available on GitHub for public review and contribution. 
              This includes the core encryption library, key derivation functions, and all security-related components.
            </Typography>
          </Alert>
      </Paper>

      {/* Call to Action */}
      <Paper sx={{ mt: 4, p: 2.5, bgcolor: 'background.paper', border: `1px solid ${alpha(theme.palette.divider, 0.1)}`, textAlign: 'center' }}>
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 2, color: 'text.primary' }}>
          Ready to Secure Your Data?
        </Typography>
        <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary' }}>
          Join thousands of users who trust Data Hibernate for their most sensitive data
        </Typography>
        <Stack direction="row" spacing={2} justifyContent="center">
          <Button variant="contained" size="large" startIcon={<CloudUpload />}>
            Start Uploading
          </Button>
          <Button variant="outlined" size="large" startIcon={<GitHub />}>
            View on GitHub
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
};

export default WhyDataHibernate;
