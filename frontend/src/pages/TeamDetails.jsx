import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Box,
  Button,
  Typography,
  Divider,
  Alert,
  IconButton,
  Tooltip,
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
  Stack,
  Chip,
} from '@mui/material';
import {
  Chat as ChatIcon,
  ManageAccounts as ManageAccountsIcon,
} from '@mui/icons-material';
import api from '../services/api';

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

const INSTRUMENT_ROLES = [
  'Singer',
  'Guitarist',
  'Keyboardist',
  'Drummer',
  'Bassist',
  'Production',
  'Worship Leader',
];

function TeamDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const isFullAdmin = !!user?.isAdmin;

  const [team, setTeam] = useState(null);
  const [churchMembers, setChurchMembers] = useState([]);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Role management modal state
  const [selectedMember, setSelectedMember] = useState(null);
  const [editRole, setEditRole] = useState('Member');
  const [editAdminRole, setEditAdminRole] = useState('member');
  const [isSavingRole, setIsSavingRole] = useState(false);

  useEffect(() => {
    fetchTeam();
    fetchChurchMembers();
  }, [id]);

  const fetchTeam = async () => {
    try {
      const res = await api.get(`/teams/${id}`);
      setTeam(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchChurchMembers = async () => {
    try {
      const res = await api.get('/church/members');
      setChurchMembers(
        res.data.filter((member) => {
          const r = String(member.role || '').toLowerCase().trim();
          return INSTRUMENT_ROLES.includes(member.role) && !member.isAdmin && r !== 'admin';
        })
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenRoleModal = (userObj) => {
    if (!userObj) return;
    const userId = userObj._id || userObj.id || userObj.userId?._id || userObj.userId;
    const userName = userObj.name || userObj.userId?.name || 'Member';
    const userRole = userObj.role || userObj.userId?.role || 'Member';
    const isAdmin = !!(userObj.isAdmin || userObj.userId?.isAdmin);
    const isSubAdmin = !!(userObj.isSubAdmin || userObj.userId?.isSubAdmin);
    const isCreator = !!(userObj.isCreator || userObj.userId?.isCreator);

    setSelectedMember({
      key: String(userId),
      name: userName,
      churchRole: userRole,
      isAdminMember: isAdmin,
      isSubAdminMember: isSubAdmin,
      isCreator,
    });
    setEditRole(userRole === '—' ? 'Member' : userRole);
    if (isAdmin) {
      setEditAdminRole('admin');
    } else if (isSubAdmin) {
      setEditAdminRole('sub-admin');
    } else {
      setEditAdminRole('member');
    }
  };

  const handleRoleSelect = (newRole) => {
    setEditRole(newRole);
    if (newRole === 'Admin') {
      setEditAdminRole('admin');
    } else if (newRole === 'Sub-Admin') {
      if (!selectedMember?.isCreator) {
        setEditAdminRole('sub-admin');
      }
    }
  };

  const handleAdminRoleSelect = (newAdminRole) => {
    setEditAdminRole(newAdminRole);
    if (newAdminRole === 'admin' && (editRole === 'Member' || editRole === 'Sub-Admin')) {
      setEditRole('Admin');
    } else if (newAdminRole === 'sub-admin' && (editRole === 'Admin' || editRole === 'Member')) {
      setEditRole('Sub-Admin');
    } else if (newAdminRole === 'member' && (editRole === 'Admin' || editRole === 'Sub-Admin')) {
      setEditRole('Member');
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
      await fetchTeam();
      await fetchChurchMembers();
    } catch (err) {
      setActionError(
        err?.response?.data?.message || 'Failed to update member role'
      );
    } finally {
      setIsSavingRole(false);
    }
  };

  const addToTeam = async (userId) => {
    try {
      setActionError('');
      setActionSuccess('');
      const updated = await api.post(`/teams/${id}/members`, { userId });
      setTeam(updated.data);
    } catch (err) {
      setActionError(err?.response?.data?.message || 'Failed to add member');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this team?')) return;
    try {
      await api.delete(`/teams/${id}`);
      navigate('/teams');
    } catch (err) {
      console.error(err);
      alert('Error deleting team');
    }
  };

  if (!team) return <div>Loading...</div>;

  const memberIds = new Set((team.members || []).map((m) => m.userId?._id || m.userId));

  return (
    <Box className="team-details" sx={{ p: 2 }}>
      <Box mb={2}>
        <Link to="/teams">← Back to Teams & Church Roster</Link>
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 4,
        }}
      >
        <Box sx={{ flex: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={2} mb={1}>
            <Box>
              <Typography variant="h4" component="h2" gutterBottom sx={{ fontWeight: 700 }}>
                {team.team?.name || 'Unnamed Team'}
              </Typography>
              <Typography variant="body1" sx={{ mb: 1 }}>
                <strong>Type:</strong> {team.team?.type || 'other'}
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                <strong>Description:</strong> {team.team?.description || 'N/A'}
              </Typography>
            </Box>

            <Button
              variant="contained"
              color="primary"
              startIcon={<ChatIcon />}
              onClick={() => navigate(`/teams/${id}/chat`)}
              sx={{ borderRadius: 2, textTransform: 'none', px: 2.5, py: 1, fontWeight: 700 }}
            >
              Team Chat
            </Button>
          </Box>

          <Typography variant="h6" gutterBottom>
            Members
          </Typography>

          {actionSuccess && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setActionSuccess('')}>
              {actionSuccess}
            </Alert>
          )}
          {actionError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError('')}>
              {actionError}
            </Alert>
          )}

          {team.members && team.members.length > 0 ? (
            <Box
              component="table"
              sx={{ width: '100%', borderCollapse: 'collapse', mb: 2 }}
            >
              <Box component="thead">
                <Box
                  component="tr"
                  sx={{
                    textAlign: 'left',
                    borderBottom: '1px solid rgba(0,0,0,0.12)',
                  }}
                >
                  <Box component="th" sx={{ py: 1 }}>
                    User
                  </Box>
                  <Box component="th" sx={{ py: 1 }}>
                    Ministry Role
                  </Box>
                  <Box component="th" sx={{ py: 1 }}>
                    Team Roles
                  </Box>
                  <Box component="th" sx={{ py: 1 }}>
                    Joined
                  </Box>
                  {isFullAdmin && (
                    <Box component="th" sx={{ py: 1, textAlign: 'right' }}>
                      Actions
                    </Box>
                  )}
                </Box>
              </Box>
              <Box component="tbody">
                {team.members.map((m, idx) => (
                  <Box
                    key={idx}
                    component="tr"
                    sx={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}
                  >
                    <Box component="td" sx={{ py: 1, fontWeight: 600 }}>
                      {m.userId?.name || 'Unknown'}
                    </Box>
                    <Box component="td" sx={{ py: 1 }}>
                      <Chip
                        label={m.userId?.role || 'Member'}
                        size="small"
                        variant="outlined"
                        color={m.userId?.role === 'Admin' ? 'primary' : 'default'}
                      />
                    </Box>
                    <Box component="td" sx={{ py: 1 }}>
                      {(m.roles || []).join(', ') || '—'}
                    </Box>
                    <Box component="td" sx={{ py: 1, color: 'text.secondary' }}>
                      {new Date(m.joinedAt).toLocaleDateString()}
                    </Box>
                    {isFullAdmin && (
                      <Box component="td" sx={{ py: 1, textAlign: 'right' }}>
                        <Tooltip title={`Manage role & permissions for ${m.userId?.name || 'member'}`}>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleOpenRoleModal(m.userId || m)}
                            aria-label={`Manage role for ${m.userId?.name || 'member'}`}
                          >
                            <ManageAccountsIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )}
                  </Box>
                ))}
              </Box>
            </Box>
          ) : (
            <Typography sx={{ mb: 2 }}>No members yet.</Typography>
          )}

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Link to={`/teams/${id}/edit`} style={{ textDecoration: 'none' }}>
              <Button variant="contained">Edit Team</Button>
            </Link>
            <Button variant="outlined" color="error" onClick={handleDelete}>
              Delete Team
            </Button>
          </Box>
        </Box>

        <Box
          sx={{
            flex: 1,
            border: '1px solid rgba(0,0,0,0.12)',
            borderRadius: 2,
            p: 2,
            minWidth: 280,
          }}
        >
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="h6" fontWeight={700}>
              Church Instrumentalists
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Shows every instrumentalist in your church and whether they are available now.
          </Typography>
          <Divider sx={{ mb: 2 }} />
          {churchMembers.length > 0 ? (
            churchMembers.map((member) => (
              <Box
                key={member._id}
                sx={{
                  mb: 2,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body1" fontWeight={600} noWrap>
                    {member.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {member.role}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      backgroundColor: member.available ? 'green' : 'red',
                    }}
                  />
                  <Typography
                    variant="body2"
                    color={member.available ? 'success.main' : 'error.main'}
                  >
                    {member.available ? 'Available' : 'Unavailable'}
                  </Typography>

                  {isFullAdmin && (
                    <Tooltip title={`Manage role for ${member.name}`}>
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleOpenRoleModal(member)}
                        sx={{ p: 0.5 }}
                        aria-label={`Manage role for ${member.name}`}
                      >
                        <ManageAccountsIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  )}

                  <Button
                    size="small"
                    variant="outlined"
                    disabled={memberIds.has(member._id)}
                    onClick={() => addToTeam(member._id)}
                    sx={{ ml: 0.5, textTransform: 'none' }}
                  >
                    {memberIds.has(member._id) ? 'Added' : 'Add to team'}
                  </Button>
                </Box>
              </Box>
            ))
          ) : (
            <Typography>No instrumentalists found.</Typography>
          )}
        </Box>
      </Box>

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
                <InputLabel id="edit-team-ministry-role-label">Ministry Role</InputLabel>
                <Select
                  labelId="edit-team-ministry-role-label"
                  label="Ministry Role"
                  value={editRole}
                  onChange={(e) => handleRoleSelect(e.target.value)}
                >
                  {ROLE_OPTIONS.map((r) => (
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
                  onChange={(e) => handleAdminRoleSelect(e.target.value)}
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

export default TeamDetails;
