import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Grid,
  Divider,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Event as EventIcon,
  Schedule as ScheduleIcon,
  Group as GroupIcon,
  Chat as ChatIcon,
  MusicNote as MusicIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  NotificationsActive as NotificationsActiveIcon,
  CheckCircle as CheckCircleIcon,
  AccessTime as AccessTimeIcon,
} from '@mui/icons-material';
import api, { apiUrl } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { getEventDisplayTitle } from '../utils/eventTitle';
import { isEventLocked, EVENT_LOCKED_MESSAGE } from '../utils/eventLock';
import { mergeSetlistWithBank, mergeSongWithBank, songsByIdMap } from '../utils/songDisplay';

const eventTypeColors = {
  service: 'primary',
  rehearsal: 'secondary',
  meeting: 'info',
  special: 'warning',
  other: 'default',
};

const statusColors = {
  draft: 'default',
  published: 'info',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'error',
};

function SongTitleWithTimeSignature({ title, timeSignature, prefix = '' }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap' }}>
      <Typography variant="body2" component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
        {prefix}{title}
      </Typography>
      {timeSignature ? (
        <Chip
          label={timeSignature}
          size="small"
          sx={{
            height: 19,
            fontSize: '0.6875rem',
            fontWeight: 700,
            bgcolor: 'action.hover',
            px: 0.2,
          }}
        />
      ) : null}
    </Box>
  );
}

