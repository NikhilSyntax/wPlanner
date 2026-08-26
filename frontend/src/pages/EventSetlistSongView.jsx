import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  NavigateNext as NextIcon,
  NavigateBefore as PrevIcon,
  MusicNote as MusicIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import api from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ChordSheetViewer from '../components/common/ChordSheetViewer';

const KEY_OPTIONS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const TIME_SIG_OPTIONS = ['2/4', '3/4', '4/4', '5/4', '6/8', '7/8'];

function EventSetlistSongView() {
  const { id, songId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const view = searchParams.get('view');
  // If view=lyrics, default to hiding chords; otherwise show chords
  const initialShowChords = view !== 'lyrics';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [setlist, setSetlist] = useState([]);
  const [song, setSong] = useState(null);

  // Edit Modal State
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [editForm, setEditForm] = useState({
    title: '',
    artist: '',
    key: 'C',
    bpm: '',
    timeSignature: '4/4',
    content: '',
  });

  // Data fetching
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const eventRes = await api.get(`/events/${id}`);
        if (cancelled) return;
        const eventDoc = eventRes.data || {};
        const list = Array.isArray(eventDoc.setlist) ? eventDoc.setlist : [];
        setEventTitle(eventDoc?.event?.title || 'Event');
        setSetlist(list);
        const fromEvent = list.find((s) => String(s?._id) === String(songId));
        if (fromEvent && (fromEvent?.content?.lyrics || fromEvent?.content?.chords)) {
          setSong(fromEvent);
        } else {
          const songRes = await api.get(`/songs/${songId}`);
          if (!cancelled) setSong(songRes.data || null);
        }
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.message || 'Failed to load lyrics and chords');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, songId]);

  const currentIndex = useMemo(
    () => setlist.findIndex((s) => String(s?._id) === String(songId)),
    [setlist, songId]
  );
  const nextSong = currentIndex >= 0 ? setlist[currentIndex + 1] : null;
  const prevSong = currentIndex > 0 ? setlist[currentIndex - 1] : null;

  const goNextSong = () => {
    if (!nextSong?._id) return;
    const query = view ? `?view=${view}` : '';
    navigate(`/events/${id}/setlist/${nextSong._id}${query}`);
  };

  const goPrevSong = () => {
    if (!prevSong?._id) return;
    const query = view ? `?view=${view}` : '';
    navigate(`/events/${id}/setlist/${prevSong._id}${query}`);
  };

  const handleOpenEditModal = () => {
    setEditForm({
      title: song?.title || '',
      artist: song?.artist || '',
      key: song?.key || 'C',
      bpm: song?.bpm ?? '',
      timeSignature: song?.timeSignature || '4/4',
      content: song?.content?.chords || song?.content?.lyrics || '',
    });
    setEditError('');
    setEditDialogOpen(true);
  };

  const handleInsertSectionTag = (tag) => {
    setEditForm((prev) => {
      const current = prev.content || '';
      const prefix = current.length > 0 && !current.endsWith('\n') ? '\n\n' : '';
      return {
        ...prev,
        content: `${current}${prefix}${tag}\n`,
      };
    });
  };

  const handleSaveSongEdit = async () => {
    if (!editForm.title.trim()) {
      setEditError('Song title is required');
      return;
    }
    try {
      setEditLoading(true);
      setEditError('');
      const payload = {
        title: editForm.title.trim(),
        artist: editForm.artist.trim(),
        key: editForm.key,
        bpm: editForm.bpm ? parseInt(editForm.bpm, 10) : undefined,
        timeSignature: editForm.timeSignature,
        content: {
          chords: editForm.content,
          lyrics: editForm.content,
        },
      };
      const res = await api.put(`/songs/${songId}`, payload);
      const updatedSong = res.data;
      setSong(updatedSong);
      setToastMessage('Lyrics & chords updated successfully!');
      setEditDialogOpen(false);
    } catch (err) {
      console.error('Failed to update song:', err);
      setEditError(
        err?.response?.data?.message || 'Failed to save changes. Please try again.'
      );
    } finally {
      setEditLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <Box sx={{ p: 2, maxWidth: 700, mx: 'auto' }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  const songContent = song?.content?.chords || song?.content?.lyrics || '';

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1050, mx: 'auto' }}>
      {/* Toast Notification */}
      <Snackbar
        open={Boolean(toastMessage)}
        autoHideDuration={3000}
        onClose={() => setToastMessage('')}
        message={toastMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

      {/* Header Top Bar */}
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <IconButton onClick={() => navigate(`/events/${id}`)} aria-label="Back to event">
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {view === 'lyrics' ? 'Song Lyrics' : 'Chords & Lyrics'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {eventTitle}
          </Typography>
        </Box>
      </Stack>

      <Card sx={{ borderRadius: 3, mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            alignItems={{ xs: 'flex-start', md: 'center' }}
            justifyContent="space-between"
            gap={1.5}
            sx={{ mb: 2 }}
          >
            <Stack direction="row" alignItems="center" gap={1.5} flexWrap="wrap">
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: 2,
                  bgcolor: 'rgba(37, 99, 235, 0.1)',
                  color: 'primary.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MusicIcon />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {song?.title || 'Song'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {song?.artist || 'Unknown Artist'}
                </Typography>
              </Box>
              {song?.key && (
                <Chip size="small" label={`Key: ${song.key}`} color="primary" variant="outlined" sx={{ fontWeight: 600 }} />
              )}
            </Stack>

            {/* Actions: Edit Lyrics & Chords + Previous / Next Song Controls */}
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button
                variant="outlined"
                color="primary"
                startIcon={<EditIcon />}
                onClick={handleOpenEditModal}
                sx={{
                  textTransform: 'none',
                  borderRadius: 2,
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                }}
              >
                Edit Lyrics & Chords
              </Button>
              <Button
                variant="outlined"
                startIcon={<PrevIcon />}
                onClick={goPrevSong}
                disabled={!prevSong}
                sx={{ textTransform: 'none', borderRadius: 2 }}
              >
                {prevSong ? 'Prev Song' : 'First Song'}
              </Button>
              <Button
                variant="contained"
                endIcon={<NextIcon />}
                onClick={goNextSong}
                disabled={!nextSong}
                sx={{ textTransform: 'none', borderRadius: 2 }}
              >
                {nextSong ? 'Next Song' : 'Last Song'}
              </Button>
            </Stack>
          </Stack>

          <Divider sx={{ mb: 2.5 }} />

          {/* Unified Chord Sheet Viewer with Hide/Show Chords initialized from URL query */}
          <ChordSheetViewer
            key={`${songId}-${view}-${song?.updatedAt || ''}`}
            rawContent={songContent}
            originalKey={song?.key || 'C'}
            title={song?.title}
            artist={song?.artist}
            initialShowChords={initialShowChords}
            onEdit={handleOpenEditModal}
          />
        </CardContent>
      </Card>

      {/* Edit Lyrics & Chords Modal Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => !editLoading && setEditDialogOpen(false)}
        fullWidth
        maxWidth="md"
        PaperProps={{
          sx: { borderRadius: 3, p: { xs: 1, sm: 2 } },
        }}
      >
        <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <MusicIcon color="primary" />
            <Typography variant="h6" fontWeight={700}>
              Edit Lyrics & Chords
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={() => setEditDialogOpen(false)}
            disabled={editLoading}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ py: 2.5 }}>
          {editError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {editError}
            </Alert>
          )}

          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Song Title"
                required
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Artist / Author"
                value={editForm.artist}
                onChange={(e) => setEditForm({ ...editForm, artist: e.target.value })}
              />
            </Grid>
            <Grid item xs={6} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Default Key</InputLabel>
                <Select
                  label="Default Key"
                  value={editForm.key}
                  onChange={(e) => setEditForm({ ...editForm, key: e.target.value })}
                >
                  {KEY_OPTIONS.map((k) => (
                    <MenuItem key={k} value={k}>
                      {k}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Time Signature</InputLabel>
                <Select
                  label="Time Signature"
                  value={editForm.timeSignature}
                  onChange={(e) => setEditForm({ ...editForm, timeSignature: e.target.value })}
                >
                  {TIME_SIG_OPTIONS.map((ts) => (
                    <MenuItem key={ts} value={ts}>
                      {ts}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="BPM / Tempo"
                placeholder="e.g. 72"
                value={editForm.bpm}
                onChange={(e) => setEditForm({ ...editForm, bpm: e.target.value })}
              />
            </Grid>
          </Grid>

          {/* Quick Section Insert Chips */}
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ mb: 0.75 }}>
              QUICK INSERT SECTION:
            </Typography>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" gap={0.75}>
              {['[Intro]', '[Verse 1]', '[Verse 2]', '[Chorus]', '[Pre-Chorus]', '[Bridge]', '[Interlude]', '[Outro]'].map(
                (sec) => (
                  <Chip
                    key={sec}
                    label={sec}
                    size="small"
                    clickable
                    onClick={() => handleInsertSectionTag(sec)}
                    sx={{ fontWeight: 600, fontSize: '0.75rem' }}
                  />
                )
              )}
            </Stack>
          </Box>

          {/* Lyrics and Chords Text Area */}
          <TextField
            fullWidth
            multiline
            minRows={14}
            maxRows={24}
            label="Lyrics and Chords Content"
            placeholder={`[Verse 1]\n[G] Amazing grace, how [C] sweet the [G] sound\nThat [G] saved a wretch like [D] me\n\n[Chorus]\n[G] My chains are [C] gone, I've been set [G] free`}
            value={editForm.content}
            onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
            inputProps={{
              style: {
                fontFamily: 'Consolas, "Roboto Mono", "Courier New", monospace',
                fontSize: '0.9rem',
                lineHeight: 1.6,
              },
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Tip: You can use ChordPro format (e.g. <code>[G]Amazing [D]grace</code>) or write chords on the line directly above lyrics.
          </Typography>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
          <Button
            size="small"
            startIcon={<OpenInNewIcon />}
            onClick={() => {
              setEditDialogOpen(false);
              navigate(`/songs/${songId}/edit`);
            }}
            sx={{ textTransform: 'none', color: 'text.secondary' }}
          >
            Open Full Song Editor
          </Button>

          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              onClick={() => setEditDialogOpen(false)}
              disabled={editLoading}
              sx={{ textTransform: 'none', borderRadius: 2 }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSaveSongEdit}
              disabled={editLoading}
              sx={{ textTransform: 'none', borderRadius: 2, px: 2.5 }}
            >
              {editLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default EventSetlistSongView;
