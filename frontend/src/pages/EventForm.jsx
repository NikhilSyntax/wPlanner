import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { isEventLocked, EVENT_LOCKED_MESSAGE } from '../utils/eventLock';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Grid,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Alert,
  Chip,
  IconButton,
  Divider,
  Paper,
} from '@mui/material';
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  Event as EventIcon,
  Schedule as ScheduleIcon,
  Group as GroupIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import {
  createEvent,
  updateEvent,
  fetchEventById,
} from '../store/slices/eventSlice';
import { fetchTeams } from '../store/slices/teamSlice';
import LoadingSpinner from '../components/common/LoadingSpinner';
import api from '../services/api';

const eventTypes = [
  { value: 'service', label: 'Worship Service', color: 'primary' },
  { value: 'rehearsal', label: 'Rehearsal', color: 'secondary' },
  { value: 'meeting', label: 'Team Meeting', color: 'info' },
  { value: 'special', label: 'Special Event', color: 'warning' },
  { value: 'other', label: 'Other', color: 'default' },
];

const timezones = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern Time' },
  { value: 'America/Chicago', label: 'Central Time' },
  { value: 'America/Denver', label: 'Mountain Time' },
  { value: 'America/Los_Angeles', label: 'Pacific Time' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Paris', label: 'Paris' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'Asia/Kolkata', label: 'India Standard Time (IST)' },
];

function EventForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { currentEvent, loading, error } = useSelector((state) => state.events);
  const { teams, loading: teamsLoading } = useSelector((state) => state.teams);
  const { user } = useSelector((state) => state.auth);
  const isLocked = isEdit && isEventLocked(currentEvent, user);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'service',
    start: '',
    end: '',
    timezone: 'America/New_York',
    teamId: '',
  });

  const [formErrors, setFormErrors] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    dispatch(fetchTeams());
    if (isEdit) {
      dispatch(fetchEventById(id));
    }
  }, [dispatch, id, isEdit]);

  useEffect(() => {
    if (isEdit && currentEvent) {
      const toLocalInput = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const pad = (n) => String(n).padStart(2, '0');
        return (
          d.getFullYear() +
          '-' +
          pad(d.getMonth() + 1) +
          '-' +
          pad(d.getDate()) +
          'T' +
          pad(d.getHours()) +
          ':' +
          pad(d.getMinutes())
        );
      };

      setFormData({
        title: currentEvent.event?.title || '',
        description: currentEvent.event?.description || '',
        type: currentEvent.event?.type || 'service',
        start: toLocalInput(currentEvent.schedule?.start),
        end: toLocalInput(currentEvent.schedule?.end),
        timezone: currentEvent.schedule?.timezone || 'America/New_York',
        teamId: currentEvent.team?._id || currentEvent.team || '',
      });
    }
  }, [currentEvent, isEdit]);

  const validateForm = () => {
    const errors = {};

    if (!formData.title.trim()) {
      errors.title = 'Event title is required';
    }

    if (!formData.description.trim()) {
      errors.description = 'Event description is required';
    }

    if (!formData.start) {
      errors.start = 'Start time is required';
    }

    if (!formData.end) {
      errors.end = 'End time is required';
    }

    if (formData.start && formData.end && formData.start >= formData.end) {
      errors.end = 'End time must be after start time';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (field) => (event) => {
    const value = event.target.value;
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const getDatePart = (datetime) => (datetime ? datetime.slice(0, 10) : '');
  const getTimePart = (datetime) => (datetime ? datetime.slice(11, 16) : '');

  const handleDatePartChange = (which) => (e) => {
    const date = e.target.value; // YYYY-MM-DD
    const time = getTimePart(formData[which]) || '00:00';
    const combined = date ? `${date}T${time}` : '';
    setFormData((prev) => ({ ...prev, [which]: combined }));
    if (formErrors[which]) {
      setFormErrors((prev) => ({ ...prev, [which]: '' }));
    }
  };

  const handleTimePartChange = (which) => (e) => {
    const time = e.target.value; // HH:MM
    const date =
      getDatePart(formData[which]) || new Date().toISOString().slice(0, 10);
    const combined = time ? `${date}T${time}` : '';
    setFormData((prev) => ({ ...prev, [which]: combined }));
    if (formErrors[which]) {
      setFormErrors((prev) => ({ ...prev, [which]: '' }));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isLocked) return;

    if (!validateForm()) {
      return;
    }

    setSubmitLoading(true);
    setFormErrors((prev) => ({ ...prev, submit: '' }));

    try {
      const eventData = {
        event: {
          title: formData.title,
          description: formData.description,
          type: formData.type,
        },
        schedule: {
          start: new Date(formData.start).toISOString(),
          end: new Date(formData.end).toISOString(),
          timezone: formData.timezone,
        },
        ...(formData.teamId ? { team: formData.teamId } : {}),
      };

      if (isEdit) {
        await dispatch(updateEvent({ id, eventData })).unwrap();
        navigate('/events');
      } else {
        const created = await dispatch(createEvent(eventData)).unwrap();
        const newId = created._id || created.id;
        navigate(`/events/${newId}/team`);
      }
    } catch (error) {
      console.error('Error saving event:', error);
      const backendMessage =
        error?.message ||
        (typeof error === 'string'
          ? error
          : 'Failed to save event. Please try again.');
      setFormErrors((prev) => ({ ...prev, submit: backendMessage }));
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/events');
  };

  if (loading || teamsLoading) {
    return <LoadingSpinner />;
  }

  const selectedEventType = eventTypes.find(
    (type) => type.value === formData.type
  );

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {typeof error === 'object'
            ? error.message || JSON.stringify(error)
            : error}
        </Alert>
      )}

      {isLocked && (
        <Alert severity="info" sx={{ mb: 3 }}>
          {EVENT_LOCKED_MESSAGE}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <fieldset
          disabled={isLocked}
          style={{ border: 'none', margin: 0, padding: 0, minWidth: '100%' }}
        >
        <Grid container spacing={3}>
          {/* Basic Information */}
          <Grid item xs={12} lg={8}>
            <Card sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Box display="flex" alignItems="center" gap={2} mb={3}>
                  <EventIcon color="primary" />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Event Details
                  </Typography>
                </Box>

                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Event Title"
                      name="title"
                      value={formData.title}
                      onChange={handleInputChange('title')}
                      error={!!formErrors.title}
                      helperText={formErrors.title}
                      variant="outlined"
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={4}
                      label="Description"
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange('description')}
                      error={!!formErrors.description}
                      helperText={formErrors.description}
                      variant="outlined"
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth error={!!formErrors.type}>
                      <InputLabel>Event Type</InputLabel>
                      <Select
                        value={formData.type}
                        label="Event Type"
                        onChange={handleInputChange('type')}
                        sx={{ borderRadius: 2 }}
                      >
                        {eventTypes.map((type) => (
                          <MenuItem key={type.value} value={type.value}>
                            <Box display="flex" alignItems="center" gap={1}>
                              <Chip
                                label={type.label}
                                size="small"
                                color={type.color}
                                variant="outlined"
                              />
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                      {formErrors.type && (
                        <Typography
                          variant="caption"
                          color="error"
                          sx={{ mt: 1, ml: 2 }}
                        >
                          {formErrors.type}
                        </Typography>
                      )}
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth error={!!formErrors.teamId}>
                      <InputLabel>Assigned Team (Optional)</InputLabel>
                      <Select
                        value={formData.teamId}
                        label="Assigned Team (Optional)"
                        onChange={handleInputChange('teamId')}
                        sx={{ borderRadius: 2 }}
                      >
                        <MenuItem value="">
                          <em>Select a team</em>
                        </MenuItem>
                        {teams.map((team) => (
                          <MenuItem key={team._id} value={team._id}>
                            <Box display="flex" alignItems="center" gap={1}>
                              <GroupIcon fontSize="small" />
                              <Typography>{team.name}</Typography>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                      {formErrors.teamId && (
                        <Typography
                          variant="caption"
                          color="error"
                          sx={{ mt: 1, ml: 2 }}
                        >
                          {formErrors.teamId}
                        </Typography>
                      )}
                    </FormControl>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Schedule Information */}
          <Grid item xs={12} lg={4}>
            <Card sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Box display="flex" alignItems="center" gap={2} mb={3}>
                  <ScheduleIcon color="primary" />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Schedule
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField
                        fullWidth
                        label="Start Date"
                        type="date"
                        value={getDatePart(formData.start)}
                        onChange={handleDatePartChange('start')}
                        error={!!formErrors.start}
                        InputLabelProps={{ shrink: true }}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                      />
                      <TextField
                        sx={{ width: 140 }}
                        label="Start Time"
                        type="time"
                        value={getTimePart(formData.start)}
                        onChange={handleTimePartChange('start')}
                        error={!!formErrors.start}
                        InputLabelProps={{ shrink: true }}
                        inputProps={{ step: 60 }}
                      />
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                      <TextField
                        fullWidth
                        label="End Date"
                        type="date"
                        value={getDatePart(formData.end)}
                        onChange={handleDatePartChange('end')}
                        error={!!formErrors.end}
                        InputLabelProps={{ shrink: true }}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                      />
                      <TextField
                        sx={{ width: 140 }}
                        label="End Time"
                        type="time"
                        value={getTimePart(formData.end)}
                        onChange={handleTimePartChange('end')}
                        error={!!formErrors.end}
                        InputLabelProps={{ shrink: true }}
                        inputProps={{ step: 60 }}
                      />
                    </Box>
                    {formErrors.start && (
                      <Typography
                        variant="caption"
                        color="error"
                        sx={{ mt: 1 }}
                      >
                        {formErrors.start}
                      </Typography>
                    )}
                    {formErrors.end && (
                      <Typography
                        variant="caption"
                        color="error"
                        sx={{ mt: 1 }}
                      >
                        {formErrors.end}
                      </Typography>
                    )}
                  </Box>

                  <FormControl fullWidth error={!!formErrors.timezone}>
                    <InputLabel>Timezone</InputLabel>
                    <Select
                      value={formData.timezone}
                      label="Timezone"
                      onChange={handleInputChange('timezone')}
                      sx={{ borderRadius: 2 }}
                    >
                      {timezones.map((tz) => (
                        <MenuItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </MenuItem>
                      ))}
                    </Select>
                    {formErrors.timezone && (
                      <Typography
                        variant="caption"
                        color="error"
                        sx={{ mt: 1, ml: 2 }}
                      >
                        {formErrors.timezone}
                      </Typography>
                    )}
                  </FormControl>
                </Box>
              </CardContent>
            </Card>

            {/* Event Preview */}
            <Card sx={{ borderRadius: 3, mt: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  Event Preview
                </Typography>
                <Paper
                  sx={{
                    p: 2,
                    bgcolor: 'grey.50',
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'grey.200',
                  }}
                >
                  <Box display="flex" alignItems="center" gap={2} mb={1}>
                    <EventIcon color="primary" />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {formData.title || 'Event Title'}
                    </Typography>
                    {selectedEventType && (
                      <Chip
                        label={selectedEventType.label}
                        size="small"
                        color={selectedEventType.color}
                        variant="outlined"
                      />
                    )}
                  </Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 1 }}
                  >
                    {formData.start
                      ? new Date(formData.start).toLocaleString()
                      : 'Start Time'}{' '}
                    -{' '}
                    {formData.end
                      ? new Date(formData.end).toLocaleString()
                      : 'End Time'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formData.description ||
                      'Event description will appear here...'}
                  </Typography>

                  <Divider sx={{ my: 2 }} />

                  <Box
                    sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
                  >
                    <Box display="flex" alignItems="center" gap={1}>
                      <GroupIcon fontSize="small" color="primary" />
                      <Typography variant="body2">
                        <strong>Team:</strong>{' '}
                        {formData.teamId
                          ? teams.find((t) => t._id === formData.teamId)
                              ?.name || 'Unknown'
                          : 'Not selected'}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Quick Summary */}
        <Card sx={{ borderRadius: 3, mt: 3, bgcolor: 'info.lighter' }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              ✨ Event Setup Summary
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <Paper
                  sx={{
                    p: 2,
                    textAlign: 'center',
                    bgcolor: 'background.paper',
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    Event Type
                  </Typography>
                  <Typography variant="h6" sx={{ mt: 1 }}>
                    {selectedEventType?.label || 'Select type'}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={3}>
                <Paper
                  sx={{
                    p: 2,
                    textAlign: 'center',
                    bgcolor: 'background.paper',
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    Team Assigned
                  </Typography>
                  <Typography variant="h6" sx={{ mt: 1 }}>
                    {formData.teamId
                      ? teams.find((t) => t._id === formData.teamId)?.name ||
                        '...'
                      : 'Optional'}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={3}>
                <Paper
                  sx={{
                    p: 2,
                    textAlign: 'center',
                    bgcolor: 'background.paper',
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    Schedule
                  </Typography>
                  <Typography variant="h6" sx={{ mt: 1 }}>
                    {formData.start && formData.end ? '✓' : 'Required'}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Form Actions */}
        <Card sx={{ borderRadius: 3, mt: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Divider sx={{ mb: 3 }} />
            <Box display="flex" gap={2} justifyContent="flex-end">
              <Button
                variant="outlined"
                onClick={handleCancel}
                startIcon={<CancelIcon />}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  px: 3,
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={submitLoading}
                startIcon={<SaveIcon />}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  px: 3,
                  minWidth: 120,
                }}
              >
                {submitLoading
                  ? 'Saving...'
                  : isEdit
                    ? 'Update Event'
                    : 'Create Event'}
              </Button>
            </Box>

            {formErrors.submit && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {typeof formErrors.submit === 'object'
                  ? formErrors.submit.message ||
                    JSON.stringify(formErrors.submit)
                  : formErrors.submit}
              </Alert>
            )}
          </CardContent>
        </Card>
        </fieldset>
      </form>
    </Box>
  );
}

export default EventForm;
