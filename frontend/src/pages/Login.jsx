import React, { useState, useEffect } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Container,
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { MusicNote as MusicNoteIcon } from '@mui/icons-material';
import { login, clearError } from '../store/slices/authSlice';
import { isUserApproved } from '../utils/isUserApproved';

function Login() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error, isAuthenticated, user, userLoaded } = useSelector(
    (state) => state.auth
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

  useEffect(() => {
    if (!isAuthenticated || !userLoaded) return;
    const dest = isUserApproved(user) ? '/dashboard' : '/pending-approval';
    navigate(dest, { replace: true });
  }, [isAuthenticated, userLoaded, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await dispatch(login({ email: email.trim(), password })).unwrap();
    } catch {
      /* error in slice */
    }
  };

  return (
    <Box className="auth-page">
      <Container maxWidth="sm" sx={{ py: { xs: 4, sm: 8 } }}>
        <Stack spacing={3} alignItems="center">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                background: (theme) =>
                  `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(99, 102, 241, 0.35)',
              }}
            >
              <MusicNoteIcon sx={{ color: 'white', fontSize: 28 }} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={700} letterSpacing="-0.02em">
                wPlanner
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Worship planning, simplified
              </Typography>
            </Box>
          </Stack>

          <Paper
            elevation={0}
            sx={{
              width: '100%',
              p: { xs: 3, sm: 4 },
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              boxShadow:
                '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 12px 24px -4px rgb(0 0 0 / 0.08)',
            }}
          >
            <Typography variant="h4" fontWeight={700} gutterBottom>
              Sign in
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Use your team account to continue
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {typeof error === 'string' ? error : 'Something went wrong'}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit}>
              <Stack spacing={2.5}>
                <TextField
                  label="Email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  fullWidth
                />
                <TextField
                  label="Password"
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  fullWidth
                />
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={loading}
                  fullWidth
                >
                  {loading ? 'Signing in…' : 'Sign in'}
                </Button>
              </Stack>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
              No account?{' '}
              <Link component={RouterLink} to="/register" fontWeight={600}>
                Create one
              </Link>
            </Typography>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}

export default Login;
