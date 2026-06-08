import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  Switch,
} from '@mui/material';
import {
  Group as GroupIcon,
  PersonRemove as PersonRemoveIcon,
} from '@mui/icons-material';
import { fetchTeams } from '../store/slices/teamSlice';
import LoadingSpinner from '../components/common/LoadingSpinner';
import api from '../services/api';

function TeamList() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { teams, loading } = useSelector((state) => state.teams);
  const [churchMembers, setChurchMembers] = useState([]);
  const [membersError, setMembersError] = useState('');
  const [membersLoading, setMembersLoading] = useState(true);
  const [removeError, setRemoveError] = useState('');
  const [removingId, setRemovingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  const isChurchAdmin = !!user?.isAdmin;
  const currentUserId = user?._id?.toString?.() || user?.id?.toString?.() || '';

  useEffect(() => {
    dispatch(fetchTeams());
  }, [dispatch]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setMembersError('');
        setMembersLoading(true);
        const res = await api.get('/church/members');
        if (!cancelled) setChurchMembers(res.data || []);
      } catch (err) {
        if (!cancelled) {
          setMembersError(
            err?.response?.data?.message || 'Could not load church members'
          );
          setChurchMembers([]);
        }
      } finally {
        if (!cancelled) setMembersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refetchMembers = async () => {
    try {
      setMembersError('');
      const res = await api.get('/church/members');
      setChurchMembers(res.data || []);
    } catch (err) {
      setMembersError(
        err?.response?.data?.message || 'Could not load church members'
      );
    }
  };

  const handleToggleAvailability = async (row, newAvailable) => {
    try {
      setRemoveError('');
      setTogglingId(row.key);
      await api.patch('/church/members/availability', {
        available: newAvailable,
      });
      await refetchMembers();
      dispatch(fetchTeams());
    } catch (err) {
      setRemoveError(
        err?.response?.data?.message || 'Could not update availability'
      );
    } finally {
      setTogglingId(null);
    }
  };

  const handleRemoveFromRoster = async (row) => {
    const msg = `Remove ${row.name} from the church roster? They will be taken off every team and will no longer appear in this list.`;
    if (!window.confirm(msg)) return;
    try {
      setRemoveError('');
      setRemovingId(row.key);
      await api.delete(`/church/members/${row.key}`);
      await refetchMembers();
      dispatch(fetchTeams());
    } catch (err) {
      setRemoveError(
        err?.response?.data?.message || 'Could not remove this member'
      );
    } finally {
      setRemovingId(null);
    }
  };

  const churchRosterRows = useMemo(() => {
    const approved = churchMembers.filter(
      (m) => !m.approvalStatus || m.approvalStatus === 'approved'
    );
    return approved
      .map((m) => {
        const id = m._id?.toString?.() || String(m._id);
        return {
          key: id,
          name: m.name || '—',
          churchRole: m.role || '—',
          available: !!m.available,
          isAdminMember: !!m.isAdmin,
        };
      })
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      );
  }, [churchMembers]);

  if (loading || membersLoading) {
    return <LoadingSpinner size={48} />;
  }

  return (
    <Box
      className="list-page"
      sx={{
        p: { xs: 2, sm: 3 },
        maxWidth: 1200,
        mx: 'auto',
        width: '100%',
      }}
    >
      <Card
        elevation={0}
        sx={{
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: (theme) =>
            theme.palette.mode === 'light'
              ? '0 4px 24px -4px rgba(15, 23, 42, 0.12), 0 12px 48px -12px rgba(99, 102, 241, 0.15)'
              : 2,
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            px: { xs: 2.5, sm: 4 },
            py: { xs: 3, sm: 4 },
            pb: { xs: 2, sm: 2.5 },
            background: (theme) =>
              theme.palette.mode === 'light'
                ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(129, 140, 248, 0.12) 50%, rgba(255,255,255,0) 100%)'
                : 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(15, 23, 42, 0.4) 100%)',
          }}
        >
          <Stack
            direction="row"
            spacing={2}
            alignItems="flex-start"
            sx={{ mb: 1 }}
          >
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: 2.5,
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 8px 20px rgba(99, 102, 241, 0.35)',
              }}
            >
              <GroupIcon sx={{ fontSize: 30 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="h4"
                component="h1"
                sx={{
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.15,
                }}
              >
                Church roster
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ mt: 1, maxWidth: 720, lineHeight: 1.6 }}
              >
                Everyone approved for your church: the role they chose at signup
                and whether they look available right now.
              </Typography>
            </Box>
          </Stack>

          {teams.length > 0 && (
            <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 2 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ alignSelf: 'center', mr: 0.5 }}
              >
                Open a team:
              </Typography>
              {teams.map((t) => (
                <Chip
                  key={t._id}
                  component={Link}
                  to={`/teams/${t._id}`}
                  label={t.team?.name || 'Team'}
                  clickable
                  color="primary"
                  variant="outlined"
                  sx={{ fontWeight: 600 }}
                />
              ))}
            </Stack>
          )}
        </Box>

        <CardContent sx={{ px: { xs: 1, sm: 2 }, pb: { xs: 2, sm: 3 }, pt: 0 }}>
          {removeError && (
            <Alert
              severity="error"
              sx={{ mb: 2, mx: 1 }}
              onClose={() => setRemoveError('')}
            >
              {removeError}
            </Alert>
          )}
          {membersError && (
            <Typography variant="body2" color="error" sx={{ mb: 2, px: 1 }}>
              {membersError}
            </Typography>
          )}
          {churchRosterRows.length === 0 ? (
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ py: 4, textAlign: 'center' }}
            >
              No approved church members yet.
            </Typography>
          ) : (
            <TableContainer
              component={Paper}
              variant="outlined"
              sx={{
                borderRadius: 2,
                borderColor: 'divider',
                boxShadow: 'none',
              }}
            >
              <Table size="medium" sx={{ width: '100%' }}>
                <TableHead>
                  <TableRow
                    sx={{
                      bgcolor: 'action.hover',
                      '& th': {
                        fontWeight: 700,
                        fontSize: '0.875rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        py: 2,
                        borderBottom: '2px solid',
                        borderColor: 'divider',
                      },
                    }}
                  >
                    <TableCell>Name</TableCell>
                    <TableCell>Role (from signup)</TableCell>
                    <TableCell align="center" sx={{ width: 200 }}>
                      Available now
                    </TableCell>
                    {isChurchAdmin && (
                      <TableCell align="right" sx={{ width: 120 }}>
                        Remove
                      </TableCell>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {churchRosterRows.map((r) => (
                    <TableRow
                      key={r.key}
                      hover
                      sx={{
                        '& td': {
                          py: 2,
                          fontSize: '1rem',
                          verticalAlign: 'top',
                        },
                      }}
                    >
                      <TableCell>
                        <Typography variant="body1" fontWeight={700}>
                          {r.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body1">{r.churchRole}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Box
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 1.25,
                            justifyContent: 'center',
                          }}
                        >
                          <Box
                            sx={{
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              bgcolor: r.available
                                ? 'success.main'
                                : 'error.main',
                              boxShadow: (theme) =>
                                r.available
                                  ? `0 0 0 3px ${theme.palette.success.main}33`
                                  : `0 0 0 3px ${theme.palette.error.main}33`,
                            }}
                          />
                          <Typography
                            variant="body1"
                            fontWeight={600}
                            color={r.available ? 'success.main' : 'error.main'}
                          >
                            {r.available ? 'Yes' : 'No'}
                          </Typography>
                          {/* If current user and not admin, show toggle button */}
                          {!isChurchAdmin && r.key === currentUserId && (
                            <Tooltip
                              title={
                                r.available
                                  ? 'Set unavailable'
                                  : 'Set available'
                              }
                            >
                              <span>
                                <Switch
                                  size="small"
                                  checked={r.available}
                                  disabled={togglingId === r.key}
                                  onChange={(e) =>
                                    handleToggleAvailability(
                                      r,
                                      e.target.checked
                                    )
                                  }
                                  inputProps={{
                                    'aria-label': r.available
                                      ? 'Set unavailable'
                                      : 'Set available',
                                  }}
                                />
                              </span>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                      {isChurchAdmin && (
                        <TableCell align="right">
                          {r.key !== currentUserId && !r.isAdminMember ? (
                            <Tooltip title="Remove from roster">
                              <span>
                                <IconButton
                                  size="small"
                                  color="error"
                                  disabled={removingId === r.key}
                                  onClick={() => handleRemoveFromRoster(r)}
                                  aria-label={`Remove ${r.name} from roster`}
                                >
                                  <PersonRemoveIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          ) : (
                            <Typography variant="caption" color="text.disabled">
                              —
                            </Typography>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

export default TeamList;
