import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Box, Typography, Card, CardContent, Button, Switch, IconButton, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Select, FormControl, InputLabel, Alert, Snackbar, ToggleButton,
  ToggleButtonGroup, Tooltip, Divider, Paper, Skeleton, Fade,
  FormControlLabel, Checkbox, useTheme, useMediaQuery,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  AutoMode as AutoModeIcon,
  Schedule as ScheduleIcon,
  EventRepeat as EventRepeatIcon,
  PlayArrow as PlayArrowIcon,
  Close as CloseIcon,
  CalendarMonth as CalendarIcon,
  AccessTime as TimeIcon,
  Notifications as NotificationsIcon,
  CheckCircle as CheckCircleIcon,
  PauseCircle as PauseCircleIcon,
} from '@mui/icons-material';
import {
  fetchAutoSchedules,
  createAutoSchedule,
  updateAutoSchedule,
  toggleAutoSchedule,
  deleteAutoSchedule,
  runSchedulerNow,
} from '../store/slices/autoScheduleSlice';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const EVENT_TYPES = [
  { value: 'service', label: 'Worship Service' },
  { value: 'rehearsal', label: 'Rehearsal' },
  { value: 'seminar', label: 'Seminar' },
  { value: 'other', label: 'Other' },
];

const OFFSET_OPTIONS = [
  { value: 1, label: '1 day before' },
  { value: 2, label: '2 days before' },
  { value: 3, label: '3 days before' },
  { value: 5, label: '5 days before' },
  { value: 7, label: '7 days before' },
];

const TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'America/New_York', label: 'Eastern' },
  { value: 'America/Chicago', label: 'Central' },
  { value: 'America/Denver', label: 'Mountain' },
  { value: 'America/Los_Angeles', label: 'Pacific' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'UTC', label: 'UTC' },
];

const EMPTY_FORM = {
  name: '',
  description: '',
  frequency: 'weekly',
  dayOfWeek: 0,
  weekOfMonth: 1,
  dayOfMonth: 1,
  startTime: '10:30',
  endTime: '12:00',
  timezone: 'Asia/Kolkata',
  eventType: 'service',
  creationOffsetDays: 3,
  reminders: [
    { offsetDays: 3, enabled: true },
    { offsetDays: 1, enabled: true },
  ],
};

