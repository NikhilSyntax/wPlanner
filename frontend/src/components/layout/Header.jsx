import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Avatar,
  Button,
  Tooltip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import NotificationBell from '../NotificationBell';
import { resolveMediaUrl } from '../../utils/mediaUrl';

function titleFromPath(pathname) {
  const rules = [
    { test: /^\/events\/[^/]+\/setlist\/[^/]+$/, title: 'Lyrics & Chords' },
    { test: /^\/events\/[^/]+\/team$/, title: 'Event Team' },
    { test: /^\/events\/[^/]+\/edit$/, title: 'Edit Event' },
    { test: /^\/events\/new$/, title: 'New Event' },
    { test: /^\/events\/[^/]+\/chat$/, title: 'Event Chat' },
    { test: /^\/events\/[^/]+\/production$/, title: 'Production Planning' },
    { test: /^\/events\/[^/]+$/, title: 'Event Details' },
    { test: /^\/events$/, title: 'Events Calendar' },
    { test: /^\/teams\/[^/]+\/edit$/, title: 'Edit Team' },
    { test: /^\/teams\/new$/, title: 'New Team' },
    { test: /^\/teams\/[^/]+$/, title: 'Team Details' },
    { test: /^\/teams$/, title: 'Teams & Roster' },
    { test: /^\/songs\/[^/]+\/edit$/, title: 'Edit Song' },
    { test: /^\/songs\/new$/, title: 'New Song' },
    { test: /^\/songs\/[^/]+$/, title: 'Song Details' },
    { test: /^\/songs$/, title: 'Song Bank' },
    { test: /^\/profile$/, title: 'Profile & Settings' },
    { test: /^\/pending-approval$/, title: 'Approval Status' },
    { test: /^\/dashboard$/, title: 'Dashboard' },
  ];
  const found = rules.find((r) => r.test.test(pathname));
  return found ? found.title : 'wPlanner';
}

function Header({ onMenuClick }) {
  const { user } = useSelector((state) => state.auth);
  const location = useLocation();
  const navigate = useNavigate();
  const pageTitle = useMemo(
    () => titleFromPath(location.pathname),
    [location.pathname]
  );

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        width: { md: `calc(100% - 260px)` },
        ml: { md: '260px' },
        bgcolor: 'background.paper',
        color: 'text.primary',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Toolbar sx={{ minHeight: { xs: 52, sm: 56 }, px: { xs: 2, sm: 2.5 } }}>
        <IconButton
          color="inherit"
          aria-label="open drawer"
          edge="start"
          onClick={onMenuClick}
          sx={{ mr: 1.5, display: { md: 'none' } }}
        >
          <MenuIcon sx={{ fontSize: 20 }} />
        </IconButton>

        {/* Page Title & Breadcrumb Indicator */}
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography
            variant="h6"
            noWrap
            component="div"
            sx={{
              fontWeight: 800,
              fontSize: { xs: '0.875rem', sm: '0.9375rem' },
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'text.primary',
            }}
          >
            {pageTitle}
          </Typography>
        </Box>

        {/* Actions Toolbar */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          {/* Quick Create Event CTA Button */}
          {location.pathname !== '/events/new' && (
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon sx={{ fontSize: 16 }} />}
              onClick={() => navigate('/events/new')}
              sx={{
                display: { xs: 'none', sm: 'inline-flex' },
                fontSize: '0.75rem',
                py: 0.6,
                px: 1.4,
              }}
            >
              New Event
            </Button>
          )}

          {/* Notifications */}
          <NotificationBell />

          {/* User Profile Avatar Pill */}
          <Tooltip title="View Profile Settings">
            <Box
              onClick={() => navigate('/profile')}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.85,
                cursor: 'pointer',
                p: 0.4,
                px: 0.75,
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: 'divider',
                transition: 'background-color 100ms ease, border-color 100ms ease',
                '&:hover': {
                  bgcolor: 'action.hover',
                  borderColor: 'text.secondary',
                },
              }}
            >
              <Avatar
                sx={{
                  width: 26,
                  height: 26,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  bgcolor: 'primary.main',
                  color: '#ffffff',
                }}
                src={resolveMediaUrl(user?.profilePhotoUrl)}
                alt={user?.name}
              >
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </Avatar>
              <Box sx={{ display: { xs: 'none', lg: 'block' }, textAlign: 'left' }}>
                <Typography
                  variant="subtitle2"
                  sx={{
                    lineHeight: 1.15,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    maxWidth: 120,
                  }}
                  noWrap
                >
                  {user?.name || 'User'}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', fontSize: '0.65rem', lineHeight: 1 }}
                  noWrap
                >
                  {user?.isAdmin ? 'Admin' : user?.isSubAdmin ? 'Sub-Admin' : user?.role || 'Member'}
                </Typography>
              </Box>
            </Box>
          </Tooltip>
        </Box>
      </Toolbar>
    </AppBar>
  );
}

export default Header;
