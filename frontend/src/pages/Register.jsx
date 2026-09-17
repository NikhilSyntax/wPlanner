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
  IconButton,
  InputAdornment,
  Link,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  MusicNote as MusicNoteIcon,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { register, clearError } from '../store/slices/authSlice';
import { isUserApproved } from '../utils/isUserApproved';

const ROLE_OPTIONS = [
  'Admin',
  'Sub-Admin',
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
  const [joinOrCreate, setJoinOrCreate] = useState('join');
  const [churchName, setChurchName] = useState('');
  const [churchCode, setChurchCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const isAdminRole = role === 'Admin';

  useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

  useEffect(() => {
    if (!isAuthenticated || !userLoaded) return;
    const dest = isUserApproved(user) ? '/dashboard' : '/pending-approval';
    navigate(dest, { replace: true });
  }, [isAuthenticated, userLoaded, user, navigate]);

  const handleRoleChange = (e) => {
    const newRole = e.target.value;
    setRole(newRole);
    if (newRole === 'Admin') {
      setJoinOrCreate('create');
    } else {
      setJoinOrCreate('join');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const actualJoinOrCreate = isAdminRole ? joinOrCreate : 'join';

    try {
      await dispatch(
        register({
          name,
          email,
          password,
          role,
          joinOrCreate: actualJoinOrCreate,
          churchName: actualJoinOrCreate === 'create' ? churchName.trim() : undefined,
          churchCode: actualJoinOrCreate === 'join' ? churchCode.trim() : undefined,
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
              Create account
            </Typography>
            <Typography variant="body2" sx={{ mb: 3, color: '#a1a1aa' }}>
              Add your details to get started
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {typeof error === 'string' ? error : 'Something went wrong'}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit}>
              <Stack spacing={2.25}>
                <Box>
                  <Typography
                    component="label"
                    htmlFor="reg-name"
                    sx={{
                      display: 'block',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: '#d4d4d8',
                      mb: 0.75,
                      letterSpacing: '0.01em',
                    }}
                  >
                    Full Name <Box component="span" sx={{ color: '#ff4d28' }}>*</Box>
                  </Typography>
                  <TextField
                    id="reg-name"
                    name="name"
                    autoComplete="name"
                    placeholder="e.g. David Smith"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    fullWidth
                  />
                </Box>

                <Box>
                  <Typography
                    component="label"
                    htmlFor="reg-email"
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
                    id="reg-email"
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
                    htmlFor="reg-password"
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
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete="new-password"
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

                <Box>
                  <Typography
                    component="label"
                    htmlFor="reg-role"
                    sx={{
                      display: 'block',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: '#d4d4d8',
                      mb: 0.75,
                      letterSpacing: '0.01em',
                    }}
                  >
                    Ministry Role <Box component="span" sx={{ color: '#ff4d28' }}>*</Box>
                  </Typography>
                  <TextField
                    id="reg-role"
                    select
                    value={role}
                    onChange={handleRoleChange}
                    required
                    fullWidth
                  >
                    {ROLE_OPTIONS.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>

                {isAdminRole ? (
                  <>
                    <FormControl component="fieldset">
                      <FormLabel
                        component="legend"
                        sx={{
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          color: '#d4d4d8',
                          '&.Mui-focused': { color: '#ff4d28' },
                        }}
                      >
                        Church account
                      </FormLabel>
                      <RadioGroup
                        row
                        value={joinOrCreate}
                        onChange={(e) => setJoinOrCreate(e.target.value)}
                        sx={{ color: '#ffffff' }}
                      >
                        <FormControlLabel
                          value="create"
                          control={
                            <Radio
                              sx={{
                                color: 'rgba(255, 255, 255, 0.4)',
                                '&.Mui-checked': { color: '#ff4d28' },
                              }}
                            />
                          }
                          label="Create new church"
                        />
                        <FormControlLabel
                          value="join"
                          control={
                            <Radio
                              sx={{
                                color: 'rgba(255, 255, 255, 0.4)',
                                '&.Mui-checked': { color: '#ff4d28' },
                              }}
                            />
                          }
                          label="Join existing church"
                        />
                      </RadioGroup>
                    </FormControl>

                    {joinOrCreate === 'create' ? (
                      <Box>
                        <Typography
                          component="label"
                          htmlFor="reg-church-name"
                          sx={{
                            display: 'block',
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            color: '#d4d4d8',
                            mb: 0.75,
                            letterSpacing: '0.01em',
                          }}
                        >
                          Church name <Box component="span" sx={{ color: '#ff4d28' }}>*</Box>
                        </Typography>
                        <TextField
                          id="reg-church-name"
                          name="churchName"
                          value={churchName}
                          onChange={(e) => setChurchName(e.target.value)}
                          placeholder="e.g. Grace Fellowship Church"
                          required
                          fullWidth
                        />
                      </Box>
                    ) : (
                      <Box>
                        <Typography
                          component="label"
                          htmlFor="reg-church-code"
                          sx={{
                            display: 'block',
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            color: '#d4d4d8',
                            mb: 0.75,
                            letterSpacing: '0.01em',
                          }}
                        >
                          Church code <Box component="span" sx={{ color: '#ff4d28' }}>*</Box>
                        </Typography>
                        <TextField
                          id="reg-church-code"
                          name="churchCode"
                          value={churchCode}
                          onChange={(e) => setChurchCode(e.target.value)}
                          placeholder="6-character code (e.g. AB12CD)"
                          helperText="Enter the 6-character code of the church you wish to join"
                          required
                          fullWidth
                        />
                      </Box>
                    )}
                  </>
                ) : (
                  <Box>
                    <Typography
                      component="label"
                      htmlFor="reg-member-church-code"
                      sx={{
                        display: 'block',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        color: '#d4d4d8',
                        mb: 0.75,
                        letterSpacing: '0.01em',
                      }}
                    >
                      Church code <Box component="span" sx={{ color: '#ff4d28' }}>*</Box>
                    </Typography>
                    <TextField
                      id="reg-member-church-code"
                      name="churchCode"
                      value={churchCode}
                      onChange={(e) => setChurchCode(e.target.value)}
                      placeholder="6-character code (e.g. AB12CD)"
                      helperText="Ask your church administrator for your team's 6-character join code"
                      required
                      fullWidth
                    />
                  </Box>
                )}
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={loading}
                  fullWidth
                  sx={{
                    py: 1.2,
                    fontWeight: 700,
                    borderRadius: '8px',
                    bgcolor: '#ff4d28',
                    '&:hover': { bgcolor: '#e63e18' },
                    boxShadow: '0 2px 10px rgba(255, 77, 40, 0.35)',
                  }}
                >
                  {loading ? 'Creating account…' : 'Create account'}
                </Button>
              </Stack>
            </Box>

            <Typography variant="body2" sx={{ mt: 3, color: '#a1a1aa' }}>
              Already have an account?{' '}
              <Link
                component={RouterLink}
                to="/login"
                fontWeight={700}
                sx={{ color: '#ff4d28', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
              >
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
