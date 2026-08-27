import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Box, Button, Typography, Divider, Alert } from '@mui/material';
import { Chat as ChatIcon } from '@mui/icons-material';
import api from '../services/api';

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
  const [team, setTeam] = useState(null);
  const [churchMembers, setChurchMembers] = useState([]);
  const [actionError, setActionError] = useState('');

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

  const addToTeam = async (userId) => {
    try {
      setActionError('');
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
        <Link to="/teams">← Back to Teams</Link>
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
          {actionError && (
            <Alert severity="error" sx={{ mb: 2 }}>
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
                    Roles
                  </Box>
                  <Box component="th" sx={{ py: 1 }}>
                    Joined
                  </Box>
                </Box>
              </Box>
              <Box component="tbody">
                {team.members.map((m, idx) => (
                  <Box
                    key={idx}
                    component="tr"
                    sx={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}
                  >
                    <Box component="td" sx={{ py: 1 }}>
                      {m.userId?.name || 'Unknown'}
                    </Box>
                    <Box component="td" sx={{ py: 1 }}>
                      {(m.roles || []).join(', ')}
                    </Box>
                    <Box component="td" sx={{ py: 1 }}>
                      {new Date(m.joinedAt).toLocaleDateString()}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          ) : (
            <Typography>No members yet.</Typography>
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
          <Typography variant="h6" gutterBottom>
            Church Instrumentalists
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Shows every instrumentalist in your church and whether they are
            available now.
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
                }}
              >
                <Box>
                  <Typography variant="body1">{member.name}</Typography>
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
                    {member.available ? 'Available' : 'Not available'}
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={memberIds.has(member._id)}
                    onClick={() => addToTeam(member._id)}
                    sx={{ ml: 1, textTransform: 'none' }}
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
    </Box>
  );
}

export default TeamDetails;
