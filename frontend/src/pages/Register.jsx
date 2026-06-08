import React, { useState, useEffect } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Container,
  FormControl,
  FormControlLabel,
  FormLabel,
  Link,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { MusicNote as MusicNoteIcon } from '@mui/icons-material';
import { register, clearError } from '../store/slices/authSlice';
import { isUserApproved } from '../utils/isUserApproved';

const ROLE_OPTIONS = [
  'Admin',
  'Worship Leader',
  'Singer',
  'Guitarist',
  'Keyboardist',
  'Drummer',
  'Bassist',
  'Production',
  'Member',
  'Other',
];

function Register() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error, isAuthenticated, user, userLoaded } = useSelector(
    (state) => state.auth
  );

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Member');
  const [joinOrCreate, setJoinOrCreate] = useState('create');
  const [churchName, setChurchName] = useState('');
  const [churchCode, setChurchCode] = useState('');

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
      await dispatch(
        register({
          name,
          email,
          password,
          role,
          joinOrCreate,
          churchName: joinOrCreate === 'create' ? churchName : undefined,
          churchCode: joinOrCreate === 'join' ? churchCode : undefined,
        })
      ).unwrap();
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
                Join your worship team
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
              Create account
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Add your details to get started
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {typeof error === 'string' ? error : 'Something went wrong'}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit}>
              <Stack spacing={2.5}>
                <TextField
                  label="Name"
                  name="name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  fullWidth
                />
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
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  fullWidth
                />
                <TextField
                  select
                  label="Role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  required
                  fullWidth
                >
                  {ROLE_OPTIONS.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
                <FormControl component="fieldset">
                  <FormLabel component="legend">Church account</FormLabel>
                  <RadioGroup
                    row
                    value={joinOrCreate}
                    onChange={(e) => setJoinOrCreate(e.target.value)}
                  >
                    <FormControlLabel
                      value="create"
                      control={<Radio />}
                      label="Create new church"
                    />
                    <FormControlLabel
                      value="join"
                      control={<Radio />}
                      label="Join existing church"
                    />
                  </RadioGroup>
                </FormControl>
                {joinOrCreate === 'create' ? (
                  <TextField
                    label="Church name"
                    name="churchName"
                    value={churchName}
                    onChange={(e) => setChurchName(e.target.value)}
                    required
                    fullWidth
                  />
                ) : (
                  <TextField
                    label="Church code"
                    name="churchCode"
                    value={churchCode}
                    onChange={(e) => setChurchCode(e.target.value)}
                    required
                    fullWidth
                  />
                )}
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={loading}
                  fullWidth
                >
                  {loading ? 'Creating account…' : 'Create account'}
                </Button>
              </Stack>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
              Already have an account?{' '}
              <Link component={RouterLink} to="/login" fontWeight={600}>
                Sign in
              </Link>
            </Typography>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}

export default Register;
