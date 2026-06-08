import React, { useState } from 'react';
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
  Switch,
  FormControlLabel,
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
} from '@mui/icons-material';
import { logout } from '../../store/slices/authSlice';
import { isUserApproved } from '../../utils/isUserApproved';

const drawerWidth = 280;

const navigationItems = [
  { text: 'Dashboard', icon: DashboardIcon, path: '/dashboard' },
  { text: 'Events', icon: EventIcon, path: '/events' },
  { text: 'Teams', icon: GroupIcon, path: '/teams' },
  { text: 'Songs', icon: MusicNoteIcon, path: '/songs' },
];

function Sidebar({ open, onClose, toggleTheme }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { user, userLoaded } = useSelector((state) => state.auth);
  const [anchorEl, setAnchorEl] = useState(null);

  const gated = userLoaded && user && !isUserApproved(user);
  const visibleNavItems = gated
    ? [
        {
          text: 'Approval status',
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
    if (window.innerWidth < 768) {
      onClose();
    }
  };

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MusicNoteIcon sx={{ color: 'white', fontSize: 24 }} />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ color: 'white', fontWeight: 700 }}>
            wPlanner
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
            Worship Planning
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} />

      {/* Navigation */}
      <List sx={{ flex: 1, px: 1, py: 2 }}>
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isSelected =
            location.pathname === item.path ||
            (item.path !== '/dashboard' &&
              item.path !== '/pending-approval' &&
              location.pathname.startsWith(item.path));

          return (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                selected={isSelected}
                onClick={() => handleNavigation(item.path)}
                sx={{
                  mx: 1,
                  mb: 0.5,
                  borderRadius: 2,
                  '&.Mui-selected': {
                    bgcolor: 'rgba(99, 102, 241, 0.2)',
                    '&:hover': {
                      bgcolor: 'rgba(99, 102, 241, 0.3)',
                    },
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: isSelected ? '#6366f1' : 'rgba(255,255,255,0.7)',
                  }}
                >
                  <Icon />
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  sx={{
                    '& .MuiListItemText-primary': {
                      color: isSelected ? '#6366f1' : 'rgba(255,255,255,0.9)',
                      fontWeight: isSelected ? 600 : 400,
                    },
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} />

      {/* User Profile */}
      <Box sx={{ p: 2 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            p: 1.5,
            borderRadius: 2,
            cursor: 'pointer',
            '&:hover': {
              bgcolor: 'rgba(255,255,255,0.1)',
            },
          }}
          onClick={handleMenuClick}
        >
          <Avatar
            sx={{
              width: 40,
              height: 40,
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            }}
            src={resolveMediaUrl(user?.profilePhotoUrl)}
            alt={user?.name}
          >
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="subtitle2"
              sx={{ color: 'white', fontWeight: 600 }}
              noWrap
            >
              {user?.name || 'User'}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: 'rgba(255,255,255,0.6)' }}
              noWrap
            >
              {user?.email || '—'}
            </Typography>
          </Box>
        </Box>

        {/* Theme Toggle */}
        <Box sx={{ mt: 2, px: 1 }}>
          <FormControlLabel
            control={
              <Switch
                checked={theme.palette.mode === 'dark'}
                onChange={toggleTheme}
                color="primary"
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {theme.palette.mode === 'dark' ? (
                  <DarkIcon
                    sx={{ fontSize: 16, color: 'rgba(255,255,255,0.7)' }}
                  />
                ) : (
                  <LightIcon
                    sx={{ fontSize: 16, color: 'rgba(255,255,255,0.7)' }}
                  />
                )}
                <Typography
                  variant="caption"
                  sx={{ color: 'rgba(255,255,255,0.7)' }}
                >
                  {theme.palette.mode === 'dark' ? 'Dark' : 'Light'}
                </Typography>
              </Box>
            }
          />
        </Box>
      </Box>

      {/* User Menu */}
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
            mt: 1,
            minWidth: 180,
            bgcolor: 'background.paper',
          },
        }}
      >
        <MenuItem
          onClick={() => {
            navigate('/profile');
            handleMenuClose();
          }}
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
        >
          <ListItemIcon>
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
          keepMounted: true, // Better open performance on mobile.
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: drawerWidth,
          },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Desktop Drawer — docked root must reserve width; paper is position:fixed */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: drawerWidth,
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
