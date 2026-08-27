import React, { useState, useEffect, useMemo } from 'react';
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
        background: isActive
          ? 'linear-gradient(135deg, rgba(37, 99, 235, 0.06) 0%, rgba(6, 182, 212, 0.04) 100%)'
          : 'rgba(255, 255, 255, 0.02)',
        border: `1px solid ${isActive ? 'rgba(37, 99, 235, 0.2)' : 'rgba(255, 255, 255, 0.06)'}`,
        borderRadius: 3,
        transition: 'all 0.2s ease',
        opacity: isActive ? 1 : 0.6,
        '&:hover': {
          border: `1px solid ${isActive ? 'rgba(37, 99, 235, 0.4)' : 'rgba(255, 255, 255, 0.12)'}`,
          transform: 'translateY(-1px)',
          boxShadow: isActive ? '0 8px 24px rgba(37, 99, 235, 0.12)' : 'none',
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
                  : 'rgba(255, 255, 255, 0.06)',
                boxShadow: isActive ? '0 4px 12px rgba(37, 99, 235, 0.3)' : 'none',
              }}
            >
              <EventRepeatIcon sx={{ fontSize: 20, color: isActive ? '#fff' : '#64748b' }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 700, color: '#f8fafc', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {schedule.name}
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 500, fontSize: '0.8rem' }}>
                {freqLabel} · {formatTime12(schedule.startTime)} – {formatTime12(schedule.endTime)}
              </Typography>
            </Box>
          </Box>
          {canManage && (
            <Switch
              checked={isActive}
              onChange={() => onToggle(schedule._id)}
              size="small"
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': { color: '#3b82f6' },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#3b82f6' },
              }}
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
              bgcolor: 'rgba(37, 99, 235, 0.12)', color: '#93c5fd',
              '& .MuiChip-icon': { color: '#93c5fd' },
            }}
          />
          {remindersLabel && (
            <Chip
              icon={<NotificationsIcon sx={{ fontSize: '14px !important' }} />}
              label={`Reminders: ${remindersLabel} before`}
              size="small"
              sx={{
                height: 24, fontSize: '0.75rem', fontWeight: 600,
                bgcolor: 'rgba(245, 158, 11, 0.12)', color: '#fcd34d',
                '& .MuiChip-icon': { color: '#fcd34d' },
              }}
            />
          )}
          <Chip
            icon={isActive ? <CheckCircleIcon sx={{ fontSize: '14px !important' }} /> : <PauseCircleIcon sx={{ fontSize: '14px !important' }} />}
            label={isActive ? 'Active' : 'Disabled'}
            size="small"
            sx={{
              height: 24, fontSize: '0.75rem', fontWeight: 700,
              bgcolor: isActive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              color: isActive ? '#6ee7b7' : '#fca5a5',
              '& .MuiChip-icon': { color: isActive ? '#6ee7b7' : '#fca5a5' },
            }}
          />
        </Box>

        {/* Next Occurrence */}
        {isActive && schedule.nextOccurrence && (
          <Box
            sx={{
              p: 1.2, borderRadius: 2, mb: 1.5,
              bgcolor: 'rgba(37, 99, 235, 0.06)',
              border: '1px solid rgba(37, 99, 235, 0.1)',
            }}
          >
            <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Next Event
            </Typography>
            <Typography variant="body2" sx={{ color: '#e2e8f0', fontWeight: 600, mt: 0.3 }}>
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
                fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8',
                textTransform: 'none', borderRadius: 2,
                '&:hover': { color: '#e2e8f0', bgcolor: 'rgba(255, 255, 255, 0.06)' },
              }}
            >
              Edit
            </Button>
            <Button
              size="small"
              startIcon={<DeleteIcon sx={{ fontSize: '16px !important' }} />}
              onClick={() => onDelete(schedule._id)}
              sx={{
                fontSize: '0.8rem', fontWeight: 600, color: '#ef4444',
                textTransform: 'none', borderRadius: 2,
                '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)' },
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
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#f8fafc', lineHeight: 1.2 }}>
              Auto Event Scheduler
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 500 }}>
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
                sx={{
                  textTransform: 'none', fontWeight: 600, borderRadius: 2,
                  borderColor: 'rgba(255, 255, 255, 0.12)', color: '#94a3b8',
                  '&:hover': { borderColor: '#3b82f6', color: '#3b82f6' },
                }}
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
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
                '&:hover': { background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' },
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
            <Skeleton key={i} variant="rounded" height={160} sx={{ borderRadius: 3, bgcolor: 'rgba(255, 255, 255, 0.04)' }} />
          ))}
        </Box>
      )}

      {/* Empty State */}
      {!loading && schedules.length === 0 && (
        <Paper
          sx={{
            textAlign: 'center', py: 8, px: 3, borderRadius: 3,
            bgcolor: 'rgba(255, 255, 255, 0.02)',
            border: '1px dashed rgba(255, 255, 255, 0.1)',
          }}
        >
          <ScheduleIcon sx={{ fontSize: 56, color: '#334155', mb: 2 }} />
          <Typography variant="h6" sx={{ color: '#94a3b8', fontWeight: 700, mb: 1 }}>
            No Recurring Schedules Yet
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mb: 3, maxWidth: 400, mx: 'auto' }}>
            Create a recurring schedule and wPlanner will automatically generate events for your church services — no more manual creation every week.
          </Typography>
          {canManage && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={openCreate}
              sx={{
                textTransform: 'none', fontWeight: 700, borderRadius: 2,
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
              }}
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
            bgcolor: '#0f172a',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EventRepeatIcon sx={{ color: '#3b82f6' }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {editingId ? 'Edit Schedule' : 'Create Auto Event'}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setDialogOpen(false)} sx={{ color: '#94a3b8' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 2 }}>
          {formError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
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
            sx={{ mb: 2.5 }}
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
            sx={{ mb: 2.5 }}
          />

          <Divider sx={{ mb: 2.5, borderColor: 'rgba(255, 255, 255, 0.06)' }} />

          {/* Frequency */}
          <FormControl fullWidth sx={{ mb: 2.5 }}>
            <InputLabel>Repeat</InputLabel>
            <Select
              value={form.frequency}
              label="Repeat"
              onChange={(e) => setForm({ ...form, frequency: e.target.value })}
            >
              <MenuItem value="weekly">Weekly</MenuItem>
              <MenuItem value="monthly">Monthly</MenuItem>
            </Select>
          </FormControl>

          {/* Day Selection */}
          {form.frequency === 'weekly' && (
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.7rem' }}>
                Day of Week
              </Typography>
              <ToggleButtonGroup
                value={form.dayOfWeek}
                exclusive
                onChange={(_, val) => { if (val !== null) setForm({ ...form, dayOfWeek: val }); }}
                sx={{
                  display: 'flex', flexWrap: 'wrap', gap: 0.5,
                  '& .MuiToggleButton-root': {
                    borderRadius: '12px !important', border: '1px solid rgba(255,255,255,0.1)',
                    color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600,
                    px: 1.5, py: 0.7, textTransform: 'none', flex: '1 1 auto', minWidth: 48,
                    '&.Mui-selected': {
                      bgcolor: 'rgba(37, 99, 235, 0.2)', color: '#60a5fa',
                      border: '1px solid rgba(37, 99, 235, 0.5)',
                      '&:hover': { bgcolor: 'rgba(37, 99, 235, 0.3)' },
                    },
                    '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.04)' },
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
              <FormControl sx={{ flex: 1, minWidth: 140 }}>
                <InputLabel>Week</InputLabel>
                <Select value={form.weekOfMonth} label="Week" onChange={(e) => setForm({ ...form, weekOfMonth: e.target.value })}>
                  <MenuItem value={1}>1st</MenuItem>
                  <MenuItem value={2}>2nd</MenuItem>
                  <MenuItem value={3}>3rd</MenuItem>
                  <MenuItem value={4}>4th</MenuItem>
                  <MenuItem value={5}>Last</MenuItem>
                </Select>
              </FormControl>
              <FormControl sx={{ flex: 1, minWidth: 140 }}>
                <InputLabel>Day</InputLabel>
                <Select value={form.dayOfWeek} label="Day" onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })}>
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
            />
            <TextField
              label="End Time"
              type="time"
              fullWidth
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
          </Box>

          {/* Event Type + Timezone */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2.5, flexWrap: 'wrap' }}>
            <FormControl sx={{ flex: 1, minWidth: 140 }}>
              <InputLabel>Event Type</InputLabel>
              <Select value={form.eventType} label="Event Type" onChange={(e) => setForm({ ...form, eventType: e.target.value })}>
                {EVENT_TYPES.map((t) => (
                  <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl sx={{ flex: 1, minWidth: 140 }}>
              <InputLabel>Timezone</InputLabel>
              <Select value={form.timezone} label="Timezone" onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
                {TIMEZONES.map((tz) => (
                  <MenuItem key={tz.value} value={tz.value}>{tz.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Divider sx={{ mb: 2.5, borderColor: 'rgba(255, 255, 255, 0.06)' }} />

          {/* Creation Offset */}
          <FormControl fullWidth sx={{ mb: 2.5 }}>
            <InputLabel>Create Event</InputLabel>
            <Select
              value={form.creationOffsetDays}
              label="Create Event"
              onChange={(e) => setForm({ ...form, creationOffsetDays: e.target.value })}
            >
              {OFFSET_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Reminders */}
          <Box sx={{ mb: 1 }}>
            <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.7rem', mb: 1, display: 'block' }}>
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
                      color: '#64748b',
                      '&.Mui-checked': { color: '#3b82f6' },
                    }}
                  />
                }
                label={`${r.offsetDays} day${r.offsetDays > 1 ? 's' : ''} before`}
                sx={{ color: '#e2e8f0', '& .MuiFormControlLabel-label': { fontSize: '0.875rem' } }}
              />
            ))}
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button
            onClick={() => setDialogOpen(false)}
            sx={{ textTransform: 'none', fontWeight: 600, color: '#94a3b8', borderRadius: 2 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={loading}
            sx={{
              textTransform: 'none', fontWeight: 700, borderRadius: 2,
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
              px: 3,
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
          sx: { borderRadius: 3, bgcolor: '#0f172a', border: '1px solid rgba(255,255,255,0.08)' },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Schedule?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#94a3b8' }}>
            This will permanently delete this recurring schedule. Events that have already been generated will not be affected.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteConfirm(null)} sx={{ textTransform: 'none', color: '#94a3b8' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => handleDelete(deleteConfirm)}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
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
