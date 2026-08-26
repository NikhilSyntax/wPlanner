import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Typography,
  Paper,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  PhoneAndroid as PhoneAndroidIcon,
  NotificationsActive as NotificationsActiveIcon,
  Send as SendIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import api from '../services/api';
import { resolveMediaUrl } from '../utils/mediaUrl';
import { fetchTeams } from '../store/slices/teamSlice';
import { updateUserProfilePhoto } from '../store/slices/authSlice';
import {
  getPushSubscriptionStatus,
  subscribeUserToPush,
  unsubscribeUserFromPush,
  sendTestPushNotification,
} from '../services/pushNotificationService';

function ProfileSettings() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const [church, setChurch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pending, setPending] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState('');
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoSuccess, setPhotoSuccess] = useState('');
  const [avatarCacheKey, setAvatarCacheKey] = useState(Date.now());

  // Push notifications state
  const [pushStatus, setPushStatus] = useState({
    isSupported: false,
    isSubscribed: false,
    permission: 'default',
  });
  const [pushLoading, setPushLoading] = useState(false);
  const [pushMsg, setPushMsg] = useState({ type: '', text: '' });

  const isPrivileged = !!(
    church?.isAdmin ||
    church?.isSubAdmin ||
    user?.isAdmin ||
    user?.isSubAdmin
  );

  useEffect(() => {
    const loadChurch = async () => {
      try {
        setLoading(true);
        const response = await api.get('/church/current');
        setChurch(response.data);
      } catch (err) {
        setError(
          err?.response?.data?.message || 'Failed to load church settings'
        );
      } finally {
        setLoading(false);
      }
    };

    loadChurch();
    checkPush();
  }, []);

  const checkPush = async () => {
    const status = await getPushSubscriptionStatus();
    setPushStatus(status);
  };

  useEffect(() => {
    const loadPending = async () => {
      if (!isPrivileged) return;
      try {
        setPendingError('');
        setPendingLoading(true);
        const response = await api.get('/church/requests/pending');
        setPending(response.data || []);
      } catch (err) {
        setPendingError(
          err?.response?.data?.message || 'Failed to load pending requests'
        );
      } finally {
        setPendingLoading(false);
      }
    };

    loadPending();
  }, [isPrivileged]);

  const handleReview = async (userId, decision) => {
    try {
      await api.patch(`/church/requests/${userId}`, { decision });
      setPending((prev) => prev.filter((u) => u._id !== userId));
      if (decision === 'approve') {
        dispatch(fetchTeams());
      }
    } catch (err) {
      setPendingError(
        err?.response?.data?.message || 'Failed to review join request'
      );
    }
  };

  const handlePhotoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('profilePhoto', file);

    try {
      setPhotoLoading(true);
      setPhotoSuccess('');
      setError('');
      const response = await api.patch('/users/profile-photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const photoPath = response.data.profilePhotoUrl || response.data.user?.profilePhotoUrl;
      dispatch(updateUserProfilePhoto(photoPath));
      setAvatarCacheKey(Date.now());

      setPhotoSuccess('Profile photo updated successfully!');
      setTimeout(() => setPhotoSuccess(''), 3000);
    } catch (err) {
      console.error('Photo upload error:', err);
      setError(
        err?.response?.data?.message || 'Failed to upload profile photo'
      );
    } finally {
      setPhotoLoading(false);
      event.target.value = '';
    }
  };

  // Push handlers
  const handleTogglePush = async () => {
    setPushLoading(true);
    setPushMsg({ type: '', text: '' });
    try {
      if (pushStatus.isSubscribed) {
        await unsubscribeUserFromPush();
        await checkPush();
        setPushMsg({ type: 'info', text: 'Push notifications disabled on this device.' });
      } else {
        await subscribeUserToPush();
        await checkPush();
        setPushMsg({ type: 'success', text: 'Phone notifications enabled! You will now receive lock-screen alerts.' });
      }
    } catch (err) {
      setPushMsg({ type: 'error', text: err.message || 'Error configuring push notifications.' });
    } finally {
      setPushLoading(false);
    }
  };

  const handleTestPush = async () => {
    setPushLoading(true);
    setPushMsg({ type: '', text: '' });
    try {
      const res = await sendTestPushNotification();
      setPushMsg({ type: 'success', text: res.message || 'Test push notification sent! Check your phone/screen.' });
    } catch (err) {
      setPushMsg({ type: 'error', text: err?.response?.data?.message || err.message || 'Failed to send test alert.' });
    } finally {
      setPushLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', pb: 5 }}>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Profile Settings
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        View your account, church details, and mobile notification preferences.
      </Typography>

      {user?.approvalStatus === 'pending' && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Your join request is waiting for a church administrator to approve you. Until then, the dashboard, events, teams, and songs are hidden.
        </Alert>
      )}
      {user?.approvalStatus === 'rejected' && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Your request to join this church was not approved. Contact your administrator if you need access.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {photoSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {photoSuccess}
        </Alert>
      )}

      <Stack spacing={3}>
        {/* User Profile Card */}
        <Card sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={28} />
              </Box>
            ) : (
              <Stack spacing={2.5}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                    Profile Photo
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap' }}>
                    <Avatar
                      sx={{
                        width: 80,
                        height: 80,
                        fontSize: '2rem',
                        background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                        boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)',
                      }}
                      src={user?.profilePhotoUrl ? `${resolveMediaUrl(user.profilePhotoUrl)}?t=${avatarCacheKey}` : undefined}
                      alt={user?.name}
                    >
                      {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </Avatar>
                    <Box>
                      <input
                        accept="image/*"
                        style={{ display: 'none' }}
                        id="profile-photo-input"
                        type="file"
                        onChange={handlePhotoUpload}
                        disabled={photoLoading}
                      />
                      <label htmlFor="profile-photo-input">
                        <Button
                          variant="contained"
                          component="span"
                          startIcon={<CloudUploadIcon />}
                          disabled={photoLoading}
                          sx={{ borderRadius: 2, textTransform: 'none' }}
                        >
                          {photoLoading ? 'Uploading...' : 'Upload Photo'}
                        </Button>
                      </label>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                        JPG, PNG, GIF up to 5MB
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                <Divider />

                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Full Name
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {user?.name || '-'}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Email Address
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {user?.email || '-'}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Church Role & Status
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} flexWrap="wrap">
                    <Chip
                      size="small"
                      color="primary"
                      label={user?.role || 'Member'}
                      sx={{ fontWeight: 700, fontSize: '0.75rem' }}
                    />
                    {user?.isAdmin && (
                      <Chip
                        size="small"
                        color="secondary"
                        label="Admin"
                        sx={{ fontWeight: 700, fontSize: '0.75rem' }}
                      />
                    )}
                    {user?.isSubAdmin && (
                      <Chip
                        size="small"
                        color="secondary"
                        label="Sub-Admin"
                        sx={{ fontWeight: 700, fontSize: '0.75rem' }}
                      />
                    )}
                  </Stack>
                </Box>

                <Divider />

                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Church
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {church?.name || '-'}
                  </Typography>
                </Box>

                {isPrivileged && (
                  <>
                    <Divider />
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Church Join Code
                      </Typography>
                      <Box sx={{ mt: 0.75 }}>
                        <Chip
                          color="primary"
                          label={church?.churchCode || 'Unavailable'}
                          sx={{ fontWeight: 700, letterSpacing: '0.08em' }}
                        />
                      </Box>
                    </Box>

                    <Divider />

                    <Box>
                      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                        Pending Join Requests
                      </Typography>

                      {pendingError && (
                        <Alert severity="error" sx={{ mb: 1.5 }}>
                          {pendingError}
                        </Alert>
                      )}

                      {pendingLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                          <CircularProgress size={24} />
                        </Box>
                      ) : pending.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          No pending join requests.
                        </Typography>
                      ) : (
                        <Stack spacing={1.5}>
                          {pending.map((p) => (
                            <Box
                              key={p._id}
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 2,
                                p: 1.5,
                                borderRadius: 2,
                                border: '1px solid',
                                borderColor: 'divider',
                              }}
                            >
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body2" fontWeight={600} noWrap>
                                  {p.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" noWrap>
                                  {p.email} • {p.role}
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="error"
                                  onClick={() => handleReview(p._id, 'reject')}
                                >
                                  Reject
                                </Button>
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={() => handleReview(p._id, 'approve')}
                                >
                                  Approve
                                </Button>
                              </Box>
                            </Box>
                          ))}
                        </Stack>
                      )}
                    </Box>
                  </>
                )}
              </Stack>
            )}
          </CardContent>
        </Card>

        {/* Mobile Phone & Web Push Notifications Card */}
        <Card sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
            <Box display="flex" alignItems="center" gap={1.5} mb={2}>
              <PhoneAndroidIcon color="primary" sx={{ fontSize: 28 }} />
              <Box>
                <Typography variant="h6" fontWeight={700}>
                  Phone Push Notifications
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Receive instant lock-screen alerts for setlist updates and volunteer roster assignments.
                </Typography>
              </Box>
            </Box>

            {pushMsg.text && (
              <Alert severity={pushMsg.type || 'info'} sx={{ mb: 2 }}>
                {pushMsg.text}
              </Alert>
            )}

            <Paper
              variant="outlined"
              sx={{
                p: 2.5,
                borderRadius: 2.5,
                bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'background.default' : '#f8fafc'),
              }}
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                justifyContent="space-between"
                gap={2}
              >
                <Box>
                  <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                    <Typography variant="subtitle2" fontWeight={700}>
                      Status on this Device:
                    </Typography>
                    {pushStatus.isSubscribed ? (
                      <Chip
                        icon={<CheckCircleIcon sx={{ fontSize: '15px !important' }} />}
                        label="Active"
                        color="success"
                        size="small"
                        sx={{ fontWeight: 700 }}
                      />
                    ) : (
                      <Chip
                        label={pushStatus.permission === 'denied' ? 'Blocked' : 'Disabled'}
                        color={pushStatus.permission === 'denied' ? 'error' : 'default'}
                        size="small"
                        sx={{ fontWeight: 600 }}
                      />
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {pushStatus.isSubscribed
                      ? 'This phone/browser is registered to receive lock-screen push alerts.'
                      : pushStatus.permission === 'denied'
                      ? 'Notifications are blocked in your browser settings. Please allow notifications for this site.'
                      : 'Enable notifications to receive mobile alerts even when the browser is closed.'}
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1.5} flexWrap="wrap">
                  {pushStatus.isSubscribed && (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<SendIcon />}
                      disabled={pushLoading}
                      onClick={handleTestPush}
                      sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
                    >
                      {pushLoading ? <CircularProgress size={16} /> : 'Send Test Alert'}
                    </Button>
                  )}

                  <Button
                    variant={pushStatus.isSubscribed ? 'outlined' : 'contained'}
                    color={pushStatus.isSubscribed ? 'error' : 'primary'}
                    size="small"
                    disabled={pushLoading || !pushStatus.isSupported}
                    onClick={handleTogglePush}
                    sx={{
                      borderRadius: 2,
                      textTransform: 'none',
                      fontWeight: 700,
                      boxShadow: pushStatus.isSubscribed ? 'none' : '0 2px 8px rgba(37, 99, 235, 0.25)',
                    }}
                  >
                    {pushLoading ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : pushStatus.isSubscribed ? (
                      'Disable on this Device'
                    ) : (
                      'Enable Phone Notifications'
                    )}
                  </Button>
                </Stack>
              </Stack>
            </Paper>

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
              💡 <strong>Tip for iPhones / iPads</strong>: Tap the Share button in Safari and select <em>"Add to Home Screen"</em> to enable push notifications on iOS 16.4+.
            </Typography>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}

export default ProfileSettings;