function formatTime12(time24) {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatNextOccurrence(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'N/A';
  const now = new Date();
  const diffDays = Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const formatted = d.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
  if (diffDays === 0) return `Today — ${formatted}`;
  if (diffDays === 1) return `Tomorrow — ${formatted}`;
  if (diffDays < 0) return formatted;
  return `In ${diffDays} days — ${formatted}`;
}

// ─── Schedule Card Component ───────────────────────────────────────────────

function ScheduleCard({ schedule, onEdit, onToggle, onDelete, canManage }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isActive = schedule.isActive;
  const freqLabel = schedule.frequency === 'weekly'
    ? `Every ${DAY_NAMES[schedule.dayOfWeek]}`
    : schedule.weekOfMonth
      ? `${['1st', '2nd', '3rd', '4th', 'Last'][schedule.weekOfMonth - 1]} ${DAY_NAMES[schedule.dayOfWeek]} of every month`
      : `${schedule.dayOfMonth}${['th', 'st', 'nd', 'rd'][(schedule.dayOfMonth % 100 > 10 && schedule.dayOfMonth % 100 < 14) ? 0 : Math.min(schedule.dayOfMonth % 10, 4)] || 'th'} of every month`;

  const remindersLabel = (schedule.reminders || [])
    .filter((r) => r.enabled)
    .map((r) => `${r.offsetDays}d`)
    .join(' + ');

  return (
    <Card
      sx={{
        borderRadius: 3,
        transition: 'all 0.2s ease',
        opacity: isActive ? 1 : 0.6,
        border: isActive
          ? `1px solid ${isDark ? 'rgba(37, 99, 235, 0.2)' : 'rgba(37, 99, 235, 0.15)'}`
          : undefined,
        '&:hover': {
          transform: 'translateY(-1px)',
        },
      }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } } }}>
        {/* Header Row */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
            <Box
              sx={{
                width: 40, height: 40, borderRadius: 2, display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                background: isActive
                  ? 'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)'
                  : 'action.disabledBackground',
                bgcolor: isActive ? undefined : 'action.hover',
                boxShadow: isActive ? '0 4px 12px rgba(37, 99, 235, 0.3)' : 'none',
              }}
            >
              <EventRepeatIcon sx={{ fontSize: 20, color: isActive ? '#fff' : 'text.disabled' }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {schedule.name}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, fontSize: '0.8rem' }}>
                {freqLabel} · {formatTime12(schedule.startTime)} – {formatTime12(schedule.endTime)}
              </Typography>
            </Box>
          </Box>
          {canManage && (
            <Switch
              checked={isActive}
              onChange={() => onToggle(schedule._id)}
              size="small"
              color="primary"
            />
          )}
        </Box>

        {/* Info Chips */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8, mb: 1.5 }}>
          <Chip
            icon={<CalendarIcon sx={{ fontSize: '14px !important' }} />}
            label={`Creates ${schedule.creationOffsetDays}d before`}
            size="small"
            sx={{
              height: 24, fontSize: '0.75rem', fontWeight: 600,
              bgcolor: isDark ? 'rgba(37, 99, 235, 0.12)' : 'rgba(37, 99, 235, 0.08)',
              color: 'primary.main',
              '& .MuiChip-icon': { color: 'primary.main' },
            }}
          />
          {remindersLabel && (
            <Chip
              icon={<NotificationsIcon sx={{ fontSize: '14px !important' }} />}
              label={`Reminders: ${remindersLabel} before`}
              size="small"
              sx={{
                height: 24, fontSize: '0.75rem', fontWeight: 600,
                bgcolor: isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.08)',
                color: 'warning.main',
                '& .MuiChip-icon': { color: 'warning.main' },
              }}
            />
          )}
          <Chip
            icon={isActive ? <CheckCircleIcon sx={{ fontSize: '14px !important' }} /> : <PauseCircleIcon sx={{ fontSize: '14px !important' }} />}
            label={isActive ? 'Active' : 'Disabled'}
            size="small"
            color={isActive ? 'success' : 'error'}
            variant="outlined"
            sx={{ height: 24, fontSize: '0.75rem', fontWeight: 700 }}
          />
        </Box>

        {/* Next Occurrence */}
        {isActive && schedule.nextOccurrence && (
          <Box
            sx={{
              p: 1.2, borderRadius: 2, mb: 1.5,
              bgcolor: isDark ? 'rgba(37, 99, 235, 0.06)' : 'rgba(37, 99, 235, 0.04)',
              border: `1px solid ${isDark ? 'rgba(37, 99, 235, 0.1)' : 'rgba(37, 99, 235, 0.08)'}`,
            }}
          >
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Next Event
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600, mt: 0.3 }}>
              {formatNextOccurrence(schedule.nextOccurrence)}
            </Typography>
          </Box>
        )}

        {/* Actions */}
        {canManage && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button
              size="small"
              startIcon={<EditIcon sx={{ fontSize: '16px !important' }} />}
              onClick={() => onEdit(schedule)}
              sx={{
                fontSize: '0.8rem', fontWeight: 600, color: 'text.secondary',
                textTransform: 'none', borderRadius: 2,
                '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
              }}
            >
              Edit
            </Button>
            <Button
              size="small"
              startIcon={<DeleteIcon sx={{ fontSize: '16px !important' }} />}
              onClick={() => onDelete(schedule._id)}
              color="error"
              sx={{
                fontSize: '0.8rem', fontWeight: 600,
                textTransform: 'none', borderRadius: 2,
              }}
            >
              Delete
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page Component ───────────────────────────────────────────────────

export default function AutoEventScheduler() {
  const dispatch = useDispatch();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { schedules, loading, error } = useSelector((s) => s.autoSchedules);
  const user = useSelector((s) => s.auth.user);

  const canManage = user?.isAdmin || user?.isSubAdmin
    || ['Worship Leader', 'worship leader', 'worship_leader'].includes(user?.role);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formError, setFormError] = useState('');
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    dispatch(fetchAutoSchedules());
  }, [dispatch]);

  // ─── Form Handlers ────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setFormError('');
    setDialogOpen(true);
  };

  const openEdit = (schedule) => {
    setEditingId(schedule._id);
    setForm({
      name: schedule.name || '',
      description: schedule.description || '',
      frequency: schedule.frequency || 'weekly',
      dayOfWeek: schedule.dayOfWeek ?? 0,
      weekOfMonth: schedule.weekOfMonth ?? 1,
      dayOfMonth: schedule.dayOfMonth ?? 1,
      startTime: schedule.startTime || '10:30',
      endTime: schedule.endTime || '12:00',
      timezone: schedule.timezone || 'Asia/Kolkata',
      eventType: schedule.eventType || 'service',
      creationOffsetDays: schedule.creationOffsetDays ?? 3,
      reminders: schedule.reminders?.length
        ? schedule.reminders.map((r) => ({ ...r }))
        : [{ offsetDays: 3, enabled: true }, { offsetDays: 1, enabled: true }],
    });
    setFormError('');
    setDialogOpen(true);
  };

  const validateForm = () => {
    if (!form.name.trim()) return 'Event name is required';
    if (!form.startTime || !form.endTime) return 'Start and end time are required';
    if (form.startTime >= form.endTime) return 'End time must be after start time';
    if (form.frequency === 'weekly' && (form.dayOfWeek < 0 || form.dayOfWeek > 6)) return 'Select a day of the week';
    return '';
  };

  const handleSubmit = async () => {
    const err = validateForm();
    if (err) {
      setFormError(err);
      return;
    }
    setFormError('');

    try {
      if (editingId) {
        await dispatch(updateAutoSchedule({ id: editingId, data: form })).unwrap();
        setSnack({ open: true, message: 'Schedule updated successfully!', severity: 'success' });
      } else {
        await dispatch(createAutoSchedule(form)).unwrap();
        setSnack({ open: true, message: 'Schedule created successfully!', severity: 'success' });
      }
      setDialogOpen(false);
    } catch (e) {
      setFormError(typeof e === 'string' ? e : e?.message || 'Failed to save schedule');
    }
  };

  const handleToggle = async (id) => {
    try {
      await dispatch(toggleAutoSchedule(id)).unwrap();
    } catch (e) {
      setSnack({ open: true, message: 'Failed to toggle schedule', severity: 'error' });
    }
  };

  const handleDelete = async (id) => {
    try {
      await dispatch(deleteAutoSchedule(id)).unwrap();
      setSnack({ open: true, message: 'Schedule deleted', severity: 'success' });
      setDeleteConfirm(null);
    } catch (e) {
      setSnack({ open: true, message: 'Failed to delete schedule', severity: 'error' });
    }
  };

  const handleRunNow = async () => {
    try {
      await dispatch(runSchedulerNow()).unwrap();
      setSnack({ open: true, message: 'Scheduler executed — check your events!', severity: 'success' });
      dispatch(fetchAutoSchedules());
    } catch (e) {
      setSnack({ open: true, message: 'Scheduler execution failed', severity: 'error' });
    }
  };

  const handleReminderToggle = (idx) => {
    const updated = [...form.reminders];
    updated[idx] = { ...updated[idx], enabled: !updated[idx].enabled };
    setForm({ ...form, reminders: updated });
  };

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 3 } }}>
      {/* Page Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 44, height: 44, borderRadius: 2.5, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)',
              boxShadow: '0 4px 16px rgba(37, 99, 235, 0.35)',
            }}
          >
            <AutoModeIcon sx={{ color: '#fff', fontSize: 24 }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', lineHeight: 1.2 }}>
              Auto Event Scheduler
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.8rem', fontWeight: 500 }}>
              Recurring services are created automatically
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          {canManage && user?.isAdmin && (
            <Tooltip title="Manually trigger the scheduler for testing">
              <Button
                variant="outlined"
                size="small"
                startIcon={<PlayArrowIcon />}
                onClick={handleRunNow}
                disabled={loading}
                sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
              >
                Run Now
              </Button>
            </Tooltip>
          )}
          {canManage && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={openCreate}
              sx={{
                textTransform: 'none', fontWeight: 700, borderRadius: 2,
              }}
            >
              Add Schedule
            </Button>
          )}
        </Box>
      </Box>

      {/* Error Banner */}
      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => dispatch({ type: 'autoSchedules/clearError' })}>
          {typeof error === 'string' ? error : 'An error occurred'}
        </Alert>
      )}

      {/* Loading Skeletons */}
      {loading && schedules.length === 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={160} sx={{ borderRadius: 3 }} />
          ))}
        </Box>
      )}

      {/* Empty State */}
      {!loading && schedules.length === 0 && (
        <Paper
          sx={{
            textAlign: 'center', py: 8, px: 3, borderRadius: 3,
            border: `1px dashed ${theme.palette.divider}`,
          }}
        >
          <ScheduleIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" sx={{ color: 'text.secondary', fontWeight: 700, mb: 1 }}>
            No Recurring Schedules Yet
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, maxWidth: 400, mx: 'auto' }}>
            Create a recurring schedule and wPlanner will automatically generate events for your church services — no more manual creation every week.
          </Typography>
          {canManage && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={openCreate}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
            >
              Create Your First Schedule
            </Button>
          )}
        </Paper>
      )}

      {/* Schedule Cards */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {schedules.map((schedule) => (
          <Fade in key={schedule._id} timeout={300}>
            <div>
              <ScheduleCard
                schedule={schedule}
                onEdit={openEdit}
                onToggle={handleToggle}
                onDelete={(id) => setDeleteConfirm(id)}
                canManage={canManage}
              />
            </div>
          </Fade>
        ))}
      </Box>

      {/* ─── Create / Edit Dialog ─────────────────────────────────────────── */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            borderRadius: isMobile ? 0 : 3,
            bgcolor: '#ffffff',
            color: '#0f172a',
            backgroundImage: 'none',
            boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
            border: '1px solid #e2e8f0',
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pb: 1.5,
            pt: 2.5,
            px: 3,
            borderBottom: '1px solid #f1f5f9',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                bgcolor: 'rgba(37, 99, 235, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <EventRepeatIcon sx={{ color: '#2563eb', fontSize: 20 }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a', fontSize: '1.125rem' }}>
              {editingId ? 'Edit Schedule' : 'Create Auto Event'}
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={() => setDialogOpen(false)}
            sx={{
              color: '#64748b',
              '&:hover': { color: '#0f172a', bgcolor: '#f1f5f9' },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 3, px: 3, pb: 1, bgcolor: '#ffffff' }}>
          {formError && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>
              {formError}
            </Alert>
          )}

          {/* Event Name */}
          <TextField
            label="Event Name"
            fullWidth
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Sunday Worship"
            sx={{
              mb: 2.5,
              '& .MuiOutlinedInput-root': {
                bgcolor: '#ffffff',
                color: '#0f172a',
                borderRadius: 2,
                '& fieldset': { borderColor: '#cbd5e1' },
                '&:hover fieldset': { borderColor: '#94a3b8' },
                '&.Mui-focused fieldset': { borderColor: '#2563eb' },
              },
              '& .MuiInputLabel-root': { color: '#475569' },
              '& .MuiInputLabel-root.Mui-focused': { color: '#2563eb' },
            }}
          />

          {/* Description */}
          <TextField
            label="Description (Optional)"
            fullWidth
            multiline
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Weekly worship service"
            sx={{
              mb: 2.5,
              '& .MuiOutlinedInput-root': {
                bgcolor: '#ffffff',
                color: '#0f172a',
                borderRadius: 2,
                '& fieldset': { borderColor: '#cbd5e1' },
                '&:hover fieldset': { borderColor: '#94a3b8' },
                '&.Mui-focused fieldset': { borderColor: '#2563eb' },
              },
              '& .MuiInputLabel-root': { color: '#475569' },
              '& .MuiInputLabel-root.Mui-focused': { color: '#2563eb' },
            }}
          />

          <Divider sx={{ mb: 2.5, borderColor: '#f1f5f9' }} />

          {/* Frequency */}
          <FormControl
            fullWidth
            sx={{
              mb: 2.5,
              '& .MuiOutlinedInput-root': {
                bgcolor: '#ffffff',
                color: '#0f172a',
                borderRadius: 2,
                '& fieldset': { borderColor: '#cbd5e1' },
                '&:hover fieldset': { borderColor: '#94a3b8' },
                '&.Mui-focused fieldset': { borderColor: '#2563eb' },
              },
              '& .MuiInputLabel-root': { color: '#475569' },
              '& .MuiInputLabel-root.Mui-focused': { color: '#2563eb' },
              '& .MuiSelect-icon': { color: '#64748b' },
            }}
          >
            <InputLabel>Repeat</InputLabel>
            <Select
              value={form.frequency}
              label="Repeat"
              onChange={(e) => setForm({ ...form, frequency: e.target.value })}
              MenuProps={{
                PaperProps: {
                  sx: {
                    bgcolor: '#ffffff',
                    color: '#0f172a',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                    border: '1px solid #e2e8f0',
                    '& .MuiMenuItem-root': {
                      fontSize: '0.875rem',
                      color: '#0f172a',
                      '&:hover': { bgcolor: '#f1f5f9' },
                      '&.Mui-selected': { bgcolor: '#e0e7ff', color: '#1d4ed8', fontWeight: 600 },
                    },
                  },
                },
              }}
            >
              <MenuItem value="weekly">Weekly</MenuItem>
              <MenuItem value="monthly">Monthly</MenuItem>
            </Select>
          </FormControl>

          {/* Day Selection */}
          {form.frequency === 'weekly' && (
            <Box sx={{ mb: 2.5 }}>
              <Typography
                variant="caption"
                sx={{
                  color: '#475569',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  mb: 1,
                  display: 'block',
                }}
              >
                Day of Week
              </Typography>
              <ToggleButtonGroup
                value={form.dayOfWeek}
                exclusive
                onChange={(_, val) => { if (val !== null) setForm({ ...form, dayOfWeek: val }); }}
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 0.8,
                  '& .MuiToggleButton-root': {
                    borderRadius: '10px !important',
                    border: '1px solid #cbd5e1 !important',
                    bgcolor: '#f8fafc',
                    color: '#475569',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    px: 1.8,
                    py: 0.8,
                    textTransform: 'none',
                    flex: '1 1 auto',
                    minWidth: 48,
                    transition: 'all 0.15s ease',
                    '&.Mui-selected': {
                      bgcolor: '#2563eb !important',
                      color: '#ffffff !important',
                      borderColor: '#2563eb !important',
                      boxShadow: '0 2px 8px rgba(37, 99, 235, 0.35)',
                      fontWeight: 700,
                    },
                    '&:hover': { bgcolor: '#f1f5f9', borderColor: '#94a3b8' },
                  },
                }}
              >
                {DAY_SHORT.map((day, i) => (
                  <ToggleButton key={i} value={i}>{day}</ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
          )}

          {form.frequency === 'monthly' && (
            <Box sx={{ display: 'flex', gap: 2, mb: 2.5, flexWrap: 'wrap' }}>
              <FormControl
                sx={{
                  flex: 1,
                  minWidth: 140,
                  '& .MuiOutlinedInput-root': {
                    bgcolor: '#ffffff',
                    color: '#0f172a',
                    borderRadius: 2,
                    '& fieldset': { borderColor: '#cbd5e1' },
                    '&:hover fieldset': { borderColor: '#94a3b8' },
                    '&.Mui-focused fieldset': { borderColor: '#2563eb' },
                  },
                  '& .MuiInputLabel-root': { color: '#475569' },
                  '& .MuiInputLabel-root.Mui-focused': { color: '#2563eb' },
                  '& .MuiSelect-icon': { color: '#64748b' },
                }}
              >
                <InputLabel>Week</InputLabel>
                <Select
                  value={form.weekOfMonth}
                  label="Week"
                  onChange={(e) => setForm({ ...form, weekOfMonth: e.target.value })}
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        bgcolor: '#ffffff',
                        color: '#0f172a',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                        border: '1px solid #e2e8f0',
                        '& .MuiMenuItem-root': {
                          fontSize: '0.875rem',
                          color: '#0f172a',
                          '&:hover': { bgcolor: '#f1f5f9' },
                          '&.Mui-selected': { bgcolor: '#e0e7ff', color: '#1d4ed8', fontWeight: 600 },
                        },
                      },
                    },
                  }}
                >
                  <MenuItem value={1}>1st</MenuItem>
                  <MenuItem value={2}>2nd</MenuItem>
                  <MenuItem value={3}>3rd</MenuItem>
                  <MenuItem value={4}>4th</MenuItem>
                  <MenuItem value={5}>Last</MenuItem>
                </Select>
              </FormControl>
              <FormControl
                sx={{
                  flex: 1,
                  minWidth: 140,
                  '& .MuiOutlinedInput-root': {
                    bgcolor: '#ffffff',
                    color: '#0f172a',
                    borderRadius: 2,
                    '& fieldset': { borderColor: '#cbd5e1' },
                    '&:hover fieldset': { borderColor: '#94a3b8' },
                    '&.Mui-focused fieldset': { borderColor: '#2563eb' },
                  },
                  '& .MuiInputLabel-root': { color: '#475569' },
                  '& .MuiInputLabel-root.Mui-focused': { color: '#2563eb' },
                  '& .MuiSelect-icon': { color: '#64748b' },
                }}
              >
                <InputLabel>Day</InputLabel>
                <Select
                  value={form.dayOfWeek}
                  label="Day"
                  onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })}
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        bgcolor: '#ffffff',
                        color: '#0f172a',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                        border: '1px solid #e2e8f0',
                        '& .MuiMenuItem-root': {
                          fontSize: '0.875rem',
                          color: '#0f172a',
                          '&:hover': { bgcolor: '#f1f5f9' },
                          '&.Mui-selected': { bgcolor: '#e0e7ff', color: '#1d4ed8', fontWeight: 600 },
                        },
                      },
                    },
                  }}
                >
                  {DAY_NAMES.map((day, i) => (
                    <MenuItem key={i} value={i}>{day}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          )}

          {/* Time */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2.5 }}>
            <TextField
              label="Start Time"
              type="time"
              fullWidth
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              InputLabelProps={{ shrink: true }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: '#ffffff',
                  color: '#0f172a',
                  borderRadius: 2,
                  '& fieldset': { borderColor: '#cbd5e1' },
                  '&:hover fieldset': { borderColor: '#94a3b8' },
                  '&.Mui-focused fieldset': { borderColor: '#2563eb' },
                },
                '& .MuiInputLabel-root': { color: '#475569' },
                '& .MuiInputLabel-root.Mui-focused': { color: '#2563eb' },
              }}
            />
            <TextField
              label="End Time"
              type="time"
              fullWidth
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              InputLabelProps={{ shrink: true }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: '#ffffff',
                  color: '#0f172a',
                  borderRadius: 2,
                  '& fieldset': { borderColor: '#cbd5e1' },
                  '&:hover fieldset': { borderColor: '#94a3b8' },
                  '&.Mui-focused fieldset': { borderColor: '#2563eb' },
                },
                '& .MuiInputLabel-root': { color: '#475569' },
                '& .MuiInputLabel-root.Mui-focused': { color: '#2563eb' },
              }}
            />
          </Box>

          {/* Event Type + Timezone */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2.5, flexWrap: 'wrap' }}>
            <FormControl
              sx={{
                flex: 1,
                minWidth: 140,
                '& .MuiOutlinedInput-root': {
                  bgcolor: '#ffffff',
                  color: '#0f172a',
                  borderRadius: 2,
                  '& fieldset': { borderColor: '#cbd5e1' },
                  '&:hover fieldset': { borderColor: '#94a3b8' },
                  '&.Mui-focused fieldset': { borderColor: '#2563eb' },
                },
                '& .MuiInputLabel-root': { color: '#475569' },
                '& .MuiInputLabel-root.Mui-focused': { color: '#2563eb' },
                '& .MuiSelect-icon': { color: '#64748b' },
              }}
            >
              <InputLabel>Event Type</InputLabel>
              <Select
                value={form.eventType}
                label="Event Type"
                onChange={(e) => setForm({ ...form, eventType: e.target.value })}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      bgcolor: '#ffffff',
                      color: '#0f172a',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                      border: '1px solid #e2e8f0',
                      '& .MuiMenuItem-root': {
                        fontSize: '0.875rem',
                        color: '#0f172a',
                        '&:hover': { bgcolor: '#f1f5f9' },
                        '&.Mui-selected': { bgcolor: '#e0e7ff', color: '#1d4ed8', fontWeight: 600 },
                      },
                    },
                  },
                }}
              >
                {EVENT_TYPES.map((t) => (
                  <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl
              sx={{
                flex: 1,
                minWidth: 140,
                '& .MuiOutlinedInput-root': {
                  bgcolor: '#ffffff',
                  color: '#0f172a',
                  borderRadius: 2,
                  '& fieldset': { borderColor: '#cbd5e1' },
                  '&:hover fieldset': { borderColor: '#94a3b8' },
                  '&.Mui-focused fieldset': { borderColor: '#2563eb' },
                },
                '& .MuiInputLabel-root': { color: '#475569' },
                '& .MuiInputLabel-root.Mui-focused': { color: '#2563eb' },
                '& .MuiSelect-icon': { color: '#64748b' },
              }}
            >
              <InputLabel>Timezone</InputLabel>
              <Select
                value={form.timezone}
                label="Timezone"
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      bgcolor: '#ffffff',
                      color: '#0f172a',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                      border: '1px solid #e2e8f0',
                      '& .MuiMenuItem-root': {
                        fontSize: '0.875rem',
                        color: '#0f172a',
                        '&:hover': { bgcolor: '#f1f5f9' },
                        '&.Mui-selected': { bgcolor: '#e0e7ff', color: '#1d4ed8', fontWeight: 600 },
                      },
                    },
                  },
                }}
              >
                {TIMEZONES.map((tz) => (
                  <MenuItem key={tz.value} value={tz.value}>{tz.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Divider sx={{ mb: 2.5, borderColor: '#f1f5f9' }} />

          {/* Creation Offset */}
          <FormControl
            fullWidth
            sx={{
              mb: 2.5,
              '& .MuiOutlinedInput-root': {
                bgcolor: '#ffffff',
                color: '#0f172a',
                borderRadius: 2,
                '& fieldset': { borderColor: '#cbd5e1' },
                '&:hover fieldset': { borderColor: '#94a3b8' },
                '&.Mui-focused fieldset': { borderColor: '#2563eb' },
              },
              '& .MuiInputLabel-root': { color: '#475569' },
              '& .MuiInputLabel-root.Mui-focused': { color: '#2563eb' },
              '& .MuiSelect-icon': { color: '#64748b' },
            }}
          >
            <InputLabel>Create Event</InputLabel>
            <Select
              value={form.creationOffsetDays}
              label="Create Event"
              onChange={(e) => setForm({ ...form, creationOffsetDays: e.target.value })}
              MenuProps={{
                PaperProps: {
                  sx: {
                    bgcolor: '#ffffff',
                    color: '#0f172a',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                    border: '1px solid #e2e8f0',
                    '& .MuiMenuItem-root': {
                      fontSize: '0.875rem',
                      color: '#0f172a',
                      '&:hover': { bgcolor: '#f1f5f9' },
                      '&.Mui-selected': { bgcolor: '#e0e7ff', color: '#1d4ed8', fontWeight: 600 },
                    },
                  },
                },
              }}
            >
              {OFFSET_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Reminders */}
          <Box sx={{ mb: 1 }}>
            <Typography
              variant="caption"
              sx={{
                color: '#475569',
                fontWeight: 700,
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                mb: 1,
                display: 'block',
              }}
            >
              Reminders
            </Typography>
            {form.reminders.map((r, idx) => (
              <FormControlLabel
                key={idx}
                control={
                  <Checkbox
                    checked={r.enabled}
                    onChange={() => handleReminderToggle(idx)}
                    sx={{
                      color: '#94a3b8',
                      '&.Mui-checked': { color: '#2563eb' },
                    }}
                  />
                }
                label={`${r.offsetDays} day${r.offsetDays > 1 ? 's' : ''} before`}
                sx={{
                  color: '#1e293b',
                  '& .MuiFormControlLabel-label': { fontSize: '0.875rem', fontWeight: 500 },
                }}
              />
            ))}
          </Box>
        </DialogContent>

        <DialogActions
          sx={{
            px: 3,
            py: 2,
            gap: 1.5,
            bgcolor: '#f8fafc',
            borderTop: '1px solid #f1f5f9',
          }}
        >
          <Button
            onClick={() => setDialogOpen(false)}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              color: '#64748b',
              borderRadius: 2,
              px: 2.5,
              '&:hover': { bgcolor: '#e2e8f0', color: '#0f172a' },
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={loading}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: '#ffffff',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
              px: 3.5,
              py: 1,
              '&:hover': {
                background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)',
              },
            }}
          >
            {editingId ? 'Save Changes' : 'Create Schedule'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Delete Confirmation Dialog ───────────────────────────────────── */}
      <Dialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        PaperProps={{
          sx: {
            borderRadius: 3,
            bgcolor: '#ffffff',
            color: '#0f172a',
            backgroundImage: 'none',
            border: '1px solid #e2e8f0',
            boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: '#0f172a', pt: 2.5, px: 3 }}>
          Delete Schedule?
        </DialogTitle>
        <DialogContent sx={{ px: 3 }}>
          <Typography variant="body2" sx={{ color: '#475569' }}>
            This will permanently delete this recurring schedule. Events that have already been generated will not be affected.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, bgcolor: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
          <Button
            onClick={() => setDeleteConfirm(null)}
            sx={{
              textTransform: 'none',
              color: '#64748b',
              fontWeight: 600,
              '&:hover': { bgcolor: '#e2e8f0', color: '#0f172a' },
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => handleDelete(deleteConfirm)}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: 2,
              px: 2.5,
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Snackbar ─────────────────────────────────────────────────────── */}
      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snack.severity}
          onClose={() => setSnack({ ...snack, open: false })}
          sx={{ borderRadius: 2, fontWeight: 600 }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
