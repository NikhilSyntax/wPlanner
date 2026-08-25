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
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  RadioGroup,
  Radio,
  FormControlLabel,
  FormLabel,
} from '@mui/material';
import {
  Group as GroupIcon,
  PersonRemove as PersonRemoveIcon,
  ManageAccounts as ManageAccountsIcon,
  Shield as ShieldIcon,
  WorkspacePremium as CrownIcon,
} from '@mui/icons-material';
import { fetchTeams } from '../store/slices/teamSlice';
import LoadingSpinner from '../components/common/LoadingSpinner';
import api from '../services/api';

const MINISTRY_ROLES = [
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

function TeamList() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { teams, loading } = useSelector((state) => state.teams);
  const [churchMembers, setChurchMembers] = useState([]);
  const [membersError, setMembersError] = useState('');
  const [membersLoading, setMembersLoading] = useState(true);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [removingId, setRemovingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  // Role management modal state
  const [selectedMember, setSelectedMember] = useState(null);
  const [editRole, setEditRole] = useState('Member');
  const [editAdminRole, setEditAdminRole] = useState('member');
  const [isSavingRole, setIsSavingRole] = useState(false);

  const isFullAdmin = !!user?.isAdmin;
  const isSubAdmin = !!user?.isSubAdmin;
  const isPrivileged = isFullAdmin || isSubAdmin;
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
      setActionError('');
      setTogglingId(row.key);
      await api.patch('/church/members/availability', {
        available: newAvailable,
      });
      await refetchMembers();
      dispatch(fetchTeams());
    } catch (err) {
      setActionError(
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
      setActionError('');
      setActionSuccess('');
      setRemovingId(row.key);
      await api.delete(`/church/members/${row.key}`);
      setActionSuccess(`${row.name} was removed from the roster.`);
      await refetchMembers();
      dispatch(fetchTeams());
    } catch (err) {
      setActionError(
        err?.response?.data?.message || 'Could not remove this member'
      );
    } finally {
      setRemovingId(null);
    }
  };

  const handleOpenRoleModal = (row) => {
    setSelectedMember(row);
    setEditRole(row.churchRole === '—' ? 'Member' : row.churchRole);
    if (row.isAdminMember) {
      setEditAdminRole('admin');
    } else if (row.isSubAdminMember) {
      setEditAdminRole('sub-admin');
    } else {
      setEditAdminRole('member');
    }
  };

  const handleCloseRoleModal = () => {
    setSelectedMember(null);
    setIsSavingRole(false);
  };

  const handleSaveRole = async () => {
    if (!selectedMember) return;
    try {
      setIsSavingRole(true);
      setActionError('');
      setActionSuccess('');

      await api.patch(`/church/members/${selectedMember.key}/role`, {
        role: editRole,
        adminRole: editAdminRole,
      });

      setActionSuccess(`Updated ${selectedMember.name}'s role and permissions.`);
      handleCloseRoleModal();
      await refetchMembers();
    } catch (err) {
      setActionError(
        err?.response?.data?.message || 'Failed to update member role'
      );
    } finally {
      setIsSavingRole(false);
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
          isSubAdminMember: !!m.isSubAdmin,
          isCreator: !!m.isCreator,
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
            py: { xs: 3, sm: 3.5 },
            pb: { xs: 2, sm: 2.5 },
            background: (theme) =>
              theme.palette.mode === 'light'
                ? 'linear-gradient(135deg, rgba(37, 99, 235, 0.06) 0%, rgba(6, 182, 212, 0.04) 100%)'
                : 'linear-gradient(135deg, rgba(37, 99, 235, 0.12) 0%, rgba(15, 23, 42, 0.5) 100%)',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Stack
            direction="row"
            spacing={2}
            alignItems="center"
            sx={{ mb: 1 }}
          >
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
              }}
            >
              <GroupIcon sx={{ fontSize: 26 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="h4"
                component="h1"
                sx={{
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                }}
              >
                Church Roster
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5, maxWidth: 720 }}
              >
                Manage church members, assign Sub-Admins or Admins, and view live availability.
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
          {actionSuccess && (
            <Alert
              severity="success"
              sx={{ mb: 2, mx: 1 }}
              onClose={() => setActionSuccess('')}
            >
              {actionSuccess}
            </Alert>
          )}
          {actionError && (
            <Alert
              severity="error"
              sx={{ mb: 2, mx: 1 }}
              onClose={() => setActionError('')}
            >
              {actionError}
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
                    <TableCell>Ministry Role</TableCell>
                    <TableCell>Access Level</TableCell>
                    <TableCell align="center" sx={{ width: 170 }}>
                      Available now
                    </TableCell>
                    {isFullAdmin && (
                      <TableCell align="right" sx={{ width: 140 }}>
                        Actions
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
                          verticalAlign: 'middle',
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
                      <TableCell>
                        {r.isCreator ? (
                          <Chip
                            icon={<CrownIcon sx={{ fontSize: '1rem !important' }} />}
                            label="Creator (Admin)"
                            color="primary"
                            size="small"
                            sx={{ fontWeight: 700, letterSpacing: '0.02em' }}
                          />
                        ) : r.isAdminMember ? (
                          <Chip
                            label="Admin"
                            color="primary"
                            variant="outlined"
                            size="small"
                            sx={{ fontWeight: 700 }}
                          />
                        ) : r.isSubAdminMember ? (
                          <Chip
                            icon={<ShieldIcon sx={{ fontSize: '1rem !important' }} />}
                            label="Sub-Admin"
                            color="secondary"
                            size="small"
                            sx={{ fontWeight: 700 }}
                          />
                        ) : (
                          <Chip
                            label="Member"
                            size="small"
                            variant="outlined"
                            sx={{ color: 'text.secondary', borderColor: 'divider' }}
                          />
                        )}
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
                          {!isPrivileged && r.key === currentUserId && (
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
                      {isFullAdmin && (
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
                            <Tooltip title="Manage role & permissions">
                              <span>
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => handleOpenRoleModal(r)}
                                  aria-label={`Manage role for ${r.name}`}
                                >
                                  <ManageAccountsIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>

                            {r.key !== currentUserId && !r.isCreator && !r.isAdminMember ? (
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
                              <Box sx={{ width: 28 }} />
                            )}
                          </Stack>
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

      {/* Role Management Dialog */}
      <Dialog
        open={Boolean(selectedMember)}
        onClose={handleCloseRoleModal}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          Manage Role & Permissions
        </DialogTitle>
        <DialogContent dividers>
          {selectedMember && (
            <Stack spacing={3} sx={{ pt: 1 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Member
                </Typography>
                <Typography variant="h6" fontWeight={700}>
                  {selectedMember.name}
                </Typography>
              </Box>

              <FormControl fullWidth>
                <InputLabel id="edit-ministry-role-label">Ministry Role</InputLabel>
                <Select
                  labelId="edit-ministry-role-label"
                  label="Ministry Role"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                >
                  {MINISTRY_ROLES.map((r) => (
                    <MenuItem key={r} value={r}>
                      {r}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl component="fieldset">
                <FormLabel component="legend" sx={{ fontWeight: 600, mb: 1 }}>
                  Administrative Access
                </FormLabel>
                <RadioGroup
                  value={editAdminRole}
                  onChange={(e) => setEditAdminRole(e.target.value)}
                >
                  <FormControlLabel
                    value="member"
                    control={<Radio />}
                    disabled={selectedMember.isCreator}
                    label={
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          Regular Member
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Standard team and event access
                        </Typography>
                      </Box>
                    }
                  />
                  <FormControlLabel
                    value="sub-admin"
                    control={<Radio />}
                    disabled={selectedMember.isCreator}
                    label={
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          Sub-Admin
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Can manage teams, events, songs, and review join requests
                        </Typography>
                      </Box>
                    }
                  />
                  <FormControlLabel
                    value="admin"
                    control={<Radio />}
                    label={
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          Full Administrator
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Complete control over church roster, roles, and settings
                        </Typography>
                      </Box>
                    }
                  />
                </RadioGroup>
                {selectedMember.isCreator && (
                  <Typography variant="caption" color="warning.main" sx={{ mt: 1 }}>
                    Note: The church creator must remain an administrator.
                  </Typography>
                )}
              </FormControl>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleCloseRoleModal} disabled={isSavingRole}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveRole}
            disabled={isSavingRole}
          >
            {isSavingRole ? 'Saving…' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default TeamList;

