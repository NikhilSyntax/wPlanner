import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Avatar,
} from '@mui/material';
import { Menu as MenuIcon } from '@mui/icons-material';
import NotificationBell from '../NotificationBell';
import { resolveMediaUrl } from '../../utils/mediaUrl';

function titleFromPath(pathname) {
  const rules = [
    { test: /^\/events\/[^/]+\/setlist\/[^/]+$/, title: 'Lyrics & chords' },
    { test: /^\/events\/[^/]+\/team$/, title: 'Event team' },
    { test: /^\/events\/[^/]+\/edit$/, title: 'Edit event' },
    { test: /^\/events\/new$/, title: 'New event' },
    { test: /^\/events\/[^/]+\/chat$/, title: 'Event chat' },
    { test: /^\/events\/[^/]+\/production$/, title: 'Production' },
    { test: /^\/events\/[^/]+$/, title: 'Event details' },
    { test: /^\/events$/, title: 'Events' },
    { test: /^\/teams\/[^/]+\/edit$/, title: 'Edit team' },
    { test: /^\/teams\/new$/, title: 'New team' },
    { test: /^\/teams\/[^/]+$/, title: 'Team details' },
    { test: /^\/teams$/, title: 'Teams' },
    { test: /^\/songs\/[^/]+\/edit$/, title: 'Edit song' },
    { test: /^\/songs\/new$/, title: 'New song' },
    { test: /^\/songs\/[^/]+$/, title: 'Song details' },
    { test: /^\/songs$/, title: 'Songs' },
    { test: /^\/profile$/, title: 'Profile settings' },
    { test: /^\/pending-approval$/, title: 'Approval status' },
    { test: /^\/dashboard$/, title: 'Dashboard' },
  ];
  const found = rules.find((r) => r.test.test(pathname));
  return found ? found.title : 'wPlanner';
}

function Header({ onMenuClick }) {
  const { user } = useSelector((state) => state.auth);
  const location = useLocation();
  const pageTitle = useMemo(
    () => titleFromPath(location.pathname),
    [location.pathname]
  );

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        width: { md: `calc(100% - 280px)` },
        ml: { md: '280px' },
        bgcolor: 'background.paper',
        color: 'text.primary',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid',
        borderColor: 'divider',
        boxShadow: '0 1px 0 rgba(15, 23, 42, 0.06)',
      }}
    >
      <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }}>
        <IconButton
          color="inherit"
          aria-label="open drawer"
          edge="start"
          onClick={onMenuClick}
          sx={{ mr: 2, display: { md: 'none' } }}
        >
          <MenuIcon />
        </IconButton>

        <Typography
          variant="h6"
          noWrap
          component="div"
          sx={{ flexGrow: 1, fontWeight: 600, letterSpacing: '-0.02em' }}
        >
          {pageTitle}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <NotificationBell />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar
              sx={{
                width: 36,
                height: 36,
                fontSize: '0.9rem',
                fontWeight: 600,
                background: (theme) =>
                  `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
              }}
              src={resolveMediaUrl(user?.profilePhotoUrl)}
              alt={user?.name}
            >
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </Avatar>
            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
              <Typography variant="subtitle2" sx={{ lineHeight: 1.2 }} noWrap>
                {user?.name || 'User'}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', maxWidth: 160 }}
                noWrap
              >
                {user?.email || ''}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Toolbar>
    </AppBar>
  );
}

export default Header;
