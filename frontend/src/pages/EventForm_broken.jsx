import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
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
  Description as DescriptionIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  createEvent,
  updateEvent,
  fetchEventById,
} from '../store/slices/eventSlice';
import { fetchTeams } from '../store/slices/teamSlice';
import LoadingSpinner from '../components/common/LoadingSpinner';

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
];

function EventForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { currentEvent, loading, error } = useSelector((state) => state.events);
  const { teams, loading: teamsLoading } = useSelector((state) => state.teams);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'service',
    start: new Date(),
    end: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours later
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
      setFormData({
        title: currentEvent.event?.title || '',
        description: currentEvent.event?.description || '',
        type: currentEvent.event?.type || 'service',
        start: new Date(currentEvent.schedule?.start || Date.now()),
        end: new Date(
          currentEvent.schedule?.end || Date.now() + 2 * 60 * 60 * 1000
        ),
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

    if (!formData.teamId) {
      errors.teamId = 'Please select a team';
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

  const handleDateTimeChange = (field) => (newValue) => {
    setFormData((prev) => ({ ...prev, [field]: newValue }));
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitLoading(true);

    try {
      const eventData = {
        event: {
          title: formData.title,
          description: formData.description,
          type: formData.type,
        },
        schedule: {
          start: formData.start.toISOString(),
          end: formData.end.toISOString(),
          timezone: formData.timezone,
        },
        team: formData.teamId,
      };

      if (isEdit) {
        await dispatch(updateEvent({ id, eventData })).unwrap();
      } else {
        await dispatch(createEvent(eventData)).unwrap();
      }

      navigate('/events');
    } catch (error) {
      console.error('Error saving event:', error);
      setFormErrors({ submit: 'Failed to save event. Please try again.' });
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
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        {/* Header */}
        <Box display="flex" alignItems="center" gap={2} mb={3}>
          <IconButton onClick={handleCancel} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Typography
              variant="h4"
              component="h1"
              sx={{ fontWeight: 700, mb: 1 }}
            >
              {isEdit ? 'Edit Event' : 'Create New Event'}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {isEdit
                ? 'Update event details and schedule'
                : 'Set up a new worship event'}
            </Typography>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
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
                        <InputLabel>Assigned Team</InputLabel>
                        <Select
                          value={formData.teamId}
                          label="Assigned Team"
                          onChange={handleInputChange('teamId')}
                          sx={{ borderRadius: 2 }}
                        >
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

                  <Box
                    sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}
                  >
                    <DateTimePicker
                      label="Start Time"
                      value={formData.start}
                      onChange={handleDateTimeChange('start')}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          error: !!formErrors.start,
                          helperText: formErrors.start,
                          sx: {
                            '& .MuiOutlinedInput-root': { borderRadius: 2 },
                          },
                        },
                      }}
                    />

                    <DateTimePicker
                      label="End Time"
                      value={formData.end}
                      onChange={handleDateTimeChange('end')}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          error: !!formErrors.end,
                          helperText: formErrors.end,
                          sx: {
                            '& .MuiOutlinedInput-root': { borderRadius: 2 },
                          },
                        },
                      }}
                    />

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
                        ? formData.start.toLocaleString()
                        : 'Start Time'}{' '}
                      -{' '}
                      {formData.end
                        ? formData.end.toLocaleString()
                        : 'End Time'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formData.description ||
                        'Event description will appear here...'}
                    </Typography>
                  </Paper>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

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
                  {formErrors.submit}
                </Alert>
              )}
            </CardContent>
          </Card>
        </form>
      </Box>
    </LocalizationProvider>
  );
}

export default EventForm;
