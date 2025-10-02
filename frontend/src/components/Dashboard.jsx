import React from 'react';
import { AppBar, Toolbar, Typography } from '@mui/material';
import { Outlet } from 'react-router-dom';

const Dashboard = () => {
  return (
    <div>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6">Dashboard</Typography>
        </Toolbar>
      </AppBar>
      <Outlet />
    </div>
  );
};

export default Dashboard;