import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  Box,
  IconButton,
  Badge,
  Popover,
  Typography,
  Button,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Tooltip,
  Alert,
  CircularProgress,
  Paper,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Event as EventIcon,
  AssignmentInd as AssignmentIcon,
  MusicNote as MusicNoteIcon,
  Chat as ChatIcon,
  Info as InfoIcon,
  DoneAll as DoneAllIcon,
  PhoneAndroid as PhoneAndroidIcon,
  NotificationsActive as NotificationsActiveIcon,
  Send as SendIcon,
  CheckCircle as CheckCircleIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Cancel as CancelIcon,
  VolunteerActivism as VolunteerActivismIcon,
} from '@mui/icons-material';
import { addNotification } from '../store/slices/uiSlice';
import { fetchEvents } from '../store/slices/eventSlice';
import { io } from 'socket.io-client';
import api, { API_ORIGIN } from '../services/api';
import {
  isPushNotificationSupported,
  getPushSubscriptionStatus,
  subscribeUserToPush,
  sendTestPushNotification,
} from '../services/pushNotificationService';

const getNotificationIcon = (type) => {
  switch (type) {
    case 'assignment':
      return <AssignmentIcon color="primary" fontSize="small" />;
    case 'setlist_update':
      return <MusicNoteIcon color="secondary" fontSize="small" />;
    case 'event_reminder':
      return <EventIcon color="warning" fontSize="small" />;
    case 'chat_mention':
      return <ChatIcon color="info" fontSize="small" />;
    default:
      return <InfoIcon color="action" fontSize="small" />;
  }
};

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

