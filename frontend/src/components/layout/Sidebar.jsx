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
} from '@mui/icons-material';
import { logout } from '../../store/slices/authSlice';
import { isUserApproved } from '../../utils/isUserApproved';
import api from '../../services/api';

const drawerWidth = 270;

const navigationItems = [
  { text: 'Dashboard', icon: DashboardIcon, path: '/dashboard' },
  { text: 'Events', icon: EventIcon, path: '/events' },
  { text: 'Teams & Roster', icon: GroupIcon, path: '/teams' },
  { text: 'Song Bank', icon: MusicNoteIcon, path: '/songs' },
];

function Sidebar({ open, onClose, toggleTheme }) {
  const theme = useTheme();
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
    : navigationItems;

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
        bgcolor: '#080c14',
        color: '#f8fafc',
      }}
    >
      {/* Brand Header */}
      <Box sx={{ px: 2.5, pt: 2.5, pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
            }}
          >
            <MusicNoteIcon sx={{ color: 'white', fontSize: 20 }} />
          </Box>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
              <Typography
                variant="subtitle1"
                sx={{
                  color: '#ffffff',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                }}
              >
                wPlanner
              </Typography>
              <Chip
                label="PRO"
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.625rem',
                  fontWeight: 800,
                  bgcolor: 'rgba(37, 99, 235, 0.25)',
                  color: '#60a5fa',
                  border: '1px solid rgba(37, 99, 235, 0.4)',
                  px: 0.2,
                }}
              />
            </Box>
            <Typography
              variant="caption"
              sx={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 500 }}
            >
              Worship Operations
            </Typography>
          </Box>
        </Box>

        {/* Church / Workspace Tile */}
        {church && (
          <Box
            sx={{
              p: 1.2,
              borderRadius: 2,
              bgcolor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
              <ChurchIcon sx={{ fontSize: 18, color: '#94a3b8' }} />
              <Typography
                variant="caption"
                sx={{
                  color: '#e2e8f0',
                  fontWeight: 600,
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
                  icon={
                    copied ? (
                      <CheckIcon sx={{ fontSize: '13px !important', color: '#10b981 !important' }} />
                    ) : (
                      <ContentCopyIcon sx={{ fontSize: '12px !important', color: '#94a3b8 !important' }} />
                    )
                  }
                  label={church.joinCode}
                  onClick={handleCopyCode}
                  clickable
                  sx={{
                    height: 22,
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    bgcolor: 'rgba(255, 255, 255, 0.06)',
                    color: '#94a3b8',
                    '&:hover': {
                      bgcolor: 'rgba(255, 255, 255, 0.12)',
                      color: '#ffffff',
                    },
                  }}
                />
              </Tooltip>
            )}
          </Box>
        )}
      </Box>

      <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.06)' }} />

      {/* Navigation Links */}
      <List sx={{ flex: 1, px: 1.5, py: 2 }}>
        <Typography
          variant="caption"
          sx={{
            px: 1.5,
            mb: 1,
            display: 'block',
            color: '#64748b',
            fontSize: '0.6875rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Menu
        </Typography>
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isSelected =
            location.pathname === item.path ||
            (item.path !== '/dashboard' &&
              item.path !== '/pending-approval' &&
              location.pathname.startsWith(item.path));

          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={isSelected}
                onClick={() => handleNavigation(item.path)}
                sx={{
                  borderRadius: 2,
                  py: 1,
                  px: 1.5,
                  position: 'relative',
                  bgcolor: isSelected ? 'rgba(37, 99, 235, 0.14) !important' : 'transparent',
                  color: isSelected ? '#ffffff' : '#94a3b8',
                  border: isSelected
                    ? '1px solid rgba(37, 99, 235, 0.3)'
                    : '1px solid transparent',
                  '&:hover': {
                    bgcolor: isSelected
                      ? 'rgba(37, 99, 235, 0.2) !important'
                      : 'rgba(255, 255, 255, 0.04)',
                    color: '#ffffff',
                  },
                }}
              >
                {isSelected && (
                  <Box
                    sx={{
                      position: 'absolute',
                      left: 0,
                      top: '20%',
                      bottom: '20%',
                      width: 3,
                      borderRadius: '0 4px 4px 0',
                      bgcolor: '#3b82f6',
                      boxShadow: '0 0 8px rgba(59, 130, 246, 0.8)',
                    }}
                  />
                )}
                <ListItemIcon
                  sx={{
                    minWidth: 34,
                    color: isSelected ? '#60a5fa' : '#64748b',
                  }}
                >
                  <Icon sx={{ fontSize: 20 }} />
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  sx={{
                    '& .MuiListItemText-primary': {
                      fontSize: '0.875rem',
                      fontWeight: isSelected ? 600 : 500,
                    },
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.06)' }} />

      {/* User Profile Card & Actions */}
      <Box sx={{ p: 2 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            p: 1.2,
            borderRadius: 2,
            bgcolor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.07)',
              borderColor: 'rgba(255, 255, 255, 0.12)',
            },
          }}
          onClick={handleMenuClick}
        >
          <Avatar
            sx={{
              width: 38,
              height: 38,
              fontSize: '0.95rem',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              border: '1.5px solid rgba(255, 255, 255, 0.2)',
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
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.84375rem',
                lineHeight: 1.2,
              }}
              noWrap
            >
              {user?.name || 'User'}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.3 }}>
              <Chip
                label={roleLabel}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  bgcolor: user?.isAdmin
                    ? 'rgba(245, 158, 11, 0.2)'
                    : user?.isSubAdmin
                    ? 'rgba(16, 185, 129, 0.2)'
                    : 'rgba(255, 255, 255, 0.08)',
                  color: user?.isAdmin
                    ? '#fbbf24'
                    : user?.isSubAdmin
                    ? '#34d399'
                    : '#94a3b8',
                }}
              />
            </Box>
          </Box>
        </Box>

        {/* Theme Mode Button */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1.5, px: 0.5 }}>
          <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 500 }}>
            Appearance
          </Typography>
          <IconButton
            size="small"
            onClick={toggleTheme}
            sx={{
              color: '#94a3b8',
              bgcolor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              p: 0.6,
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
              },
            }}
            title={theme.palette.mode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme.palette.mode === 'dark' ? (
              <LightIcon sx={{ fontSize: 16 }} />
            ) : (
              <DarkIcon sx={{ fontSize: 16 }} />
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
            mt: -1,
            minWidth: 190,
            borderRadius: 2,
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.3)',
          },
        }}
      >
        <MenuItem
          onClick={() => {
            navigate('/profile');
            handleMenuClose();
          }}
          sx={{ fontSize: '0.875rem', fontWeight: 500, py: 1 }}
        >
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          Profile Settings
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            handleLogout();
            handleMenuClose();
          }}
          sx={{ fontSize: '0.875rem', fontWeight: 500, py: 1, color: 'error.main' }}
        >
          <ListItemIcon sx={{ color: 'error.main' }}>
            <LogoutIcon fontSize="small" />
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
