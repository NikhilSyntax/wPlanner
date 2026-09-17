import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Box,
  Typography,
  Avatar,
  Menu,
  MenuItem,
  Chip,
  IconButton,
  Tooltip,
  useTheme,
} from '@mui/material';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import {
  Dashboard as DashboardIcon,
  Event as EventIcon,
  Group as GroupIcon,
  MusicNote as MusicNoteIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  Brightness4 as DarkIcon,
  Brightness7 as LightIcon,
  HourglassEmpty as HourglassEmptyIcon,
  ContentCopy as ContentCopyIcon,
  Check as CheckIcon,
  Church as ChurchIcon,
  AutoMode as AutoModeIcon,
} from '@mui/icons-material';
import { logout } from '../../store/slices/authSlice';
import { isUserApproved } from '../../utils/isUserApproved';
import api from '../../services/api';

const drawerWidth = 260;

const navigationItems = [
  { text: 'Dashboard', icon: DashboardIcon, path: '/dashboard' },
  { text: 'Events & Plans', icon: EventIcon, path: '/events' },
  { text: 'Teams & Roster', icon: GroupIcon, path: '/teams' },
  { text: 'Song Bank', icon: MusicNoteIcon, path: '/songs' },
  { text: 'Auto Scheduler', icon: AutoModeIcon, path: '/auto-scheduler', requiresLeader: true },
];

