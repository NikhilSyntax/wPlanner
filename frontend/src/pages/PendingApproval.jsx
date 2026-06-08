import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
} from '@mui/material';
import { HourglassEmpty as HourglassIcon } from '@mui/icons-material';
import { getCurrentUser } from '../store/slices/authSlice';
import { isUserApproved } from '../utils/isUserApproved';
import LoadingSpinner from '../components/common/LoadingSpinner';
import api from '../services/api';

function PendingApproval() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, userLoaded, isAuthenticated } = useSelector(
    (state) => state.auth
  );
  const [checking, setChecking] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);
  const [resubmitError, setResubmitError] = useState('');
  const [resubmitSuccess, setResubmitSuccess] = useState(false);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!userLoaded) {
    return <LoadingSpinner />;
  }

  if (isUserApproved(user)) {
    return <Navigate to="/dashboard" replace />;
  }

  const status = user?.approvalStatus;
  const isRejected = status === 'rejected';

  useEffect(() => {
    if (user?.approvalStatus === 'rejected') {
      setResubmitSuccess(false);
    }
  }, [user?.approvalStatus]);

  const handleRecheck = async () => {
    try {
      setChecking(true);
      const userDoc = await dispatch(getCurrentUser()).unwrap();
      const s = userDoc?.approvalStatus;
      const approved =
        s === undefined || s === null || s === 'approved';
      if (approved) navigate('/dashboard', { replace: true });
    } catch {
      /* still pending or session invalid */
    } finally {
      setChecking(false);
    }
  };

  const handleResubmitRequest = async () => {
    try {
      setResubmitting(true);
      setResubmitError('');
      const { data } = await api.post('/church/resubmit-request');
      if (data.accessToken) {
        localStorage.setItem('accessToken', data.accessToken);
      }
      await dispatch(getCurrentUser()).unwrap();
      setResubmitSuccess(true);
    } catch (e) {
      setResubmitError(
        e?.response?.data?.message || 'Could not resubmit your request'
      );
    } finally {
      setResubmitting(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 560, mx: 'auto', py: { xs: 2, sm: 4 } }}>
      <Card sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={2} alignItems="center" textAlign="center">
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 2,
                bgcolor: 'action.hover',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'primary.main',
              }}
            >
              <HourglassIcon sx={{ fontSize: 32 }} />
            </Box>
            <Typography variant="h5" fontWeight={700}>
              {isRejected ? 'Join request not approved' : 'Waiting for approval'}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {isRejected
                ? 'Your access to this church was not approved, or an administrator removed you from the roster. You can send a new join request so your admin can review you again.'
                : 'Your account is linked to the church, but an administrator must approve you before you can use the dashboard, events, teams, songs, and other planning tools.'}
            </Typography>
            {resubmitSuccess && user?.approvalStatus === 'pending' && (
              <Alert
                severity="success"
                onClose={() => setResubmitSuccess(false)}
                sx={{ width: '100%', textAlign: 'left' }}
              >
                Your join request was sent again. An administrator needs to
                approve you before you can use the app.
              </Alert>
            )}
            {isRejected && resubmitError && (
              <Alert severity="error" sx={{ width: '100%', textAlign: 'left' }}>
                {resubmitError}
              </Alert>
            )}
            {isRejected && (
              <Button
                variant="contained"
                onClick={handleResubmitRequest}
                disabled={resubmitting}
                fullWidth
                sx={{ textTransform: 'none', maxWidth: 360 }}
              >
                {resubmitting ? 'Sending…' : 'Resend join request'}
              </Button>
            )}
            {!isRejected && (
              <Alert severity="info" sx={{ width: '100%', textAlign: 'left' }}>
                You can open <strong>Profile settings</strong> to see your
                account details. Once an admin approves you, use the button below
                or refresh the page.
              </Alert>
            )}
            {!isRejected && (
              <Button
                variant="contained"
                onClick={handleRecheck}
                disabled={checking}
                sx={{ textTransform: 'none' }}
              >
                {checking ? 'Checking…' : 'I have been approved — continue'}
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

export default PendingApproval;
