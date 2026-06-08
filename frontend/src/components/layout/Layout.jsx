import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Box, Toolbar } from '@mui/material';
import Sidebar from './Sidebar';
import Header from './Header';
import { toggleTheme as toggleThemeAction } from '../../store/slices/uiSlice';
import './Layout.css';

function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const dispatch = useDispatch();

  const handleDrawerToggle = () => {
    setMobileOpen((open) => !open);
  };

  const toggleTheme = () => {
    dispatch(toggleThemeAction());
  };

  return (
    <Box
      className="layout-container"
      sx={{ display: 'flex', minHeight: '100vh' }}
    >
      <Sidebar
        open={mobileOpen}
        onClose={handleDrawerToggle}
        toggleTheme={toggleTheme}
      />

      <Box
        className="layout-main"
        component="main"
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.default',
        }}
      >
        <Header onMenuClick={handleDrawerToggle} />
        {/* Offsets fixed AppBar — same height as Header Toolbar */}
        <Toolbar
          disableGutters
          sx={{ flexShrink: 0, minHeight: { xs: 56, sm: 64 } }}
        />

        <Box
          className="layout-content"
          sx={{
            flex: 1,
            p: { xs: 2, sm: 3 },
            maxWidth: 1400,
            mx: 'auto',
            width: '100%',
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}

export default Layout;