function NotificationBell() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const isAdmin = Boolean(
    user?.isAdmin ||
    user?.role === 'Admin' ||
    user?.role === 'admin' ||
    user?.roles?.some((r) => String(r).toLowerCase().trim() === 'admin')
  );
  const [anchorEl, setAnchorEl] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [respondingId, setRespondingId] = useState(null);

  // Push subscription state
  const [pushStatus, setPushStatus] = useState({
    isSupported: false,
    isSubscribed: false,
    permission: 'default',
  });
  const [pushActionLoading, setPushActionLoading] = useState(false);
  const [testPushSuccess, setTestPushSuccess] = useState('');
  const [pushError, setPushError] = useState('');

  const socketRef = useRef(null);
  const open = Boolean(anchorEl);

  const handleRespondNotification = async (e, notif, action) => {
    e.stopPropagation();
    try {
      setRespondingId(notif._id);
      const res = await api.post(`/notifications/${notif._id}/respond`, { action });
      const newStatus =
        res.data?.status || (action === 'accept' ? 'accepted' : 'declined');

      setNotifications((prev) =>
        prev.map((n) =>
          n._id === notif._id
            ? { ...n, actionStatus: newStatus, read: true }
            : n
        )
      );
      if (!notif.read) {
        setUnreadCount((c) => Math.max(0, c - 1));
      }

      // Re-fetch all events in Redux so Dashboard, Spotlight, and Events lists update immediately
      dispatch(fetchEvents());

      // Broadcast custom event for active views (Dashboard, EventDetails)
      window.dispatchEvent(
        new CustomEvent('wplanner:assignment_updated', {
          detail: {
            notificationId: notif._id,
            eventId: res.data?.eventId || notif.eventId,
            status: newStatus,
          },
        })
      );

      dispatch(
        addNotification({
          type: action === 'accept' ? 'success' : 'info',
          message:
            action === 'accept'
              ? 'Assignment accepted! See you there 🎉'
              : 'Assignment declined.',
        })
      );
    } catch (err) {
      console.error('[NotificationBell] Failed to respond to notification:', err);
      dispatch(
        addNotification({
          type: 'error',
          message:
            err?.response?.data?.message || 'Failed to update assignment response',
        })
      );
    } finally {
      setRespondingId(null);
    }
  };

  const handleContributeClick = (e, notif, eventId) => {
    e.stopPropagation();
    setNotifications((prev) =>
      prev.map((n) =>
        n._id === notif._id
          ? { ...n, actionStatus: 'contributed', read: true }
          : n
      )
    );
    if (!notif.read) {
      markAsRead(notif._id);
    }
    handleClose();
    navigate(`/events/${eventId}?volunteer=true`);
  };

  // 1. Fetch notifications from backend
  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications', {
        params: { limit: 12 },
      });
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unreadCount || 0);
    } catch (err) {
      console.error('[NotificationBell] Failed to load notifications:', err);
    }
  };

  // 2. Refresh Push Status
  const refreshPushStatus = async () => {
    const status = await getPushSubscriptionStatus();
    setPushStatus(status);
  };

  useEffect(() => {
    fetchNotifications();
    refreshPushStatus();

    // Poll every 45s as a fallback
    const interval = setInterval(fetchNotifications, 45000);

    // Connect real-time socket for instant delivery
    const token = localStorage.getItem('accessToken');
    if (token) {
      const socket = io(API_ORIGIN, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        query: { token },
        headers: { Authorization: `Bearer ${token}` },
      });

      socket.on('notification:new', (newNotif) => {
        setNotifications((prev) => [newNotif, ...prev.filter((n) => n._id !== newNotif._id)]);
        setUnreadCount((count) => count + 1);
      });

      socketRef.current = socket;
    }

    return () => {
      clearInterval(interval);
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
    refreshPushStatus();
    setTestPushSuccess('');
    setPushError('');
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const markAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`, {});
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all', {});
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotificationClick = (notif) => {
    if (!notif.read) {
      markAsRead(notif._id);
    }
    handleClose();
    let targetLink = notif.link;
    if (!targetLink) {
      if (notif.title?.includes('Church Roster') || notif.type === 'chat_mention') {
        targetLink = '/teams?chat=open';
      }
    } else if (targetLink === '/teams' && (notif.title?.includes('Church Roster') || notif.type === 'chat_mention')) {
      targetLink = '/teams?chat=open';
    }
    if (targetLink) {
      navigate(targetLink);
    }
  };

  // Push Subscription Handler
  const handleEnablePush = async () => {
    try {
      setPushActionLoading(true);
      setPushError('');
      setTestPushSuccess('');
      await subscribeUserToPush();
      await refreshPushStatus();
      setTestPushSuccess('Phone alerts enabled! You will now receive lock-screen notifications.');
    } catch (err) {
      setPushError(err.message || 'Failed to enable push notifications.');
    } finally {
      setPushActionLoading(false);
    }
  };

  // Test Notification Handler
  const handleSendTestPush = async () => {
    try {
      setPushActionLoading(true);
      setPushError('');
      setTestPushSuccess('');
      const res = await sendTestPushNotification();
      setTestPushSuccess(res.message || 'Test push notification sent! Check your phone/screen.');
    } catch (err) {
      setPushError(err?.response?.data?.message || err.message || 'Failed to send test push.');
    } finally {
      setPushActionLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'inline-block' }}>
      <Tooltip title="Notifications">
        <IconButton
          onClick={handleClick}
          size="medium"
          sx={{
            color: 'inherit',
            transition: 'transform 0.15s ease-in-out',
            '&:hover': { transform: 'scale(1.05)' },
          }}
        >
          <Badge
            badgeContent={unreadCount}
            color="error"
            max={99}
            sx={{
              '& .MuiBadge-badge': {
                fontWeight: 700,
                fontSize: '0.7rem',
                minWidth: 18,
                height: 18,
                px: 0.5,
              },
            }}
          >
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            width: { xs: 320, sm: 380 },
            maxHeight: 520,
            borderRadius: 3,
            boxShadow: '0 12px 36px rgba(0,0,0,0.18)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            p: 2,
            px: 2.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              Notifications
            </Typography>
            {unreadCount > 0 && (
              <Chip
                label={`${unreadCount} new`}
                size="small"
                color="primary"
                sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700 }}
              />
            )}
          </Box>

          {unreadCount > 0 && (
            <Button
              size="small"
              startIcon={<DoneAllIcon sx={{ fontSize: 14 }} />}
              onClick={markAllAsRead}
              sx={{ textTransform: 'none', fontSize: '0.78rem', p: 0 }}
            >
              Mark all read
            </Button>
          )}
        </Box>

        {/* Notifications List */}
        <List sx={{ p: 0, overflowY: 'auto', flex: 1 }}>
          {notifications.length === 0 ? (
            <Box textAlign="center" py={5} px={3}>
              <NotificationsActiveIcon sx={{ fontSize: 36, color: 'text.secondary', opacity: 0.4, mb: 1 }} />
              <Typography variant="body2" color="text.secondary" fontWeight={500}>
                You're all caught up!
              </Typography>
              <Typography variant="caption" color="text.secondary">
                New worship setlists, assignments, and reminders will appear here.
              </Typography>
            </Box>
          ) : (
            notifications.map((notif) => {
              const eventId =
                notif.eventId ||
                (notif.link ? notif.link.match(/[a-fA-F0-9]{24}/)?.[0] : null);

              // Direct individual assignment
              const isAssignment =
                !isAdmin &&
                notif.type === 'assignment';

              // Unassigned church member receiving service notification / event reminder
              const canContribute =
                !isAdmin &&
                !isAssignment &&
                Boolean(eventId);

              return (
                <ListItem
                  key={notif._id}
                  onClick={() => handleNotificationClick(notif)}
                  sx={{
                    py: 1.5,
                    px: 2.5,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    cursor: notif.link ? 'pointer' : 'default',
                    bgcolor: notif.read ? 'transparent' : 'rgba(37, 99, 235, 0.05)',
                    transition: 'background-color 0.15s ease',
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {getNotificationIcon(notif.type)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={1}>
                        <Typography
                          variant="body2"
                          fontWeight={notif.read ? 600 : 700}
                          color="text.primary"
                          sx={{ lineHeight: 1.3 }}
                        >
                          {notif.title}
                        </Typography>
                        {!notif.read && (
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              bgcolor: 'primary.main',
                              flexShrink: 0,
                              mt: 0.5,
                            }}
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box component="span" sx={{ display: 'block', mt: 0.3 }}>
                        <Typography
                          component="span"
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            lineHeight: 1.4,
                          }}
                        >
                          {notif.message}
                        </Typography>

                        {/* Assignment Accept (Tick) / Reject (Cross) Action Controls */}
                        {isAssignment && (
                          <Box
                            component="span"
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              mt: 1,
                              pt: 0.75,
                              borderTop: '1px dashed',
                              borderColor: 'divider',
                              gap: 0.8,
                              flexWrap: 'wrap',
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {notif.actionStatus === 'accepted' ? (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Chip
                                  icon={<CheckIcon sx={{ fontSize: '13px !important', color: '#16a34a !important' }} />}
                                  label="Accepted ✓"
                                  size="small"
                                  sx={{
                                    height: 22,
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    bgcolor: 'rgba(22, 163, 74, 0.12)',
                                    color: '#16a34a',
                                    border: '1px solid rgba(22, 163, 74, 0.3)',
                                  }}
                                />
                              </Box>
                            ) : notif.actionStatus === 'declined' ? (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Chip
                                  icon={<CloseIcon sx={{ fontSize: '13px !important', color: '#dc2626 !important' }} />}
                                  label="Declined ✕"
                                  size="small"
                                  sx={{
                                    height: 22,
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    bgcolor: 'rgba(220, 38, 38, 0.12)',
                                    color: '#dc2626',
                                    border: '1px solid rgba(220, 38, 38, 0.3)',
                                  }}
                                />
                              </Box>
                            ) : (
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', width: '100%', gap: 1 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ mr: 'auto', fontWeight: 600, fontSize: '0.7rem' }}>
                                  Respond:
                                </Typography>
                                <Tooltip title="Accept Assignment (Tick)">
                                  <Button
                                    size="small"
                                    variant="contained"
                                    color="success"
                                    startIcon={
                                      respondingId === notif._id ? (
                                        <CircularProgress size={12} color="inherit" />
                                      ) : (
                                        <CheckIcon sx={{ fontSize: 13 }} />
                                      )
                                    }
                                    onClick={(e) => handleRespondNotification(e, notif, 'accept')}
                                    disabled={respondingId === notif._id}
                                    sx={{
                                      textTransform: 'none',
                                      fontWeight: 700,
                                      fontSize: '0.72rem',
                                      py: 0.3,
                                      px: 1.2,
                                      borderRadius: 1.5,
                                      minWidth: 70,
                                      boxShadow: '0 2px 6px rgba(34, 197, 94, 0.3)',
                                    }}
                                  >
                                    Accept
                                  </Button>
                                </Tooltip>
                                <Tooltip title="Reject Assignment (Cross)">
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="error"
                                    startIcon={<CloseIcon sx={{ fontSize: 13 }} />}
                                    onClick={(e) => handleRespondNotification(e, notif, 'decline')}
                                    disabled={respondingId === notif._id}
                                    sx={{
                                      textTransform: 'none',
                                      fontWeight: 700,
                                      fontSize: '0.72rem',
                                      py: 0.3,
                                      px: 1.2,
                                      borderRadius: 1.5,
                                      minWidth: 70,
                                    }}
                                  >
                                    Reject
                                  </Button>
                                </Tooltip>
                              </Box>
                            )}
                          </Box>
                        )}

                        {/* Contribute / Volunteer Action Control for Unassigned Church Members */}
                        {canContribute && (
                          <Box
                            component="span"
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              mt: 1,
                              pt: 0.75,
                              borderTop: '1px dashed',
                              borderColor: 'divider',
                              gap: 0.8,
                              flexWrap: 'wrap',
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {notif.actionStatus === 'contributed' ? (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Chip
                                  icon={<VolunteerActivismIcon sx={{ fontSize: '13px !important', color: '#9333ea !important' }} />}
                                  label="Volunteered 🤝"
                                  size="small"
                                  sx={{
                                    height: 22,
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    bgcolor: 'rgba(147, 51, 234, 0.12)',
                                    color: '#9333ea',
                                    border: '1px solid rgba(147, 51, 234, 0.3)',
                                  }}
                                />
                              </Box>
                            ) : (
                              <>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, fontSize: '0.7rem' }}>
                                  Want to serve?
                                </Typography>
                                <Tooltip title="Offer to volunteer & contribute to this service">
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="secondary"
                                    startIcon={<VolunteerActivismIcon sx={{ fontSize: 13 }} />}
                                    onClick={(e) => handleContributeClick(e, notif, eventId)}
                                    sx={{
                                      textTransform: 'none',
                                      fontWeight: 700,
                                      fontSize: '0.72rem',
                                      py: 0.3,
                                      px: 1.2,
                                      borderRadius: 1.5,
                                      borderColor: 'secondary.main',
                                      color: 'secondary.main',
                                      '&:hover': {
                                        bgcolor: 'rgba(147, 51, 234, 0.08)',
                                        borderColor: 'secondary.main',
                                      },
                                    }}
                                  >
                                    Contribute / Volunteer
                                  </Button>
                                </Tooltip>
                              </>
                            )}
                          </Box>
                        )}

                        <Typography
                          component="span"
                          variant="caption"
                          color="text.disabled"
                          sx={{ display: 'block', mt: 0.5, fontSize: '0.7rem' }}
                        >
                          {formatTime(notif.createdAt)}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              );
            })
          )}
        </List>

        {/* Footer: Phone Push Notification Controls */}
        <Paper
          square
          elevation={0}
          sx={{
            p: 1.5,
            px: 2,
            borderTop: 1,
            borderColor: 'divider',
            bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'background.default' : '#f8fafc'),
          }}
        >
          {testPushSuccess && (
            <Alert severity="success" sx={{ mb: 1, py: 0.3, fontSize: '0.75rem' }} onClose={() => setTestPushSuccess('')}>
              {testPushSuccess}
            </Alert>
          )}

          {pushError && (
            <Alert severity="warning" sx={{ mb: 1, py: 0.3, fontSize: '0.75rem' }} onClose={() => setPushError('')}>
              {pushError}
            </Alert>
          )}

          <Box display="flex" alignItems="center" justifyContent="space-between" gap={1}>
            <Box display="flex" alignItems="center" gap={1}>
              <PhoneAndroidIcon sx={{ fontSize: 20, color: pushStatus.isSubscribed ? 'success.main' : 'primary.main' }} />
              <Typography variant="caption" fontWeight={600} color="text.secondary">
                {pushStatus.isSubscribed ? 'Phone Push Active' : 'Phone Push Alerts'}
              </Typography>
            </Box>

            {pushStatus.isSubscribed ? (
              <Button
                size="small"
                variant="outlined"
                startIcon={<SendIcon sx={{ fontSize: 13 }} />}
                disabled={pushActionLoading}
                onClick={handleSendTestPush}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.72rem',
                  py: 0.3,
                  px: 1.2,
                  borderRadius: 1.5,
                }}
              >
                {pushActionLoading ? <CircularProgress size={14} /> : 'Send Test Alert'}
              </Button>
            ) : (
              <Button
                size="small"
                variant="contained"
                disabled={pushActionLoading || !pushStatus.isSupported}
                onClick={handleEnablePush}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.72rem',
                  py: 0.4,
                  px: 1.4,
                  borderRadius: 1.5,
                  fontWeight: 700,
                  boxShadow: 'none',
                }}
              >
                {pushActionLoading ? (
                  <CircularProgress size={14} color="inherit" />
                ) : (
                  'Enable on Phone'
                )}
              </Button>
            )}
          </Box>
        </Paper>
      </Popover>
    </Box>
  );
}

export default NotificationBell;
