import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  Paper,
  InputAdornment,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  TextField,
  Stack,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Event as EventIcon,
  Clear as ClearIcon,
  QueueMusic as QueueMusicIcon,
  CheckCircle as CheckCircleIcon,
  HourglassEmpty as HourglassEmptyIcon,
  EditNote as EditNoteIcon,
} from '@mui/icons-material';
import { fetchEvents, deleteEvent } from '../store/slices/eventSlice';
import { fetchTeams } from '../store/slices/teamSlice';
import DataTable from '../components/common/DataTable';
import LoadingSpinner from '../components/common/LoadingSpinner';
import api from '../services/api';

const statusColors = {
  draft: 'default',
  published: 'primary',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'error',
};

const getEventInfo = (row) => row?.event || {};
const getEventTitle = (row) => getEventInfo(row).title || 'Untitled Event';
const getEventDescription = (row) => getEventInfo(row).description || '';
const getEventType = (row) => getEventInfo(row).type || 'service';
const getSchedule = (row) => row?.schedule || {};
const getScheduleStart = (row) => getSchedule(row).start || null;
const getScheduleEnd = (row) => getSchedule(row).end || null;

function EventsList() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { events, loading, error } = useSelector((state) => state.events);
  const { teams } = useSelector((state) => state.teams);
  const { user } = useSelector((state) => state.auth);

  const isAdminOrSubAdmin = Boolean(
    user?.isAdmin ||
    user?.isSubAdmin ||
    user?.role === 'admin' ||
    user?.role === 'sub_admin' ||
    user?.roles?.includes('admin') ||
    user?.roles?.includes('sub_admin')
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [filteredEvents, setFilteredEvents] = useState([]);

  useEffect(() => {
    dispatch(fetchEvents());
    dispatch(fetchTeams());
  }, [dispatch]);

  useEffect(() => {
    let filtered = events;

    if (searchTerm) {
      filtered = filtered.filter(
        (event) =>
          getEventTitle(event)
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          getEventDescription(event)
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
      );
    }

    const computeStatus = (row) => {
      const backendStatus = row.event?.status || 'draft';
      const start = getScheduleStart(row) ? new Date(getScheduleStart(row)) : null;
      const end = getScheduleEnd(row) ? new Date(getScheduleEnd(row)) : null;
      const now = new Date();
      if (backendStatus === 'draft') return 'draft';
      if (backendStatus === 'published') {
        if (start && end) {
          if (now < start) return 'published';
          if (now >= start && now <= end) return 'in_progress';
          if (now > end) return 'completed';
        }
        return 'published';
      }
      return backendStatus;
    };

    if (statusFilter) {
      filtered = filtered.filter(
        (event) => computeStatus(event) === statusFilter
      );
    }

    if (teamFilter) {
      filtered = filtered.filter((event) => event?.team?._id === teamFilter);
    }

    setFilteredEvents(filtered);
  }, [events, searchTerm, statusFilter, teamFilter]);

  const handleDeleteEvent = async (eventId) => {
    if (window.confirm('Are you sure you want to delete this worship event?')) {
      try {
        await dispatch(deleteEvent(eventId)).unwrap();
      } catch (err) {
        console.error('Error deleting event:', err);
      }
    }
  };

  const handleQuickConfirmEvent = async (e, eventId) => {
    e.stopPropagation();
    try {
      await api.put(`/events/${eventId}`, {
        event: { status: 'published' },
      });
      dispatch(fetchEvents());
    } catch (err) {
      console.error('Failed to confirm event:', err);
    }
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      time: date.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      }),
    };
  };

  // Split into confirmed/scheduled events and drafts/unconfirmed events
  const scheduledEvents = filteredEvents.filter(
    (e) => (e.event?.status || 'draft') !== 'draft'
  );
  const draftEvents = filteredEvents.filter(
    (e) => (e.event?.status || 'draft') === 'draft'
  );

  const mainColumns = [
    {
      id: 'title',
      label: 'Event Plan',
      render: (row) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              bgcolor: 'rgba(37, 99, 235, 0.08)',
              color: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <EventIcon sx={{ fontSize: 20 }} />
          </Box>
          <Box>
            <Typography variant="body2" fontWeight={600} color="text.primary">
              {getEventTitle(row)}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                maxWidth: 240,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'block',
              }}
            >
              {getEventDescription(row) || 'No description provided'}
            </Typography>
          </Box>
        </Box>
      ),
      sortable: true,
      sortKey: (row) => getEventTitle(row),
    },
    {
      id: 'type',
      label: 'Category',
      render: (row) => (
        <Chip
          label={getEventType(row)}
          size="small"
          sx={{
            textTransform: 'capitalize',
            fontWeight: 600,
            fontSize: '0.75rem',
            bgcolor: 'action.hover',
          }}
        />
      ),
      sortable: true,
      sortKey: (row) => getEventType(row),
    },
    {
      id: 'schedule',
      label: 'Schedule Date & Time',
      render: (row) => {
        const startValue = getScheduleStart(row);
        const endValue = getScheduleEnd(row);
        if (!startValue || !endValue) {
          return (
            <Typography variant="caption" color="text.secondary">
              Not scheduled
            </Typography>
          );
        }
        const start = formatDateTime(startValue);
        const end = formatDateTime(endValue);
        return (
          <Box>
            <Typography variant="body2" fontWeight={600}>
              {start.date}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {start.time} – {end.time}
            </Typography>
          </Box>
        );
      },
      sortable: true,
      sortKey: (row) => new Date(getScheduleStart(row) || 0),
    },
    {
      id: 'setlist',
      label: 'Setlist Songs',
      render: (row) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
          <QueueMusicIcon sx={{ fontSize: 16, color: '#f59e0b' }} />
          <Typography variant="body2" fontWeight={600}>
            {row.setlist?.length || 0} Songs
          </Typography>
        </Box>
      ),
      sortable: true,
      sortKey: (row) => row.setlist?.length || 0,
    },
    {
      id: 'status',
      label: 'Status',
      render: (row) => {
        const backendStatus = row.event?.status || 'draft';
        const start = getScheduleStart(row) ? new Date(getScheduleStart(row)) : null;
        const end = getScheduleEnd(row) ? new Date(getScheduleEnd(row)) : null;
        const now = new Date();

        let display = backendStatus;
        if (backendStatus === 'draft') {
          display = 'draft';
        } else if (backendStatus === 'published') {
          if (start && end) {
            if (now < start) display = 'published';
            else if (now >= start && now <= end) display = 'in_progress';
            else if (now > end) display = 'completed';
          } else {
            display = 'published';
          }
        }

        const label =
          display === 'published'
            ? 'Confirmed'
            : display.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

        return (
          <Chip
            label={label}
            size="small"
            color={statusColors[display] || 'default'}
            sx={{ fontWeight: 600, fontSize: '0.75rem' }}
          />
        );
      },
      sortable: true,
      sortKey: (row) => row.event?.status || 'draft',
    },
    {
      id: 'actions',
      label: 'Actions',
      render: (row) => (
        <Box display="flex" gap={0.5} onClick={(e) => e.stopPropagation()}>
          <Tooltip title="Edit Event Details">
            <IconButton
              component={Link}
              to={`/events/${row._id}/edit`}
              size="small"
              sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete Event">
            <IconButton
              onClick={() => handleDeleteEvent(row._id)}
              size="small"
              sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  const draftColumns = [
    {
      id: 'title',
      label: 'Draft Event Plan',
      render: (row) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              bgcolor: 'rgba(245, 158, 11, 0.1)',
              color: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <EditNoteIcon sx={{ fontSize: 20 }} />
          </Box>
          <Box>
            <Typography variant="body2" fontWeight={600} color="text.primary">
              {getEventTitle(row)}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                maxWidth: 240,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'block',
              }}
            >
              {getEventDescription(row) || 'Draft proposal / Unconfirmed'}
            </Typography>
          </Box>
        </Box>
      ),
      sortable: true,
      sortKey: (row) => getEventTitle(row),
    },
    {
      id: 'type',
      label: 'Category',
      render: (row) => (
        <Chip
          label={getEventType(row)}
          size="small"
          sx={{
            textTransform: 'capitalize',
            fontWeight: 600,
            fontSize: '0.75rem',
            bgcolor: 'action.hover',
          }}
        />
      ),
      sortable: true,
      sortKey: (row) => getEventType(row),
    },
    {
      id: 'schedule',
      label: 'Proposed Date & Time',
      render: (row) => {
        const startValue = getScheduleStart(row);
        const endValue = getScheduleEnd(row);
        if (!startValue || !endValue) {
          return (
            <Typography variant="caption" color="text.secondary">
              Not scheduled
            </Typography>
          );
        }
        const start = formatDateTime(startValue);
        const end = formatDateTime(endValue);
        return (
          <Box>
            <Typography variant="body2" fontWeight={600}>
              {start.date}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {start.time} – {end.time}
            </Typography>
          </Box>
        );
      },
      sortable: true,
      sortKey: (row) => new Date(getScheduleStart(row) || 0),
    },
    {
      id: 'setlist',
      label: 'Setlist Songs',
      render: (row) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
          <QueueMusicIcon sx={{ fontSize: 16, color: '#f59e0b' }} />
          <Typography variant="body2" fontWeight={600}>
            {row.setlist?.length || 0} Songs
          </Typography>
        </Box>
      ),
      sortable: true,
      sortKey: (row) => row.setlist?.length || 0,
    },
    {
      id: 'status',
      label: 'Status',
      render: () => (
        <Chip
          label="Draft (Unconfirmed)"
          size="small"
          sx={{
            fontWeight: 600,
            fontSize: '0.75rem',
            bgcolor: 'rgba(245, 158, 11, 0.1)',
            color: '#d97706',
            border: '1px solid rgba(245, 158, 11, 0.25)',
          }}
        />
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      render: (row) => (
        <Box display="flex" alignItems="center" gap={1} onClick={(e) => e.stopPropagation()}>
          {isAdminOrSubAdmin && (
            <Button
              size="small"
              variant="contained"
              color="primary"
              startIcon={<CheckCircleIcon sx={{ fontSize: 15 }} />}
              onClick={(e) => handleQuickConfirmEvent(e, row._id)}
              sx={{
                fontSize: '0.75rem',
                textTransform: 'none',
                height: 28,
                borderRadius: 1.5,
                fontWeight: 600,
                px: 1.25,
                whiteSpace: 'nowrap',
              }}
            >
              Confirm
            </Button>
          )}
          <Tooltip title="Edit Event Details">
            <IconButton
              component={Link}
              to={`/events/${row._id}/edit`}
              size="small"
              sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete Event">
            <IconButton
              onClick={() => handleDeleteEvent(row._id)}
              size="small"
              sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <Box className="fade-in" sx={{ pb: 6 }}>
      {/* Header Banner */}
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h4" fontWeight={700} sx={{ letterSpacing: '-0.02em' }}>
            Events Calendar
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Coordinate services, rehearsals, worship rosters, and setlists.
          </Typography>
        </Box>

        <Button
          variant="contained"
          component={Link}
          to="/events/new"
          startIcon={<AddIcon />}
          sx={{ borderRadius: 2 }}
        >
          New Event Plan
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {typeof error === 'object' ? error.message || JSON.stringify(error) : error}
        </Alert>
      )}

      {/* Filters Toolbar */}
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          mb: 3,
          borderRadius: 2.5,
          bgcolor: 'background.paper',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', flex: 1 }}>
          <TextField
            placeholder="Search event title or notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: { xs: '100%', sm: 260 } }}
            size="small"
          />

          <FormControl sx={{ minWidth: 140 }} size="small">
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="">All Statuses</MenuItem>
              <MenuItem value="draft">Drafts / Unconfirmed</MenuItem>
              <MenuItem value="published">Confirmed</MenuItem>
              <MenuItem value="in_progress">In Progress</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 140 }} size="small">
            <InputLabel>Team</InputLabel>
            <Select
              value={teamFilter}
              label="Team"
              onChange={(e) => setTeamFilter(e.target.value)}
            >
              <MenuItem value="">All Teams</MenuItem>
              {teams.map((team) => (
                <MenuItem key={team._id} value={team._id}>
                  {team.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {(searchTerm || statusFilter || teamFilter) && (
            <Button
              size="small"
              variant="text"
              startIcon={<ClearIcon />}
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('');
                setTeamFilter('');
              }}
              sx={{ color: 'text.secondary' }}
            >
              Reset
            </Button>
          )}
        </Box>

        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          Showing {filteredEvents.length} of {events.length} events
        </Typography>
      </Paper>

      {/* 1. Main Confirmed & Active Events Table */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <EventIcon color="primary" />
            <Typography variant="h6" fontWeight={700}>
              Confirmed & Scheduled Events
            </Typography>
            <Chip
              label={`${scheduledEvents.length} Active`}
              size="small"
              color="primary"
              variant="outlined"
              sx={{ fontWeight: 600, height: 22, fontSize: '0.75rem' }}
            />
          </Stack>
        </Box>

        <DataTable
          columns={mainColumns}
          data={scheduledEvents}
          actions={false}
          onRowClick={(row) => navigate(`/events/${row._id}`)}
          emptyMessage={
            <Box textAlign="center" py={4}>
              <Typography variant="body2" color="text.secondary">
                No confirmed events match your filter.
              </Typography>
            </Box>
          }
        />
      </Box>

      {/* 2. Drafts & Unconfirmed Events Table */}
      <Box sx={{ mt: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <HourglassEmptyIcon sx={{ color: '#d97706' }} />
            <Typography variant="h6" fontWeight={700}>
              Drafts / Unconfirmed Events
            </Typography>
            <Chip
              label={`${draftEvents.length} Pending`}
              size="small"
              sx={{
                fontWeight: 600,
                height: 22,
                fontSize: '0.75rem',
                bgcolor: 'rgba(245, 158, 11, 0.1)',
                color: '#d97706',
                border: '1px solid rgba(245, 158, 11, 0.3)',
              }}
            />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {isAdminOrSubAdmin
              ? 'Review and click Confirm to publish events for church members.'
              : 'Events created by team members awaiting admin confirmation.'}
          </Typography>
        </Box>

        <DataTable
          columns={draftColumns}
          data={draftEvents}
          actions={false}
          onRowClick={(row) => navigate(`/events/${row._id}`)}
          emptyMessage={
            <Box textAlign="center" py={4}>
              <Typography variant="body2" color="text.secondary">
                No draft or unconfirmed events at this time.
              </Typography>
            </Box>
          }
        />
      </Box>
    </Box>
  );
}

export default EventsList;
