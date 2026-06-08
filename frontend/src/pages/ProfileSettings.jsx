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
} from '@mui/material';
import { CloudUpload as CloudUploadIcon } from '@mui/icons-material';
import api from '../services/api';
import { resolveMediaUrl } from '../utils/mediaUrl';
import { fetchTeams } from '../store/slices/teamSlice';
import { updateUserProfilePhoto } from '../store/slices/authSlice';

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
  }, []);

  useEffect(() => {
    const loadPending = async () => {
      if (!church?.isAdmin) return;
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
  }, [church?.isAdmin]);

  const reviewRequest = async (userId, decision) => {
    try {
      await api.patch(`/church/requests/${userId}`, { decision });
      setPending((prev) => prev.filter((u) => u._id !== userId));
      // If approved, teams may have changed (auto-assignment), so refresh.
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

      const photoUrl = `${resolveMediaUrl(response.data.profilePhotoUrl)}?t=${Date.now()}`;
      dispatch(updateUserProfilePhoto(photoUrl));

      setPhotoSuccess('Profile photo updated successfully!');
      setTimeout(() => setPhotoSuccess(''), 3000);

      console.log('Profile photo uploaded successfully:', photoUrl);
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

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Profile Settings
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        View your account and church details.
      </Typography>

      {user?.approvalStatus === 'pending' && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Your join request is waiting for a church administrator to approve
          you. Until then, the dashboard, events, teams, and songs are hidden.
        </Alert>
      )}
      {user?.approvalStatus === 'rejected' && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Your request to join this church was not approved. Contact your
          administrator if you need access.
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

      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                  Profile Photo
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar
                    sx={{
                      width: 80,
                      height: 80,
                      fontSize: '2rem',
                      background:
                        'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    }}
                    src={resolveMediaUrl(user?.profilePhotoUrl)}
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
                        sx={{ mb: 1 }}
                      >
                        {photoLoading ? 'Uploading...' : 'Change Photo'}
                      </Button>
                    </label>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                    >
                      JPG, PNG or GIF (max 5MB)
                    </Typography>
                  </Box>
                </Box>
              </Box>
              <Divider />
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Name
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {user?.name || '-'}
                </Typography>
              </Box>
              <Divider />
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Email
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {user?.email || '-'}
                </Typography>
              </Box>
              <Divider />
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Role
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {user?.role || '-'}
                </Typography>
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
              {church?.isAdmin && (
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
                    <Typography
                      variant="subtitle1"
                      fontWeight={700}
                      sx={{ mb: 1 }}
                    >
                      Pending approvals
                    </Typography>

                    {pendingError && (
                      <Alert severity="error" sx={{ mb: 2 }}>
                        {pendingError}
                      </Alert>
                    )}

                    {pendingLoading ? (
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'center',
                          py: 2,
                        }}
                      >
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
                              p: 1.25,
                              borderRadius: 2,
                              border: '1px solid',
                              borderColor: 'divider',
                            }}
                          >
                            <Box sx={{ minWidth: 0 }}>
                              <Typography
                                variant="body2"
                                fontWeight={600}
                                noWrap
                              >
                                {p.name}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                noWrap
                              >
                                {p.email} • {p.role}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                onClick={() => reviewRequest(p._id, 'reject')}
                              >
                                Reject
                              </Button>
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => reviewRequest(p._id, 'approve')}
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
    </Box>
  );
}

export default ProfileSettings;