function Sidebar({ open, onClose, toggleTheme }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { user, userLoaded } = useSelector((state) => state.auth);
  const [anchorEl, setAnchorEl] = useState(null);
  const [church, setChurch] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user?.churchId) {
      api.get('/church/current')
        .then((res) => setChurch(res.data))
        .catch(() => {});
    }
  }, [user?.churchId]);

  const gated = userLoaded && user && !isUserApproved(user);
  const visibleNavItems = gated
    ? [
        {
          text: 'Approval Status',
          icon: HourglassEmptyIcon,
          path: '/pending-approval',
        },
      ]
    : navigationItems.filter((item) => {
        if (item.requiresLeader) {
          return user?.isAdmin || user?.isSubAdmin
            || ['Worship Leader', 'worship leader', 'worship_leader'].includes(user?.role);
        }
        return true;
      });

  const handleMenuClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const handleNavigation = (path) => {
    navigate(path);
    if (window.innerWidth < 900) {
      onClose();
    }
  };

  const handleCopyCode = (e) => {
    e.stopPropagation();
    const code = church?.joinCode;
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const roleLabel = user?.isAdmin
    ? 'Admin'
    : user?.isSubAdmin
    ? 'Sub-Admin'
    : user?.role || 'Member';

  const drawerContent = (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: isDark ? '#080808' : '#ffffff',
        color: isDark ? '#f4f4f5' : '#0f172a',
        borderRight: '1px solid',
        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
      }}
    >
      {/* Brand Header */}
      <Box sx={{ px: 2, pt: 2, pb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.75 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1.5,
              bgcolor: 'primary.main',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <MusicNoteIcon sx={{ fontSize: 18 }} />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  fontSize: '0.9375rem',
                  lineHeight: 1.2,
                }}
              >
                WPLANNER
              </Typography>
            </Box>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                fontSize: '0.6875rem',
                display: 'block',
                letterSpacing: '0.04em',
                lineHeight: 1.1,
                mt: 0.2,
              }}
            >
              WORSHIP WORKSTATION
            </Typography>
          </Box>
        </Box>

        {/* Church / Workspace Tile */}
        {church && (
          <Box
            sx={{
              p: 1,
              px: 1.2,
              borderRadius: 1.5,
              bgcolor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc',
              border: '1px solid',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
              <ChurchIcon sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {church.name}
              </Typography>
            </Box>
            {church.joinCode && (
              <Tooltip title={copied ? 'Copied code!' : `Copy Church Code (${church.joinCode})`}>
                <Chip
                  size="small"
                  label={copied ? 'Copied' : church.joinCode}
                  icon={copied ? <CheckIcon sx={{ fontSize: '12px !important' }} /> : <ContentCopyIcon sx={{ fontSize: '11px !important' }} />}
                  onClick={handleCopyCode}
                  sx={{
                    height: 20,
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    bgcolor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#e2e8f0',
                    color: isDark ? '#ffffff' : '#0f172a',
                    '& .MuiChip-icon': { color: 'inherit' },
                  }}
                />
              </Tooltip>
            )}
          </Box>
        )}
      </Box>

      <Divider sx={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#f1f5f9' }} />

      {/* Navigation Links */}
      <List sx={{ flex: 1, px: 1, py: 1.5 }}>
        <Typography
          variant="overline"
          sx={{
            px: 1.25,
            mb: 0.75,
            display: 'block',
            color: 'text.disabled',
            fontSize: '0.65rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
          }}
        >
          Navigation
        </Typography>
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isSelected =
            location.pathname === item.path ||
            (item.path !== '/dashboard' &&
              item.path !== '/pending-approval' &&
              location.pathname.startsWith(item.path));

          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.35 }}>
              <ListItemButton
                selected={isSelected}
                onClick={() => handleNavigation(item.path)}
                sx={{
                  borderRadius: 1.5,
                  py: 0.75,
                  px: 1.2,
                  position: 'relative',
                  bgcolor: isSelected
                    ? isDark
                      ? 'rgba(255, 77, 40, 0.12) !important'
                      : 'rgba(255, 77, 40, 0.08) !important'
                    : 'transparent',
                  color: isSelected
                    ? 'primary.main'
                    : 'text.secondary',
                  border: isSelected
                    ? `1px solid ${isDark ? 'rgba(255, 77, 40, 0.3)' : 'rgba(255, 77, 40, 0.2)'}`
                    : '1px solid transparent',
                  transition: 'background-color 100ms ease, color 100ms ease',
                  '&:hover': {
                    bgcolor: isSelected
                      ? isDark
                        ? 'rgba(255, 77, 40, 0.18) !important'
                        : 'rgba(255, 77, 40, 0.12) !important'
                      : isDark
                      ? 'rgba(255, 255, 255, 0.03)'
                      : '#f8fafc',
                    color: isDark ? '#ffffff' : '#0f172a',
                  },
                }}
              >
                {isSelected && (
                  <Box
                    sx={{
                      position: 'absolute',
                      left: 0,
                      top: '25%',
                      bottom: '25%',
                      width: 2.5,
                      borderRadius: '0 2px 2px 0',
                      bgcolor: 'primary.main',
                    }}
                  />
                )}
                <ListItemIcon
                  sx={{
                    minWidth: 30,
                    color: isSelected ? 'primary.main' : 'text.secondary',
                  }}
                >
                  <Icon sx={{ fontSize: 18 }} />
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  sx={{
                    '& .MuiListItemText-primary': {
                      fontSize: '0.8125rem',
                      fontWeight: isSelected ? 600 : 500,
                    },
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider sx={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#f1f5f9' }} />

      {/* User Profile Footer & Actions */}
      <Box sx={{ p: 1.5 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            p: 1,
            borderRadius: 1.5,
            bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : '#f8fafc',
            border: '1px solid',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#e2e8f0',
            cursor: 'pointer',
            transition: 'background-color 100ms ease, border-color 100ms ease',
            '&:hover': {
              bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#cbd5e1',
            },
          }}
          onClick={handleMenuClick}
        >
          <Avatar
            sx={{
              width: 32,
              height: 32,
              fontSize: '0.8125rem',
              fontWeight: 600,
              bgcolor: 'primary.main',
              color: '#ffffff',
            }}
            src={resolveMediaUrl(user?.profilePhotoUrl)}
            alt={user?.name}
          >
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 600,
                fontSize: '0.8125rem',
                lineHeight: 1.2,
                color: 'text.primary',
              }}
              noWrap
            >
              {user?.name || 'User'}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.2 }}>
              <Chip
                label={roleLabel}
                size="small"
                sx={{
                  height: 16,
                  fontSize: '0.59rem',
                  fontWeight: 600,
                  bgcolor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#e2e8f0',
                  color: 'text.secondary',
                }}
              />
            </Box>
          </Box>
        </Box>

        {/* Theme Mode Button */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1, px: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem', fontWeight: 500 }}>
            Appearance
          </Typography>
          <IconButton
            size="small"
            onClick={toggleTheme}
            sx={{
              color: 'text.secondary',
              border: '1px solid',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
              p: 0.5,
              '&:hover': {
                bgcolor: 'action.hover',
                color: 'text.primary',
              },
            }}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? (
              <LightIcon sx={{ fontSize: 14 }} />
            ) : (
              <DarkIcon sx={{ fontSize: 14 }} />
            )}
          </IconButton>
        </Box>
      </Box>

      {/* User Dropdown Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        PaperProps={{
          sx: {
            mt: -0.5,
            minWidth: 180,
            borderRadius: 1.5,
          },
        }}
      >
        <MenuItem
          onClick={() => {
            navigate('/profile');
            handleMenuClose();
          }}
          sx={{ fontSize: '0.8125rem', fontWeight: 500, py: 0.75 }}
        >
          <ListItemIcon>
            <SettingsIcon sx={{ fontSize: 18 }} />
          </ListItemIcon>
          Profile Settings
        </MenuItem>
        <Divider sx={{ my: 0.5 }} />
        <MenuItem
          onClick={() => {
            handleLogout();
            handleMenuClose();
          }}
          sx={{ fontSize: '0.8125rem', fontWeight: 500, py: 0.75, color: 'error.main' }}
        >
          <ListItemIcon sx={{ color: 'error.main' }}>
            <LogoutIcon sx={{ fontSize: 18 }} />
          </ListItemIcon>
          Logout
        </MenuItem>
      </Menu>
    </Box>
  );

  return (
    <>
      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={open}
        onClose={onClose}
        ModalProps={{
          keepMounted: true,
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: drawerWidth,
            border: 'none',
          },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Desktop Drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: drawerWidth,
            border: 'none',
          },
        }}
        open
      >
        {drawerContent}
      </Drawer>
    </>
  );
}

export default Sidebar;
