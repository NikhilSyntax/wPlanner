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
} from '@mui/icons-material';
import axios from 'axios';
import api from '../services/api';
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
    <Box display="inline-flex" alignItems="baseline" gap={1} flexWrap="wrap">
      <Typography variant="body2" component="span" sx={{ fontWeight: 500 }}>
        {prefix}
        {title}
      </Typography>
      {timeSignature ? (
        <Typography variant="caption" component="span" color="text.secondary">
          {timeSignature}
        </Typography>
      ) : null}
    </Box>
  );
}

function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useSelector((state) => state.auth);
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
      const token = localStorage.getItem('accessToken');
      const headers = { Authorization: `Bearer ${token}` };
      const [eventRes, songsRes] = await Promise.all([
        axios.get(`/api/events/${id}`, { headers }),
        axios.get('/api/songs', { headers }),
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
      const token = localStorage.getItem('accessToken');
      const res = await axios.get('/api/songs', {
        headers: { Authorization: `Bearer ${token}` },
      });
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
      const token = localStorage.getItem('accessToken');
      await axios.delete(`/api/events/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
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
      const token = localStorage.getItem('accessToken');
      await axios.post(
        '/api/songs',
        {
          title,
          key: newSongKey,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
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
      <FormControl size="small" sx={{ minWidth: 76 }}>
        <Select
          value={song.key || 'C'}
          onChange={(e) => handleSongKeyChange(song._id, e.target.value)}
          sx={{
            fontSize: '0.8125rem',
            '& .MuiSelect-select': { py: 0.75, px: 1.25 },
          }}
        >
          {keyOptions.map((k) => (
            <MenuItem key={k} value={k}>
              {k}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    ) : song.key ? (
      <Chip size="small" label={`Key: ${song.key}`} variant="outlined" />
    ) : null;

  return (
    <Box sx={{ pb: 4 }}>
      {/* Header with back button */}
      <Box display="flex" alignItems="center" justifyContent="space-between" gap={2} mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <IconButton onClick={() => navigate('/events')} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
              {getEventDisplayTitle(event) || 'Event Details'}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {eventInfo.type && (
                <Chip
                  label={
                    eventInfo.type.charAt(0).toUpperCase() +
                    eventInfo.type.slice(1)
                  }
                  size="small"
                  color={eventTypeColors[eventInfo.type] || 'default'}
                  variant="outlined"
                  sx={{ mr: 1, mt: 1 }}
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
                    sx={{ mt: 1 }}
                  />
                );
              })()}
            </Typography>
          </Box>
        </Box>
        {canEdit && (
          <Box display="flex" gap={1} flexWrap="wrap" justifyContent="flex-end">
            {eventInfo.status === 'completed' ? (
              user?.isAdmin && (
                <Button
                  variant="outlined"
                  color="warning"
                  onClick={handleUndoCompleted}
                  sx={{ textTransform: 'none' }}
                >
                  Undo Completed
                </Button>
              )
            ) : (
              <Button
                variant="contained"
                color="success"
                onClick={handleMarkCompleted}
                sx={{ textTransform: 'none' }}
              >
                Mark Completed
              </Button>
            )}
            <Button
              variant="outlined"
              color="error"
              onClick={() => setDeleteDialogOpen(true)}
            >
              Delete
            </Button>
          </Box>
        )}
      </Box>

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
          {/* Event Information */}
          <Card sx={{ borderRadius: 3, mb: 2 }}>
            <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
              <Box display="flex" alignItems="center" gap={2} mb={3}>
                <EventIcon color="primary" />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Event Information
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mb: 0.25 }}
                  >
                    Description
                  </Typography>
                  <Typography variant="body2">
                    {eventInfo.description || 'No description provided'}
                  </Typography>
                </Box>

                <Divider />

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mb: 0.25 }}
                    >
                      Start Time
                    </Typography>
                    <Typography variant="body2">
                      {startDate.toLocaleString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mb: 0.25 }}
                    >
                      End Time
                    </Typography>
                    <Typography variant="body2">
                      {endDate.toLocaleString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Typography>
                  </Grid>
                </Grid>
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
                mb={2}
                flexWrap="wrap"
              >
                <Box display="flex" alignItems="center" gap={2}>
                  <MusicIcon color="primary" />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Songs & Setlist
                  </Typography>
                </Box>
                {canEdit && (
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
                      label="Song title"
                      value={newSongTitle}
                      onChange={(e) => setNewSongTitle(e.target.value)}
                      sx={{ minWidth: 180 }}
                    />
                    <FormControl size="small" sx={{ minWidth: 110 }}>
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
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={handleQuickAddSong}
                      disabled={addSongLoading}
                      sx={{ borderRadius: 2, textTransform: 'none' }}
                    >
                      {addSongLoading ? 'Adding...' : 'Add Song'}
                    </Button>
                  </Box>
                )}
              </Box>

              <TextField
                fullWidth
                size="small"
                label="Search recommended songs by title or artist"
                value={songQuery}
                onChange={(e) => setSongQuery(e.target.value)}
                sx={{ mb: 2 }}
              />
              {addSongError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {addSongError}
                </Alert>
              )}

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

              <Typography
                variant="subtitle2"
                sx={{ fontWeight: 600, mb: 2, mt: 2 }}
              >
                Recommended Songs
              </Typography>

              {songs.length > 0 ? (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    mb: 3,
                  }}
                >
                  {recommendedSongs.map((song) => {
                    const displaySong = mergeSongWithBank(song, songsById);
                    return (
                    <Box
                      key={displaySong._id}
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{
                        p: 1.5,
                        bgcolor: 'action.hover',
                        borderRadius: 1,
                      }}
                    >
                      <Box>
                        <SongTitleWithTimeSignature
                          title={displaySong.title}
                          timeSignature={displaySong.timeSignature}
                        />
                        <Box display="flex" gap={2}>
                          {displaySong.artist && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {displaySong.artist}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                      <Box display="flex" alignItems="center" gap={1}>
                        {renderKeySelect(displaySong)}
                        {canEdit && (
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<AddIcon />}
                            onClick={() => {
                              if (!setlist.find((s) => s._id === displaySong._id)) {
                                setSetlist([
                                  ...setlist,
                                  mergeSongWithBank(displaySong, songsById),
                                ]);
                              }
                            }}
                            disabled={setlist.some((s) => s._id === displaySong._id)}
                          >
                            Add
                          </Button>
                        )}
                      </Box>
                    </Box>
                    );
                  })}
                </Box>
              ) : (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 3 }}
                >
                  No songs available.
                </Typography>
              )}
              {songs.length > 0 && recommendedSongs.length === 0 && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 3 }}
                >
                  {setlist.length > 0
                    ? 'No recommendations match your search. Add a different song or clear search.'
                    : 'Add at least one song to the setlist to get key-based recommendations.'}
                </Typography>
              )}

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                Current Setlist ({setlist.length} songs)
              </Typography>

              {setlist.length > 0 ? (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    mb: 3,
                  }}
                >
                  {setlist.map((song, idx) => {
                    const displaySong = mergeSongWithBank(song, songsById);
                    return (
                    <Box
                      key={`${displaySong._id}-${idx}`}
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{
                        p: 1.5,
                        bgcolor: 'action.hover',
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Box flex={1} minWidth={0}>
                        <SongTitleWithTimeSignature
                          title={displaySong.title}
                          timeSignature={displaySong.timeSignature}
                          prefix={`${idx + 1}. `}
                        />
                        {displaySong.artist && (
                          <Typography variant="caption" color="text.secondary">
                            {displaySong.artist}
                          </Typography>
                        )}
                      </Box>
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
                      >
                        {renderKeySelect(displaySong)}
                        {canEdit && (
                          <>
                            <IconButton
                              size="small"
                              onClick={() => handleMoveSongUp(idx)}
                              disabled={idx === 0}
                              title="Move up"
                            >
                              <ArrowUpwardIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleMoveSongDown(idx)}
                              disabled={idx === setlist.length - 1}
                              title="Move down"
                            >
                              <ArrowDownwardIcon fontSize="small" />
                            </IconButton>
                          </>
                        )}
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() =>
                            navigate(
                              `/events/${id}/setlist/${displaySong._id}?view=lyrics`
                            )
                          }
                          sx={{ textTransform: 'none' }}
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
                          sx={{ textTransform: 'none' }}
                        >
                          Chords
                        </Button>
                        {canEdit && (
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => {
                              setSetlist(setlist.filter((_, i) => i !== idx));
                            }}
                          >
                            <RemoveIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                    </Box>
                    );
                  })}
                </Box>
              ) : (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 3 }}
                >
                  No songs in setlist yet. Add songs from the list above.
                </Typography>
              )}

              {canEdit && (
                <Button
                  variant="contained"
                  fullWidth
                  onClick={async () => {
                    try {
                      const token = localStorage.getItem('accessToken');
                      await axios.put(
                        `/api/events/${id}`,
                        { setlist: setlist.map((s) => s._id) },
                        { headers: { Authorization: `Bearer ${token}` } }
                      );
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
                  sx={{ borderRadius: 2 }}
                >
                  Save Setlist
                </Button>
              )}
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
                {canEdit && event.event?.status === 'draft' && (
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={async () => {
                      try {
                        const token = localStorage.getItem('accessToken');
                        await fetch(`/api/events/${id}`, {
                          method: 'PUT',
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`,
                          },
                          body: JSON.stringify({
                            event: { status: 'published' },
                          }),
                        });
                        await fetchEvent();
                      } catch (err) {
                        console.error('Failed to confirm event', err);
                      }
                    }}
                    fullWidth
                    sx={{ borderRadius: 2 }}
                  >
                    Confirm Event
                  </Button>
                )}
                {canEdit && event.event?.status === 'published' && (
                  <Button
                    variant="outlined"
                    color="warning"
                    onClick={async () => {
                      if (!window.confirm('Revert this event to Draft?'))
                        return;
                      try {
                        const token = localStorage.getItem('accessToken');
                        await fetch(`/api/events/${id}`, {
                          method: 'PUT',
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`,
                          },
                          body: JSON.stringify({ event: { status: 'draft' } }),
                        });
                        await fetchEvent();
                      } catch (err) {
                        console.error('Failed to unconfirm event', err);
                      }
                    }}
                    fullWidth
                    sx={{ borderRadius: 2 }}
                  >
                    Unconfirm Event
                  </Button>
                )}
                {user?.isAdmin && event.event?.status === 'completed' && (
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
