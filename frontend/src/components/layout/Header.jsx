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
        width: { md: `calc(100% - 270px)` },
        ml: { md: '270px' },
        bgcolor: 'background.paper',
        color: 'text.primary',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Toolbar sx={{ minHeight: { xs: 58, sm: 64 }, px: { xs: 2, sm: 3 } }}>
        <IconButton
          color="inherit"
          aria-label="open drawer"
          edge="start"
          onClick={onMenuClick}
          sx={{ mr: 2, display: { md: 'none' } }}
        >
          <MenuIcon />
        </IconButton>

        {/* Page Title & Breadcrumb Indicator */}
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography
            variant="h6"
            noWrap
            component="div"
            sx={{
              fontWeight: 700,
              fontSize: { xs: '1rem', sm: '1.125rem' },
              letterSpacing: '-0.02em',
              color: 'text.primary',
            }}
          >
            {pageTitle}
          </Typography>
        </Box>

        {/* Actions Toolbar */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {/* Quick Create Event CTA Button */}
          {location.pathname !== '/events/new' && (
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => navigate('/events/new')}
              sx={{
                display: { xs: 'none', sm: 'inline-flex' },
                fontSize: '0.8125rem',
                py: 0.8,
                px: 1.8,
                borderRadius: 2,
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
                gap: 1,
                cursor: 'pointer',
                p: 0.5,
                borderRadius: 2,
                transition: 'all 0.15s ease',
                '&:hover': {
                  bgcolor: 'action.hover',
                },
              }}
            >
              <Avatar
                sx={{
                  width: 34,
                  height: 34,
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
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
                    lineHeight: 1.2,
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    maxWidth: 130,
                  }}
                  noWrap
                >
                  {user?.name || 'User'}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', fontSize: '0.6875rem', lineHeight: 1 }}
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
