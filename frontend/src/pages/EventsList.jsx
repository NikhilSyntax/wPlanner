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
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Event as EventIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import { TextField } from '@mui/material';
import { fetchEvents, deleteEvent } from '../store/slices/eventSlice';
import { fetchTeams } from '../store/slices/teamSlice';
import DataTable from '../components/common/DataTable';
import LoadingSpinner from '../components/common/LoadingSpinner';

const statusColors = {
  draft: 'default',
  published: 'info',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'error',
};

const eventTypeColors = {
  service: 'primary',
  rehearsal: 'secondary',
  meeting: 'info',
  special: 'warning',
  other: 'default',
};

const getEventInfo = (row) => row?.event || {};
const getEventTitle = (row) => getEventInfo(row).title || 'Untitled event';
const getEventDescription = (row) => getEventInfo(row).description || '';
const getEventType = (row) => getEventInfo(row).type || 'other';
const getSchedule = (row) => row?.schedule || {};
const getScheduleStart = (row) => getSchedule(row).start || null;
const getScheduleEnd = (row) => getSchedule(row).end || null;

function EventsList() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { events, loading, error } = useSelector((state) => state.events);
  const { teams } = useSelector((state) => state.teams);

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

    // Search filter
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

    // Status filter (use computed display status)
    const computeStatus = (row) => {
      const backendStatus = row.event?.status || 'draft';
      const start = getScheduleStart(row)
        ? new Date(getScheduleStart(row))
        : null;
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

    // Team filter
    if (teamFilter) {
      filtered = filtered.filter((event) => event?.team?._id === teamFilter);
    }

    setFilteredEvents(filtered);
  }, [events, searchTerm, statusFilter, teamFilter]);

  const handleDeleteEvent = async (eventId) => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      try {
        await dispatch(deleteEvent(eventId)).unwrap();
      } catch (error) {
        console.error('Error deleting event:', error);
      }
    }
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
  };

  const columns = [
    {
      id: 'title',
      label: 'Event',
      render: (row) => (
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
            {getEventTitle(row)}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              maxWidth: 300,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {getEventDescription(row)}
          </Typography>
        </Box>
      ),
      sortable: true,
      sortKey: (row) => getEventTitle(row),
    },
    {
      id: 'type',
      label: 'Type',
      render: (row) => (
        <Chip
          label={
            getEventType(row).charAt(0).toUpperCase() +
            getEventType(row).slice(1)
          }
          size="small"
          color={eventTypeColors[getEventType(row)] || 'default'}
          variant="outlined"
        />
      ),
      sortable: true,
      sortKey: (row) => getEventType(row),
    },
    {
      id: 'schedule',
      label: 'Schedule',
      render: (row) => {
        const startValue = getScheduleStart(row);
        const endValue = getScheduleEnd(row);
        if (!startValue || !endValue) {
          return (
            <Typography variant="body2" color="text.secondary">
              Not scheduled
            </Typography>
          );
        }
        const start = formatDateTime(startValue);
        const end = formatDateTime(endValue);
        return (
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {start.date}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {start.time} - {end.time}
            </Typography>
          </Box>
        );
      },
      sortable: true,
      sortKey: (row) => new Date(getScheduleStart(row) || 0),
    },
    {
      id: 'team',
      label: 'Team',
      render: (row) => (
        <Box display="flex" alignItems="center" gap={1}>
          <Typography variant="body2">{row.team?.name || 'No Team'}</Typography>
        </Box>
      ),
      sortable: true,
      sortKey: (row) => row.team?.name || '',
    },
    {
      id: 'status',
      label: 'Status',
      render: (row) => {
        // compute status based on backend status and schedule/time
        const backendStatus = row.event?.status || 'draft';
        const start = getScheduleStart(row)
          ? new Date(getScheduleStart(row))
          : null;
        const end = getScheduleEnd(row) ? new Date(getScheduleEnd(row)) : null;
        const now = new Date();

        let display = backendStatus;
        // If draft -> always draft
        if (backendStatus === 'draft') {
          display = 'draft';
        } else if (backendStatus === 'published') {
          if (start && end) {
            if (now < start)
              display = 'published'; // show as confirmed/published before start
            else if (now >= start && now <= end) display = 'in_progress';
            else if (now > end) display = 'completed';
          } else {
            display = 'published';
          }
        } else if (backendStatus === 'in_progress') {
          display = 'in_progress';
        } else if (backendStatus === 'completed') {
          display = 'completed';
        }

        // Label mapping: show 'Confirmed' for published
        const label =
          display === 'published'
            ? 'Confirmed'
            : display
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (c) => c.toUpperCase());

        return (
          <Chip
            label={label}
            size="small"
            color={statusColors[display] || 'default'}
          />
        );
      },
      sortable: true,
      sortKey: (row) => {
        const backendStatus = row.event?.status || 'draft';
        return backendStatus;
      },
    },
    {
      id: 'actions',
      label: 'Actions',
      render: (row) => (
        <Box display="flex" gap={1} onClick={(e) => e.stopPropagation()}>
          <Tooltip title="Edit Event">
            <IconButton
              component={Link}
              to={`/events/${row._id}/edit`}
              size="small"
              color="secondary"
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete Event">
            <IconButton
              onClick={() => handleDeleteEvent(row._id)}
              size="small"
              color="error"
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
    <Box>
      {/* Header */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Box>
          <Typography
            variant="h4"
            component="h1"
            sx={{ fontWeight: 700, mb: 1 }}
          >
            Events
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your worship events and schedules
          </Typography>
        </Box>
        <Button
          variant="contained"
          component={Link}
          to="/events/new"
          startIcon={<AddIcon />}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            px: 3,
            py: 1.5,
          }}
        >
          New Event
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {typeof error === 'object'
            ? error.message || JSON.stringify(error)
            : error}
        </Alert>
      )}

      {/* Filters */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 600,
            mb: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <FilterIcon />
          Filters
        </Typography>

        <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
          <TextField
            placeholder="Search events..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 250 }}
          />

          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="">All Statuses</MenuItem>
              <MenuItem value="draft">Draft</MenuItem>
              <MenuItem value="published">Published</MenuItem>
              <MenuItem value="in_progress">In Progress</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 150 }}>
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
        </Box>
      </Paper>

      {/* Events Table */}
      <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <DataTable
          columns={columns}
          data={filteredEvents}
          actions={false}
          onRowClick={(row) => navigate(`/events/${row._id}`)}
          emptyMessage={
            <Box textAlign="center" py={6}>
              <EventIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No events found
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>
                {searchTerm || statusFilter || teamFilter
                  ? 'Try adjusting your filters to see more events.'
                  : 'Create your first worship event to get started.'}
              </Typography>
              <Button
                variant="contained"
                component={Link}
                to="/events/new"
                startIcon={<AddIcon />}
              >
                Create Event
              </Button>
            </Box>
          }
        />
      </Paper>

      {/* Summary Stats */}
      <Box display="flex" gap={3} mt={3} flexWrap="wrap">
        <Paper sx={{ p: 2, borderRadius: 2, minWidth: 150 }}>
          <Typography variant="h6" color="primary">
            {events.length}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Total Events
          </Typography>
        </Paper>
        <Paper sx={{ p: 2, borderRadius: 2, minWidth: 150 }}>
          <Typography variant="h6" color="success.main">
            {
              events.filter((e) => {
                const backendStatus = e.event?.status || 'draft';
                const start = getScheduleStart(e)
                  ? new Date(getScheduleStart(e))
                  : null;
                const end = getScheduleEnd(e)
                  ? new Date(getScheduleEnd(e))
                  : null;
                const now = new Date();
                if (backendStatus === 'published' && start && end && now > end)
                  return true;
                if (backendStatus === 'completed') return true;
                return false;
              }).length
            }
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Completed
          </Typography>
        </Paper>
        <Paper sx={{ p: 2, borderRadius: 2, minWidth: 150 }}>
          <Typography variant="h6" color="warning.main">
            {
              events.filter((e) => {
                const backendStatus = e.event?.status || 'draft';
                const start = getScheduleStart(e)
                  ? new Date(getScheduleStart(e))
                  : null;
                const end = getScheduleEnd(e)
                  ? new Date(getScheduleEnd(e))
                  : null;
                const now = new Date();
                if (
                  backendStatus === 'published' &&
                  start &&
                  end &&
                  now >= start &&
                  now <= end
                )
                  return true;
                if (backendStatus === 'in_progress') return true;
                return false;
              }).length
            }
          </Typography>
          <Typography variant="body2" color="text.secondary">
            In Progress
          </Typography>
        </Paper>
        <Paper sx={{ p: 2, borderRadius: 2, minWidth: 150 }}>
          <Typography variant="h6" color="info.main">
            {
              events.filter((e) => {
                const start = getScheduleStart(e);
                return start ? new Date(start) > new Date() : false;
              }).length
            }
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Upcoming
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
}

export default EventsList;
