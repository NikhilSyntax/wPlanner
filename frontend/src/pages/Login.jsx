import React, { useState, useEffect } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Container,
  IconButton,
  InputAdornment,
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  MusicNote as MusicNoteIcon,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
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
  const [showPassword, setShowPassword] = useState(false);

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
      <Container maxWidth="xs" sx={{ py: { xs: 4, sm: 8 } }}>
        <Stack spacing={3} alignItems="center">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '10px',
                bgcolor: '#ff4d28',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 0 16px rgba(255, 77, 40, 0.4)',
              }}
            >
              <MusicNoteIcon sx={{ fontSize: 22 }} />
            </Box>
            <Box>
              <Typography
                variant="h6"
                fontWeight={800}
                letterSpacing="0.06em"
                sx={{ lineHeight: 1.1, textTransform: 'uppercase', color: '#ffffff' }}
              >
                wPlanner
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: '#a1a1aa',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  fontSize: '0.65rem',
                }}
              >
                Worship Workstation
              </Typography>
            </Box>
          </Stack>

          <Paper
            elevation={0}
            sx={{
              width: '100%',
              p: { xs: 3, sm: 4 },
              borderRadius: '14px',
              border: '1px solid',
              borderColor: 'rgba(255, 255, 255, 0.08)',
              bgcolor: '#0e0e0e',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.85)',
            }}
          >
            <Typography
              variant="h5"
              fontWeight={800}
              sx={{ letterSpacing: '-0.02em', mb: 0.5, color: '#ffffff' }}
            >
              Sign in
            </Typography>
            <Typography variant="body2" sx={{ mb: 3, color: '#a1a1aa' }}>
              Use your team account to continue
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: '8px' }}>
                {typeof error === 'string' ? error : 'Something went wrong'}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit}>
              <Stack spacing={2.25}>
                <Box>
                  <Typography
                    component="label"
                    htmlFor="login-email"
                    sx={{
                      display: 'block',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: '#d4d4d8',
                      mb: 0.75,
                      letterSpacing: '0.01em',
                    }}
                  >
                    Email address <Box component="span" sx={{ color: '#ff4d28' }}>*</Box>
                  </Typography>
                  <TextField
                    id="login-email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    placeholder="name@church.org"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    fullWidth
                  />
                </Box>

                <Box>
                  <Typography
                    component="label"
                    htmlFor="login-password"
                    sx={{
                      display: 'block',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: '#d4d4d8',
                      mb: 0.75,
                      letterSpacing: '0.01em',
                    }}
                  >
                    Password <Box component="span" sx={{ color: '#ff4d28' }}>*</Box>
                  </Typography>
                  <TextField
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    fullWidth
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                            size="small"
                            aria-label="toggle password visibility"
                            sx={{
                              color: '#71717a',
                              '&:hover': { color: '#ff4d28' },
                            }}
                          >
                            {showPassword ? (
                              <VisibilityOff fontSize="small" />
                            ) : (
                              <Visibility fontSize="small" />
                            )}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Box>

                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={loading}
                  fullWidth
                  sx={{
                    mt: 1,
                    py: 1.25,
                    fontWeight: 700,
                    borderRadius: '8px',
                    bgcolor: '#ff4d28',
                    '&:hover': { bgcolor: '#e63e18' },
                    boxShadow: '0 2px 10px rgba(255, 77, 40, 0.35)',
                  }}
                >
                  {loading ? 'Signing in…' : 'Sign in'}
                </Button>
              </Stack>
            </Box>

            <Typography variant="body2" sx={{ mt: 3, color: '#a1a1aa' }}>
              No account?{' '}
              <Link
                component={RouterLink}
                to="/register"
                fontWeight={700}
                sx={{ color: '#ff4d28', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
              >
                Create one
              </Link>
            </Typography>
          </Paper>

          {/* Scripture */}
          <Typography
            variant="body2"
            sx={{
              mt: 1,
              maxWidth: 360,
              textAlign: 'center',
              fontStyle: 'italic',
              color: '#71717a',
              lineHeight: 1.6,
              fontSize: '0.8rem',
            }}
          >
            "That the man of God may be perfect, thoroughly equipped for every good work."
            <Typography
              component="span"
              variant="caption"
              sx={{
                display: 'block',
                mt: 0.5,
                fontStyle: 'normal',
                fontWeight: 700,
                letterSpacing: '0.04em',
                color: '#ff4d28',
              }}
            >
              — 2 Timothy 3:17
            </Typography>
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}

export default Login;
