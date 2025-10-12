import React from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  Stack,
  useTheme,
  useMediaQuery,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Link,
  alpha
} from '@mui/material';
import {
  CloudUpload,
  Security,
  Speed,
  CheckCircle,
  Star,
  CloudDone,
  Storage,
  Shield,
  Speed as SpeedIcon,
  AccessTime,
  AttachMoney,
  TrendingDown,
  Public,
  VerifiedUser,
  AutoAwesome,
  Psychology,
  Home,
  ArrowForward,
  Download,
  Upload,
  Archive,
  AcUnit,
  Info,
  Schedule,
  CloudQueue
} from '@mui/icons-material';

const LandingPage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const planFeatures = [
    {
      icon: <AcUnit sx={{ fontSize: 40, color: '#4f46e5' }} />,
      title: 'Deep Hibernate',
      subtitle: '🌙 Long-term archival storage',
      features: [
        'Stored safely in AWS Glacier Deep Archive',
        'Ultra-low cost for long-term data',
        'Restore in ~12 hours',
        '10 GB free retrieval every 6 months'
      ],
      pricing: [
        { storage: '100 GB', price: '₹599/year' },
        { storage: '1 TB', price: '₹2,999/year' }
      ],
      description: 'Perfect for memories, backups, and data you rarely need',
      color: '#4f46e5',
      gradient: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
      lightColor: '#e0e7ff',
      darkColor: '#312e81',
      bgColor: '#f8fafc',
      textColor: '#1e293b'
    },
    {
      icon: <CloudQueue sx={{ fontSize: 40, color: '#2563eb' }} />,
      title: 'Smart Hibernate',
      subtitle: '🌤️ Flexible retrieval storage',
      features: [
        'Stored on AWS Glacier Flexible Retrieval',
        'Retrieve anytime within hours',
        'Includes 10 GB free per month',
        'Extra retrieval at ₹2/GB'
      ],
      pricing: [
        { storage: '100 GB', price: '₹1,079/year' },
        { storage: '1 TB', price: '₹4,799/year' }
      ],
      description: 'Balance between cost and accessibility for regular backups',
      color: '#2563eb',
      gradient: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
      lightColor: '#dbeafe',
      darkColor: '#1e3a8a',
      bgColor: '#f8fafc',
      textColor: '#1e293b'
    }
  ];

  const benefits = [
    { icon: <VerifiedUser />, text: 'Built on AWS — Trusted globally' },
    { icon: <TrendingDown />, text: 'Up to 80% cheaper than big tech storage' },
    { icon: <Psychology />, text: 'No confusing tech — just simple plans' },
    { icon: <Public />, text: 'Made for India — affordable, reliable, transparent' },
    { icon: <AutoAwesome />, text: 'You pay once. We take care of the rest.' }
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50' }}>
      {/* Hero Section */}
      <Paper
        elevation={0}
        sx={{
          background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
          color: 'white',
          py: { xs: 8, md: 12 },
          borderRadius: 0,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={6}>
              <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
                <Chip
                  icon={<CloudUpload />}
                  label="💤 DataHibernate"
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.2)',
                    color: 'white',
                    mb: 3,
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    borderRadius: 3
                  }}
                />
                <Typography
                  variant="h1"
                  sx={{
                    fontSize: { xs: '2.5rem', md: '3.5rem' },
                    fontWeight: 800,
                    lineHeight: 1.2,
                    mb: 3
                  }}
                >
                  Upload. Forget. Sleep Easy.
                </Typography>
                <Typography
                  variant="h5"
                  sx={{
                    fontSize: { xs: '1.2rem', md: '1.5rem' },
                    fontWeight: 300,
                    mb: 4,
                    opacity: 0.9
                  }}
                >
                  Your memories deserve rest, too.
                </Typography>
                <Typography
                  variant="body1"
                  sx={{
                    fontSize: '1.1rem',
                    mb: 4,
                    opacity: 0.8,
                    lineHeight: 1.6
                  }}
                >
                  A secure, long-term cloud vault built for people who don't want to think about storage ever again.
                  Whether it's old photos, work archives, or personal backups — just upload once and let it sleep in peace.
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <Button
                    variant="contained"
                    size="large"
                    endIcon={<ArrowForward />}
                    sx={{
                      bgcolor: 'white',
                      color: '#4f46e5',
                      px: 4,
                      py: 1.5,
                      fontSize: '1.1rem',
                      fontWeight: 600,
                      borderRadius: 3,
                      boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                      '&:hover': {
                        bgcolor: 'rgba(255,255,255,0.9)',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
                      }
                    }}
                  >
                    Start Uploading
                  </Button>
                  <Button
                    variant="outlined"
                    size="large"
                    sx={{
                      borderColor: 'white',
                      color: 'white',
                      px: 4,
                      py: 1.5,
                      fontSize: '1.1rem',
                      fontWeight: 600,
                      borderRadius: 3,
                      '&:hover': {
                        borderColor: 'white',
                        bgcolor: 'rgba(255,255,255,0.1)'
                      }
                    }}
                  >
                    Learn More
                  </Button>
                </Stack>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ textAlign: 'center' }}>
                <Box
                  component="img"
                  src="/icon.png"
                  alt="DataHibernate Logo"
                  sx={{
                    width: { xs: 200, md: 300 },
                    height: 'auto',
                    filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.3))'
                  }}
                />
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Paper>

      {/* Plans Section */}
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography variant="h3" sx={{ mb: 3, fontWeight: 800, color: '#1e293b' }}>
            Choose Your Hibernation Plan
          </Typography>
          <Typography variant="h6" sx={{ color: 'text.secondary', maxWidth: 700, mx: 'auto', lineHeight: 1.6 }}>
            Select the perfect storage solution for your data needs. Each plan offers different 
            balance between cost, storage capacity, and retrieval speed.
          </Typography>
        </Box>

        <Grid container spacing={4}>
          {planFeatures.map((plan, index) => (
            <Grid item xs={12} md={6} key={index}>
              <Card
                sx={{
                  height: '100%',
                  position: 'relative',
                  border: `2px solid ${alpha(plan.color, 0.15)}`,
                  borderRadius: 4,
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
                  '&:hover': {
                    transform: 'translateY(-12px) scale(1.02)',
                    boxShadow: `0 20px 60px ${alpha(plan.color, 0.25)}`,
                    borderColor: plan.color,
                  },
                }}
              >
                <CardContent sx={{ p: 4 }}>
                  <Stack spacing={4}>
                    {/* Plan Header */}
                    <Box sx={{ textAlign: 'center' }}>
                      <Box
                        sx={{
                          p: 3,
                          borderRadius: '50%',
                          bgcolor: plan.lightColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: `2px solid ${plan.color}`,
                          mx: 'auto',
                          width: 80,
                          height: 80,
                          mb: 3
                        }}
                      >
                        {React.cloneElement(plan.icon, { sx: { fontSize: 40, color: plan.color } })}
                      </Box>
                      <Typography variant="h4" sx={{ fontWeight: 800, mb: 2, color: plan.textColor }}>
                        {plan.title}
                      </Typography>
                      <Typography variant="h6" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>
                        {plan.description}
                      </Typography>
                    </Box>

                    {/* Features */}
                    <List dense>
                      {plan.features.map((feature, idx) => (
                        <ListItem key={idx} sx={{ px: 0 }}>
                          <ListItemIcon sx={{ minWidth: 36 }}>
                            <CheckCircle sx={{ color: plan.color, fontSize: 20 }} />
                          </ListItemIcon>
                          <ListItemText
                            primary={feature}
                            primaryTypographyProps={{ fontSize: '0.9rem' }}
                          />
                        </ListItem>
                      ))}
                    </List>

                    {/* Pricing */}
                    <Box sx={{ textAlign: 'center', p: 3, bgcolor: plan.lightColor, borderRadius: 3, border: `1px solid ${alpha(plan.color, 0.2)}` }}>
                      {plan.pricing.map((price, idx) => (
                        <Box key={idx} sx={{ mb: idx === 0 ? 2 : 0 }}>
                          <Typography variant="h3" sx={{ fontWeight: 800, mb: 1, color: plan.textColor }}>
                            {price.price}
                          </Typography>
                          <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
                            {price.storage} Storage
                          </Typography>
                        </Box>
                      ))}
                    </Box>

                    {/* Action Button */}
                    <Button
                      fullWidth
                      variant="contained"
                      sx={{
                        bgcolor: plan.color,
                        borderRadius: 3,
                        py: 3,
                        fontSize: '1.1rem',
                        fontWeight: 700,
                        textTransform: 'none',
                        boxShadow: `0 4px 16px ${alpha(plan.color, 0.2)}`,
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          bgcolor: plan.darkColor,
                          transform: 'translateY(-2px)',
                          boxShadow: `0 8px 24px ${alpha(plan.color, 0.3)}`,
                        },
                      }}
                    >
                      Choose Plan
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Benefits Section */}
      <Paper
        elevation={0}
        sx={{
          bgcolor: '#f8fafc',
          py: 8,
          borderRadius: 0
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Typography variant="h3" sx={{ mb: 3, fontWeight: 800, color: '#1e293b' }}>
              Why Choose DataHibernate?
            </Typography>
          </Box>

          <Grid container spacing={4}>
            {benefits.map((benefit, index) => (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <Paper
                  sx={{
                    p: 4,
                    textAlign: 'center',
                    height: '100%',
                    borderRadius: 3,
                    transition: 'all 0.3s ease',
                    border: '1px solid rgba(0,0,0,0.05)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                    '&:hover': {
                      transform: 'translateY(-8px)',
                      boxShadow: '0 12px 32px rgba(0,0,0,0.15)'
                    }
                  }}
                >
                  <Box sx={{ color: '#4f46e5', mb: 3 }}>
                    {React.cloneElement(benefit.icon, { sx: { fontSize: 48 } })}
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
                    {benefit.text}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Paper>

      {/* Story Section */}
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Grid container spacing={6} alignItems="center">
          <Grid item xs={12} md={6}>
            <Box
              component="img"
              src="/icon.png"
              alt="DataHibernate"
              sx={{
                width: '100%',
                maxWidth: 400,
                height: 'auto',
                mx: 'auto',
                display: 'block',
                filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.1))'
              }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="h3" sx={{ mb: 3, fontWeight: 800, color: '#1e293b' }}>
              Your Data's Second Home
            </Typography>
            <Typography variant="h6" sx={{ color: 'text.secondary', lineHeight: 1.6, mb: 3 }}>
              From family albums to startup archives — DataHibernate ensures your files are sleeping safely in the cloud, 
              ready whenever you need them again.
            </Typography>
            <Typography variant="body1" sx={{ fontSize: '1.1rem', lineHeight: 1.7, mb: 4, color: 'text.secondary' }}>
              Think of it as hibernation for your data — calm, secure, and waiting patiently for your call.
            </Typography>
            <Stack direction="row" spacing={2} flexWrap="wrap">
              <Chip 
                icon={<Security />} 
                label="Secure" 
                sx={{ 
                  bgcolor: '#e0e7ff', 
                  color: '#4f46e5', 
                  fontWeight: 600,
                  borderRadius: 3
                }} 
              />
              <Chip 
                icon={<Storage />} 
                label="Reliable" 
                sx={{ 
                  bgcolor: '#dbeafe', 
                  color: '#2563eb', 
                  fontWeight: 600,
                  borderRadius: 3
                }} 
              />
              <Chip 
                icon={<AttachMoney />} 
                label="Affordable" 
                sx={{ 
                  bgcolor: '#dcfce7', 
                  color: '#16a34a', 
                  fontWeight: 600,
                  borderRadius: 3
                }} 
              />
              <Chip 
                icon={<Speed />} 
                label="Fast" 
                sx={{ 
                  bgcolor: '#fef3c7', 
                  color: '#d97706', 
                  fontWeight: 600,
                  borderRadius: 3
                }} 
              />
            </Stack>
          </Grid>
        </Grid>
      </Container>

      {/* CTA Section */}
      <Paper
        elevation={0}
        sx={{
          background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
          color: 'white',
          py: 8,
          textAlign: 'center',
          borderRadius: 0
        }}
      >
        <Container maxWidth="md">
          <Typography variant="h3" sx={{ mb: 3, fontWeight: 800 }}>
            🔒 Start Your Hibernate Journey Today
          </Typography>
          <Typography variant="h6" sx={{ mb: 4, opacity: 0.9, lineHeight: 1.6 }}>
            Choose your plan → Upload → Relax.
            <br />
            No hidden charges. No monthly stress.
            <br />
            Just pure, long-term peace.
          </Typography>
          <Button
            variant="contained"
            size="large"
            endIcon={<ArrowForward />}
            sx={{
              bgcolor: 'white',
              color: '#4f46e5',
              px: 6,
              py: 2,
              fontSize: '1.2rem',
              fontWeight: 600,
              borderRadius: 3,
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.9)',
                transform: 'translateY(-2px)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
              }
            }}
          >
            Start Uploading →
          </Button>
        </Container>
      </Paper>

      {/* Footer */}
      <Paper
        elevation={0}
        sx={{
          bgcolor: '#1e293b',
          color: 'white',
          py: 6,
          borderRadius: 0
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={4}>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Box
                  component="img"
                  src="/icon.png"
                  alt="DataHibernate"
                  sx={{ width: 48, height: 48, mr: 2 }}
                />
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  DataHibernate
                </Typography>
              </Box>
              <Typography variant="body1" sx={{ color: '#94a3b8', mb: 3, lineHeight: 1.6 }}>
                Secure, affordable cloud storage for your digital memories. Built for India, trusted globally.
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" sx={{ mb: 3, fontWeight: 700 }}>
                Quick Links
              </Typography>
              <Stack direction="row" spacing={3} flexWrap="wrap">
                <Link href="#" sx={{ color: '#94a3b8', textDecoration: 'none', '&:hover': { color: 'white' } }}>
                  Privacy Policy
                </Link>
                <Link href="#" sx={{ color: '#94a3b8', textDecoration: 'none', '&:hover': { color: 'white' } }}>
                  Terms of Service
                </Link>
                <Link href="#" sx={{ color: '#94a3b8', textDecoration: 'none', '&:hover': { color: 'white' } }}>
                  Support
                </Link>
                <Link href="#" sx={{ color: '#94a3b8', textDecoration: 'none', '&:hover': { color: 'white' } }}>
                  Contact
                </Link>
              </Stack>
            </Grid>
          </Grid>
          <Divider sx={{ my: 4, borderColor: '#334155' }} />
          <Typography variant="body2" sx={{ color: '#94a3b8', textAlign: 'center' }}>
            © 2024 DataHibernate. All rights reserved. Built with ❤️ for digital peace of mind.
          </Typography>
        </Container>
      </Paper>
    </Box>
  );
};

export default LandingPage;