function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useSelector((state) => state.auth);
  const isFullAdmin = Boolean(
    user?.isAdmin ||
    user?.role === 'admin' ||
    user?.roles?.includes('admin')
  );
  const [event, setEvent] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [songs, setSongs] = useState([]);
  const [songQuery, setSongQuery] = useState('');
  const [newSongTitle, setNewSongTitle] = useState('');
  const [newSongKey, setNewSongKey] = useState('C');
  const [addSongLoading, setAddSongLoading] = useState(false);
  const [addSongError, setAddSongError] = useState('');
  const [setlist, setSetlist] = useState([]);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [reminderMessage, setReminderMessage] = useState('');
  // ----- edit mode for title/description -----
  const [editMode, setEditMode] = useState(false);
  const [titleDraft, setTitleDraft] = useState(event?.title || '');
  const [descDraft, setDescDraft] = useState(event?.description || '');
  const [saveMessage, setSaveMessage] = useState('');

  const addSongTitleInputRef = useRef(null);
  const setlistCardRef = useRef(null);

  useEffect(() => {
    loadPageData(true);
  }, [id]);

  const loadPageData = async (showSpinner = false) => {
    try {
      if (showSpinner) setLoading(true);
      setError('');
      const [eventRes, songsRes] = await Promise.all([
        api.get(`/events/${id}`),
        api.get('/songs'),
      ]);
      const bankSongs = Array.isArray(songsRes.data)
        ? songsRes.data
        : songsRes.data.songs || [];
      setSongs(bankSongs);
      setEvent(eventRes.data);
      if (eventRes.data.assignments) {
        setTeamMembers(eventRes.data.assignments);
      }
      setSetlist(
        mergeSetlistWithBank(eventRes.data.setlist || [], bankSongs)
      );
    } catch (err) {
      console.error(err);
      setError('Failed to load event details');
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  const fetchSongs = async () => {
    try {
      const res = await api.get('/songs');
      const bankSongs = Array.isArray(res.data) ? res.data : res.data.songs || [];
      setSongs(bankSongs);
      setSetlist((prev) => mergeSetlistWithBank(prev, bankSongs));
    } catch (err) {
      console.error('Failed to load songs:', err);
    }
  };

  const fetchEvent = async () => {
    await loadPageData(false);
  };

  // Chat command: /adds -> open Add Song UI on event page
  useEffect(() => {
    const openAdd = searchParams.get('openAddSong') === '1';
    if (!openAdd || loading || !event) return;
    if (isEventLocked(event, user)) return;

    const title = searchParams.get('addSongTitle') || '';
    if (title) {
      setNewSongTitle(title);
    }

    requestAnimationFrame(() => {
      setlistCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      addSongTitleInputRef.current?.focus?.();
    });

    const next = new URLSearchParams(searchParams);
    next.delete('openAddSong');
    next.delete('addSongTitle');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, loading, event, user]);

  const handleDelete = async () => {
    try {
      await api.delete(`/events/${id}`);
      navigate('/events');
    } catch (err) {
      console.error(err);
      setError('Failed to delete event');
    }
    setDeleteDialogOpen(false);
  };

  const updateEventStatus = async (status, successText) => {
    const title = getEventDisplayTitle(event);
    const body = {
      event: {
        status,
        ...(title ? { title } : {}),
      },
    };
    if (status === 'completed' && setlist.length > 0) {
      body.setlist = setlist.map((s) => s._id);
    }
    await api.put(`/events/${id}`, body);
    setSaveMessage({ type: 'success', text: successText });
    setTimeout(() => {
      fetchEvent();
      setSaveMessage('');
    }, 1500);
  };

  const handleConfirmEvent = async () => {
    try {
      await updateEventStatus('published', 'Event confirmed and published!');
    } catch (err) {
      console.error('Failed to confirm event:', err);
      setError('Failed to confirm event');
    }
  };

  const handleUnconfirmEvent = async () => {
    try {
      await updateEventStatus('draft', 'Event unconfirmed and set to draft.');
    } catch (err) {
      console.error('Failed to unconfirm event:', err);
      setError('Failed to unconfirm event');
    }
  };

  const handleMarkCompleted = async () => {
    try {
      await updateEventStatus(
        'completed',
        'Event marked as completed! Song usage updated.',
      );
    } catch (err) {
      console.error('Failed to mark as completed:', err);
      setError('Failed to mark event as completed');
    }
  };

  const handleUndoCompleted = async () => {
    try {
      await updateEventStatus('published', 'Event marked as confirmed again.');
    } catch (err) {
      console.error('Failed to undo completed:', err);
      setError('Failed to undo completed status');
    }
  };

  if (loading) return <LoadingSpinner />;

  if (!event) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Event not found</Alert>
      </Box>
    );
  }

  const eventInfo = event.event || {};
  const scheduleInfo = event.schedule || {};
  const teamInfo = event.team;
  const isLocked = isEventLocked(event, user);
  const canEdit = !isLocked;

  const startDate = new Date(scheduleInfo.start);
  const endDate = new Date(scheduleInfo.end);
  const keyOptions = [
    'C',
    'C#',
    'D',
    'D#',
    'E',
    'F',
    'F#',
    'G',
    'G#',
    'A',
    'A#',
    'B',
  ];
  const filteredSongs = songs.filter((song) => {
    const q = songQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      String(song.title || '')
        .toLowerCase()
        .includes(q) ||
      String(song.artist || '')
        .toLowerCase()
        .includes(q)
    );
  });
  const setlistSongIds = new Set(setlist.map((s) => s._id));
  const songsById = songsByIdMap(songs);
  const setlistKeys = new Set(
    setlist
      .map((s) => s.key)
      .filter((k) => typeof k === 'string' && k.trim().length > 0)
  );
  const recommendedSongs = filteredSongs
    .filter((song) => !setlistSongIds.has(song._id))
    .sort((a, b) => {
      const aMatch = setlistKeys.has(a.key) ? 1 : 0;
      const bMatch = setlistKeys.has(b.key) ? 1 : 0;
      if (aMatch !== bMatch) return bMatch - aMatch;
      return String(a.title || '').localeCompare(String(b.title || ''));
    });

  const handleQuickAddSong = async () => {
    const title = newSongTitle.trim();
    if (!title) {
      setAddSongError('Song title is required');
      return;
    }
    try {
      setAddSongLoading(true);
      setAddSongError('');
      await api.post('/songs', {
        title,
        key: newSongKey,
      });
      setNewSongTitle('');
      setNewSongKey('C');
      await loadPageData(false);
      setSaveMessage({
        type: 'success',
        text: 'Song added to your songs database.',
      });
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      console.error('Failed to add song:', err);
      setAddSongError(
        err?.response?.data?.message || 'Failed to add song. Try again.'
      );
    } finally {
      setAddSongLoading(false);
    }
  };

  const handleMoveSongUp = (idx) => {
    if (idx > 0) {
      const newSetlist = [...setlist];
      [newSetlist[idx], newSetlist[idx - 1]] = [
        newSetlist[idx - 1],
        newSetlist[idx],
      ];
      setSetlist(newSetlist);
    }
  };

  const handleMoveSongDown = (idx) => {
    if (idx < setlist.length - 1) {
      const newSetlist = [...setlist];
      [newSetlist[idx], newSetlist[idx + 1]] = [
        newSetlist[idx + 1],
        newSetlist[idx],
      ];
      setSetlist(newSetlist);
    }
  };

  const handleSongKeyChange = async (songId, newKey) => {
    if (isLocked) return;
    const applyKey = (list) =>
      list.map((s) => (String(s._id) === String(songId) ? { ...s, key: newKey } : s));
    setSetlist((prev) => applyKey(prev));
    setSongs((prev) => applyKey(prev));
    try {
      await api.put(`/songs/${songId}`, { key: newKey });
    } catch (err) {
      console.error('Failed to update song key:', err);
      setSaveMessage({
        type: 'error',
        text: err?.response?.data?.message || 'Failed to update song key.',
      });
      await fetchSongs();
      await fetchEvent();
    }
  };

  const renderKeySelect = (song) =>
    canEdit ? (
      <FormControl size="small" sx={{ minWidth: 85 }}>
        <Select
          value={song.key || 'C'}
          onChange={(e) => handleSongKeyChange(song._id, e.target.value)}
          sx={{
            fontSize: '0.8125rem',
            height: 32,
            borderRadius: 1.5,
            bgcolor: 'background.paper',
            '& .MuiSelect-select': { py: 0.5, px: 1.2 },
          }}
        >
          {keyOptions.map((k) => (
            <MenuItem key={k} value={k} sx={{ fontSize: '0.8125rem' }}>
              Key: {k}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    ) : song.key ? (
      <Chip size="small" label={`Key: ${song.key}`} variant="outlined" sx={{ fontWeight: 600 }} />
    ) : null;

  return (
    <Box sx={{ pb: 4 }}>
      {/* Aesthetic & Ergonomic Header Section */}
      <Paper
        elevation={0}
        sx={{
          mb: 2.5,
          p: { xs: 2, sm: '14px 20px' },
          borderRadius: 3,
          bgcolor: (theme) =>
            theme.palette.mode === 'dark'
              ? 'rgba(30, 41, 59, 0.4)'
              : 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', md: 'center' },
          gap: { xs: 1.75, md: 2 },
        }}
      >
        {/* Left Side: Back Button + Title & Badges & Date */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.75,
            minWidth: 0,
          }}
        >
          <IconButton
            onClick={() => navigate('/events')}
            size="small"
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'action.hover',
              '&:hover': { bgcolor: 'action.selected' },
              flexShrink: 0,
            }}
            title="Back to Events"
          >
            <ArrowBackIcon sx={{ fontSize: 18 }} />
          </IconButton>

          <Box sx={{ minWidth: 0, flex: 1 }}>
            {/* Title & Status Chips Inline Row */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                flexWrap: 'wrap',
              }}
            >
              <Typography
                variant="h5"
                component="h1"
                sx={{
                  fontWeight: 700,
                  fontSize: { xs: '1.25rem', sm: '1.45rem' },
                  letterSpacing: '-0.02em',
                  lineHeight: 1.25,
                }}
              >
                {getEventDisplayTitle(event) || 'Event Details'}
              </Typography>

              {eventInfo.type && (
                <Chip
                  label={
                    eventInfo.type.charAt(0).toUpperCase() +
                    eventInfo.type.slice(1)
                  }
                  size="small"
                  color={eventTypeColors[eventInfo.type] || 'default'}
                  variant="outlined"
                  sx={{
                    fontWeight: 600,
                    fontSize: '0.72rem',
                    height: 22,
                    textTransform: 'capitalize',
                  }}
                />
              )}

              {(() => {
                const backendStatus = eventInfo.status || 'draft';
                const start = scheduleInfo.start
                  ? new Date(scheduleInfo.start)
                  : null;
                const end = scheduleInfo.end ? new Date(scheduleInfo.end) : null;
                const now = new Date();
                let display = backendStatus;
                if (backendStatus === 'draft') display = 'draft';
                else if (backendStatus === 'published') {
                  if (start && end) {
                    if (now < start) display = 'published';
                    else if (now >= start && now <= end) display = 'in_progress';
                    else if (now > end) display = 'completed';
                  } else display = 'published';
                }
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
                    sx={{
                      fontWeight: 600,
                      fontSize: '0.72rem',
                      height: 22,
                    }}
                  />
                );
              })()}
            </Box>

            {/* Event Schedule Subtitle */}
            {scheduleInfo.start && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  mt: 0.5,
                }}
              >
                <AccessTimeIcon
                  sx={{ fontSize: 14, color: 'text.secondary' }}
                />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: '0.8rem', fontWeight: 500 }}
                >
                  {new Date(scheduleInfo.start).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                  {' • '}
                  {new Date(scheduleInfo.start).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                  {scheduleInfo.end && (
                    <>
                      {' - '}
                      {new Date(scheduleInfo.end).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </>
                  )}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* Right Side: Action Buttons */}
        {canEdit && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              flexWrap: 'wrap',
              pt: { xs: 1.5, md: 0 },
              borderTop: { xs: '1px solid', md: 'none' },
              borderColor: { xs: 'divider', md: 'transparent' },
              justifyContent: { xs: 'flex-start', sm: 'flex-start', md: 'flex-end' },
            }}
          >
            {isFullAdmin && (
              <>
                {eventInfo.status === 'draft' && (
                  <Button
                    variant="contained"
                    color="primary"
                    size="small"
                    startIcon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
                    onClick={handleConfirmEvent}
                    sx={{
                      borderRadius: 2,
                      textTransform: 'none',
                      fontWeight: 600,
                      fontSize: '0.8125rem',
                      height: 34,
                      px: 2,
                      boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
                    }}
                  >
                    Confirm Event
                  </Button>
                )}

                {eventInfo.status === 'published' && (
                  <>
                    <Button
                      variant="outlined"
                      color="warning"
                      size="small"
                      onClick={handleUnconfirmEvent}
                      sx={{
                        borderRadius: 2,
                        textTransform: 'none',
                        fontWeight: 600,
                        fontSize: '0.8125rem',
                        height: 34,
                        px: 1.75,
                      }}
                    >
                      Unconfirm Event
                    </Button>
                    <Button
                      variant="contained"
                      color="success"
                      size="small"
                      startIcon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
                      onClick={handleMarkCompleted}
                      sx={{
                        borderRadius: 2,
                        textTransform: 'none',
                        fontWeight: 600,
                        fontSize: '0.8125rem',
                        height: 34,
                        px: 2,
                        boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
                      }}
                    >
                      Mark Completed
                    </Button>
                  </>
                )}

                {eventInfo.status === 'completed' && (
                  <Button
                    variant="outlined"
                    color="warning"
                    size="small"
                    onClick={handleUndoCompleted}
                    sx={{
                      borderRadius: 2,
                      textTransform: 'none',
                      fontWeight: 600,
                      fontSize: '0.8125rem',
                      height: 34,
                      px: 2,
                    }}
                  >
                    Undo Completed
                  </Button>
                )}
              </>
            )}

            <Button
              variant="outlined"
              color="error"
              size="small"
              onClick={() => setDeleteDialogOpen(true)}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.8125rem',
                height: 34,
                px: 2,
              }}
            >
              Delete
            </Button>
          </Box>
        )}
      </Paper>

      {isLocked && (
        <Alert severity="info" sx={{ mb: 3 }}>
          {EVENT_LOCKED_MESSAGE}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Main Content */}
        <Grid item xs={12} lg={8}>
          {/* Event Description (Compact) */}
          <Card sx={{ borderRadius: 2.5, mb: 2.5 }}>
            <CardContent
              sx={{
                p: '12px 16px !important',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1.5,
              }}
            >
              <EventIcon color="primary" sx={{ fontSize: 20, mt: 0.2, flexShrink: 0 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  fontWeight={700}
                  textTransform="uppercase"
                  letterSpacing="0.04em"
                  sx={{ display: 'block', mb: 0.25, fontSize: '0.7rem' }}
                >
                  Description
                </Typography>
                <Typography
                  variant="body2"
                  color="text.primary"
                  sx={{ lineHeight: 1.5, fontSize: '0.875rem' }}
                >
                  {eventInfo.description || 'No description provided.'}
                </Typography>
              </Box>
            </CardContent>
          </Card>

          {/* Songs / Setlist */}
          <Card ref={setlistCardRef} sx={{ borderRadius: 3, mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                gap={2}
                mb={2.5}
                flexWrap="wrap"
              >
                <Box display="flex" alignItems="center" gap={2}>
                  <MusicIcon color="primary" />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Songs & Setlist
                  </Typography>
                </Box>
              </Box>

              {saveMessage && (
                <Alert
                  severity={
                    saveMessage.type === 'success' ? 'success' : 'error'
                  }
                  onClose={() => setSaveMessage('')}
                  sx={{ mb: 2 }}
                >
                  {saveMessage.text}
                </Alert>
              )}

              {/* 1. Current Setlist Section (At the Top) */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                  Current Setlist ({setlist.length} {setlist.length === 1 ? 'song' : 'songs'})
                </Typography>

                {setlist.length > 0 ? (
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1.5,
                      mb: 2.5,
                    }}
                  >
                    {setlist.map((song, idx) => {
                      const displaySong = mergeSongWithBank(song, songsById);
                      return (
                        <Paper
                          key={`${displaySong._id}-${idx}`}
                          variant="outlined"
                          sx={{
                            p: { xs: 1.5, sm: 2 },
                            borderRadius: 2,
                            bgcolor: 'background.paper',
                            transition: 'all 0.15s ease',
                            display: 'flex',
                            flexDirection: { xs: 'column', sm: 'row' },
                            alignItems: { xs: 'stretch', sm: 'center' },
                            justifyContent: 'space-between',
                            gap: 1.5,
                            '&:hover': {
                              borderColor: 'primary.main',
                            },
                          }}
                        >
                          {/* Song Details Row */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, flex: 1 }}>
                            <Box
                              sx={{
                                width: 28,
                                height: 28,
                                borderRadius: 1.5,
                                bgcolor: 'rgba(37, 99, 235, 0.1)',
                                color: 'primary.main',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '0.8125rem',
                                flexShrink: 0,
                              }}
                            >
                              {idx + 1}
                            </Box>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <SongTitleWithTimeSignature
                                title={displaySong.title}
                                timeSignature={displaySong.timeSignature}
                              />
                              {displaySong.artist && (
                                <Typography variant="caption" color="text.secondary" noWrap display="block" sx={{ mt: 0.2 }}>
                                  {displaySong.artist}
                                </Typography>
                              )}
                            </Box>

                            {/* Mobile-only remove icon */}
                            {canEdit && (
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => setSetlist(setlist.filter((_, i) => i !== idx))}
                                sx={{ display: { xs: 'inline-flex', sm: 'none' }, ml: 'auto' }}
                                title="Remove song"
                              >
                                <RemoveIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Box>

                          {/* Actions Toolbar */}
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              flexWrap: 'wrap',
                              justifyContent: { xs: 'space-between', sm: 'flex-end' },
                              borderTop: { xs: '1px solid', sm: 'none' },
                              borderColor: 'divider',
                              pt: { xs: 1, sm: 0 },
                            }}
                          >
                            {/* Key select */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              {renderKeySelect(displaySong)}
                            </Box>

                            {/* Reorder Arrows */}
                            {canEdit && (
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  bgcolor: 'action.hover',
                                  borderRadius: 1.5,
                                  p: 0.25,
                                }}
                              >
                                <IconButton
                                  size="small"
                                  onClick={() => handleMoveSongUp(idx)}
                                  disabled={idx === 0}
                                  title="Move up"
                                  sx={{ p: 0.5 }}
                                >
                                  <ArrowUpwardIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() => handleMoveSongDown(idx)}
                                  disabled={idx === setlist.length - 1}
                                  title="Move down"
                                  sx={{ p: 0.5 }}
                                >
                                  <ArrowDownwardIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            )}

                            {/* Lyrics & Chords Viewer Buttons */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() =>
                                  navigate(
                                    `/events/${id}/setlist/${displaySong._id}?view=lyrics`
                                  )
                                }
                                sx={{
                                  fontSize: '0.75rem',
                                  py: 0.5,
                                  px: 1.2,
                                  borderRadius: 1.5,
                                  textTransform: 'none',
                                  height: 32,
                                }}
                              >
                                Lyrics
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() =>
                                  navigate(
                                    `/events/${id}/setlist/${displaySong._id}?view=chords`
                                  )
                                }
                                sx={{
                                  fontSize: '0.75rem',
                                  py: 0.5,
                                  px: 1.2,
                                  borderRadius: 1.5,
                                  textTransform: 'none',
                                  height: 32,
                                }}
                              >
                                Chords
                              </Button>
                            </Box>

                            {/* Desktop-only remove icon */}
                            {canEdit && (
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => {
                                  setSetlist(setlist.filter((_, i) => i !== idx));
                                }}
                                sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
                                title="Remove song from setlist"
                              >
                                <RemoveIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Box>
                        </Paper>
                      );
                    })}
                  </Box>
                ) : (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 2.5 }}
                  >
                    No songs in setlist yet. Add songs using quick add or recommendations below.
                  </Typography>
                )}

                {canEdit && (
                  <Button
                    variant="contained"
                    fullWidth
                    size="large"
                    onClick={async () => {
                      try {
                        await api.put(`/events/${id}`, {
                          setlist: setlist.map((s) => s._id),
                        });
                        await loadPageData(false);
                        setSaveMessage({
                          type: 'success',
                          text: 'Setlist saved successfully!',
                        });
                        setTimeout(() => setSaveMessage(''), 3000);
                      } catch (err) {
                        console.error('Failed to save setlist:', err);
                        setSaveMessage({
                          type: 'error',
                          text:
                            err?.response?.data?.message ||
                            'Failed to save setlist. Please try again.',
                        });
                      }
                    }}
                    sx={{
                      borderRadius: 2,
                      py: 1.2,
                      fontSize: '0.9375rem',
                      fontWeight: 700,
                    }}
                  >
                    Save Setlist
                  </Button>
                )}
              </Box>

              <Divider sx={{ my: 3 }} />

              {/* 2. Quick Add Song & Recommended Songs (At the Bottom) */}
              <Box>
                {canEdit && (
                  <Box sx={{ mb: 2.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                      Quick Add Song
                    </Typography>
                    <Box
                      sx={{
                        display: 'flex',
                        gap: 1,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                      }}
                    >
                      <TextField
                        inputRef={addSongTitleInputRef}
                        size="small"
                        placeholder="Enter song title..."
                        label="Quick add song title"
                        value={newSongTitle}
                        onChange={(e) => setNewSongTitle(e.target.value)}
                        sx={{ flex: 1, minWidth: { xs: 150, sm: 220 } }}
                      />
                      <FormControl size="small" sx={{ minWidth: 85 }}>
                        <InputLabel>Key</InputLabel>
                        <Select
                          value={newSongKey}
                          label="Key"
                          onChange={(e) => setNewSongKey(e.target.value)}
                        >
                          {keyOptions.map((k) => (
                            <MenuItem key={k} value={k}>
                              {k}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={handleQuickAddSong}
                        disabled={addSongLoading}
                        sx={{ borderRadius: 2, textTransform: 'none', height: 40, whiteSpace: 'nowrap' }}
                      >
                        {addSongLoading ? 'Adding...' : 'Add'}
                      </Button>
                    </Box>
                  </Box>
                )}

                {addSongError && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {addSongError}
                  </Alert>
                )}

                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                    Recommended Songs
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Search recommended songs by title or artist..."
                    label="Search recommended songs"
                    value={songQuery}
                    onChange={(e) => setSongQuery(e.target.value)}
                    sx={{ mb: 2 }}
                  />
                </Box>

                {/* Recommended Songs List */}
                {songs.length > 0 ? (
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1.5,
                    }}
                  >
                    {recommendedSongs.map((song) => {
                      const displaySong = mergeSongWithBank(song, songsById);
                      return (
                        <Paper
                          key={displaySong._id}
                          variant="outlined"
                          sx={{
                            p: { xs: 1.5, sm: 2 },
                            borderRadius: 2,
                            bgcolor: 'background.paper',
                            display: 'flex',
                            flexDirection: { xs: 'column', sm: 'row' },
                            alignItems: { xs: 'stretch', sm: 'center' },
                            justifyContent: 'space-between',
                            gap: 1.5,
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, flex: 1 }}>
                            <Box
                              sx={{
                                width: 32,
                                height: 32,
                                borderRadius: 1.5,
                                bgcolor: 'rgba(245, 158, 11, 0.1)',
                                color: '#f59e0b',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <MusicIcon sx={{ fontSize: 18 }} />
                            </Box>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <SongTitleWithTimeSignature
                                title={displaySong.title}
                                timeSignature={displaySong.timeSignature}
                              />
                              {displaySong.artist && (
                                <Typography variant="caption" color="text.secondary" noWrap display="block" sx={{ mt: 0.2 }}>
                                  {displaySong.artist}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              justifyContent: { xs: 'space-between', sm: 'flex-end' },
                              borderTop: { xs: '1px solid', sm: 'none' },
                              borderColor: 'divider',
                              pt: { xs: 1, sm: 0 },
                            }}
                          >
                            {renderKeySelect(displaySong)}
                            {canEdit && (
                              <Button
                                size="small"
                                variant={setlist.some((s) => s._id === displaySong._id) ? 'outlined' : 'contained'}
                                startIcon={setlist.some((s) => s._id === displaySong._id) ? null : <AddIcon />}
                                onClick={() => {
                                  if (!setlist.find((s) => s._id === displaySong._id)) {
                                    setSetlist([
                                      ...setlist,
                                      mergeSongWithBank(displaySong, songsById),
                                    ]);
                                  }
                                }}
                                disabled={setlist.some((s) => s._id === displaySong._id)}
                                sx={{ borderRadius: 1.5, textTransform: 'none', height: 32, fontSize: '0.8125rem', whiteSpace: 'nowrap' }}
                              >
                                {setlist.some((s) => s._id === displaySong._id) ? 'Added' : 'Add to Setlist'}
                              </Button>
                            )}
                          </Box>
                        </Paper>
                      );
                    })}
                  </Box>
                ) : (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                  >
                    No songs available.
                  </Typography>
                )}
                {songs.length > 0 && recommendedSongs.length === 0 && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                  >
                    {setlist.length > 0
                      ? 'No recommendations match your search. Add a different song or clear search.'
                      : 'Add at least one song to the setlist to get key-based recommendations.'}
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>

          {/* Team Members */}
          <Card sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Box display="flex" alignItems="center" gap={2} mb={3}>
                <GroupIcon color="primary" />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Team Members ({teamMembers.length})
                </Typography>
              </Box>

              {teamMembers.length > 0 ? (
                <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
                  <Table>
                    <TableHead sx={{ bgcolor: 'action.hover' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Person</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Role</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {teamMembers.map((member, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <Typography variant="body2">
                              {member.userId?.name ||
                                member.userId?.email ||
                                'Unknown'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={member.role}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={member.status || 'team member'}
                              size="small"
                              color={
                                member.status === 'confirmed'
                                  ? 'success'
                                  : member.status === 'declined'
                                    ? 'error'
                                    : 'default'
                              }
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ py: 2 }}
                >
                  No team members yet. Click "Edit Team" to add people.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} lg={4}>
          {/* Actions */}
          <Card sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                Actions
              </Typography>
              <Box display="flex" flexDirection="column" gap={2}>
                {canEdit && (
                  <Button
                    variant="contained"
                    startIcon={<EditIcon />}
                    onClick={() => navigate(`/events/${id}/edit`)}
                    fullWidth
                    sx={{ borderRadius: 2 }}
                  >
                    Edit Event
                  </Button>
                )}
                {isFullAdmin && event.event?.status === 'draft' && (
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<CheckCircleIcon />}
                    onClick={handleConfirmEvent}
                    fullWidth
                    sx={{ borderRadius: 2 }}
                  >
                    Confirm Event
                  </Button>
                )}
                {isFullAdmin && event.event?.status === 'published' && (
                  <>
                    <Button
                      variant="outlined"
                      color="warning"
                      onClick={handleUnconfirmEvent}
                      fullWidth
                      sx={{ borderRadius: 2 }}
                    >
                      Unconfirm Event
                    </Button>
                    <Button
                      variant="contained"
                      color="success"
                      startIcon={<CheckCircleIcon />}
                      onClick={handleMarkCompleted}
                      fullWidth
                      sx={{ borderRadius: 2, boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)' }}
                    >
                      Mark Completed
                    </Button>
                  </>
                )}
                {isFullAdmin && event.event?.status === 'completed' && (
                  <Button
                    variant="outlined"
                    color="warning"
                    onClick={handleUndoCompleted}
                    fullWidth
                    sx={{ borderRadius: 2, textTransform: 'none' }}
                  >
                    Undo Completed
                  </Button>
                )}
                <Button
                  variant="outlined"
                  startIcon={<GroupIcon />}
                  onClick={() => navigate(`/events/${id}/team`)}
                  fullWidth
                  sx={{ borderRadius: 2 }}
                >
                  {canEdit ? 'Edit Team' : 'View Team'}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<ChatIcon />}
                  onClick={() => navigate(`/events/${id}/chat`)}
                  fullWidth
                  sx={{ borderRadius: 2 }}
                >
                  Open Chat
                </Button>
                {canEdit && (
                  <Button
                    variant="outlined"
                    color="primary"
                    startIcon={<NotificationsActiveIcon />}
                    onClick={async () => {
                      try {
                        setReminderLoading(true);
                        setReminderMessage('');
                        const token = localStorage.getItem('accessToken');
                        const res = await fetch(apiUrl(`/api/events/${id}/send-reminder`), {
                          method: 'POST',
                          headers: { Authorization: `Bearer ${token}` },
                        });
                        const data = await res.json();
                        if (res.ok) {
                          setReminderMessage(data.message || 'Reminder sent!');
                          setTimeout(() => setReminderMessage(''), 4000);
                        } else {
                          alert(data.message || 'Failed to send reminder');
                        }
                      } catch (err) {
                        alert(err.message || 'Failed to send reminder');
                      } finally {
                        setReminderLoading(false);
                      }
                    }}
                    disabled={reminderLoading}
                    fullWidth
                    sx={{ borderRadius: 2, textTransform: 'none' }}
                  >
                    {reminderLoading ? 'Sending Reminder...' : 'Send Reminder'}
                  </Button>
                )}
                {reminderMessage && (
                  <Alert severity="success" sx={{ py: 0.5, fontSize: '0.78rem' }}>
                    {reminderMessage}
                  </Alert>
                )}
                {isFullAdmin && (
                  <>
                    <Divider sx={{ my: 1 }} />
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => setDeleteDialogOpen(true)}
                      fullWidth
                      sx={{ borderRadius: 2 }}
                    >
                      Delete Event
                    </Button>
                  </>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Event?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{eventInfo.title}"? This action
            cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default EventDetails;
