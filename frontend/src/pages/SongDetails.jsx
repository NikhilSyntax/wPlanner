import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Chip,
  Card,
  CardContent,
  Stack,
  Alert,
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
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  IconButton,
  Snackbar,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MusicNote as MusicNoteIcon,
  Speed as SpeedIcon,
  AccessTime as AccessTimeIcon,
  QueueMusic as QueueMusicIcon,
  History as HistoryIcon,
  CalendarMonth as EditCalendarIcon,
  DeleteOutline as DeleteOutlineIcon,
  CloudDownload as ImportIcon,
} from '@mui/icons-material';
import api from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ChordSheetViewer from '../components/common/ChordSheetViewer';
import { useAuth } from '../hooks/useAuth';
import ImportSongModal from '../components/songs/ImportSongModal';

function SongDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isAdmin = Boolean(
    user?.isAdmin ||
    user?.isSubAdmin ||
    user?.role === 'Admin' ||
    user?.role === 'admin' ||
    user?.roles?.includes('admin') ||
    user?.role === 'team_leader'
  );

  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);

  // Edit Last Used Dialog State
  const [editLastUsedOpen, setEditLastUsedOpen] = useState(false);
  const [lastUsedDate, setLastUsedDate] = useState('');
  const [lastUsedEventTitle, setLastUsedEventTitle] = useState('');
  const [lastUsedKey, setLastUsedKey] = useState('C');
  const [lastUsedNotes, setLastUsedNotes] = useState('');
  const [savingLastUsed, setSavingLastUsed] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [importModalOpen, setImportModalOpen] = useState(false);

  useEffect(() => {
    fetchSong();
  }, [id]);

  const fetchSong = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get(`/songs/${id}`);
      setSong(res.data);
    } catch (err) {
      console.error('Error fetching song details:', err);
      setError(err?.response?.data?.message || 'Failed to load song details');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this song from your church song bank?')) {
      try {
        await api.delete(`/songs/${id}`);
        navigate('/songs');
      } catch (err) {
        console.error(err);
        alert('Error deleting song');
      }
    }
  };

  const handleOpenEditLastUsed = () => {
    const existingDate = song?.usage?.lastPerformed ? new Date(song.usage.lastPerformed) : new Date();
    const yyyy = existingDate.getFullYear();
    const mm = String(existingDate.getMonth() + 1).padStart(2, '0');
    const dd = String(existingDate.getDate()).padStart(2, '0');
    setLastUsedDate(`${yyyy}-${mm}-${dd}`);
    setLastUsedEventTitle('');
    setLastUsedKey(song?.key || 'C');
    setLastUsedNotes('');
    setEditLastUsedOpen(true);
  };

  const handleSaveLastUsed = async () => {
    if (!lastUsedDate) {
      alert('Please select a valid date.');
      return;
    }
    try {
      setSavingLastUsed(true);
      const res = await api.put(`/songs/${id}/usage`, {
        action: 'setLastUsed',
        lastPerformed: new Date(lastUsedDate).toISOString(),
        eventTitle: lastUsedEventTitle.trim() || 'Worship Service',
        key: lastUsedKey,
        notes: lastUsedNotes.trim(),
      });
      setSong(res.data);
      setToastMessage(`Last used date updated for "${song.title}"`);
      setEditLastUsedOpen(false);
    } catch (err) {
      console.error('Error saving last used date:', err);
      alert(err.response?.data?.message || 'Failed to update last used date.');
    } finally {
      setSavingLastUsed(false);
    }
  };

  const handleClearLastUsed = async () => {
    if (!window.confirm(`Clear last used date for "${song?.title}"?`)) return;
    try {
      setSavingLastUsed(true);
      const res = await api.put(`/songs/${id}/usage`, {
        action: 'clearLastUsed',
        clearManualHistory: true,
      });
      setSong(res.data);
      setToastMessage(`Cleared last used date for "${song.title}"`);
      setEditLastUsedOpen(false);
    } catch (err) {
      console.error('Error clearing last used date:', err);
      alert('Failed to clear last used date.');
    } finally {
      setSavingLastUsed(false);
    }
  };

  const handleDeleteHistoryEntry = async (usageId) => {
    if (!window.confirm('Remove this performance entry?')) return;
    try {
      const res = await api.put(`/songs/${id}/usage`, {
        action: 'deleteUsage',
        usageId,
      });
      setSong(res.data);
      setToastMessage('Performance record removed.');
    } catch (err) {
      console.error(err);
      alert('Failed to remove performance entry.');
    }
  };

  if (loading) return <LoadingSpinner />;

  if (error || !song) {
    return (
      <Box sx={{ p: 3, maxWidth: 600, mx: 'auto' }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error || 'Song not found'}
        </Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/songs')}>
          Back to Songs
        </Button>
      </Box>
    );
  }

  const songContent = song.content?.chords || song.content?.lyrics || '';

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1050, mx: 'auto' }}>
      {/* Top Navigation */}
      <Box sx={{ mb: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/songs')}
          variant="outlined"
          size="small"
          sx={{ borderRadius: 2 }}
        >
          Back to Songs
        </Button>

        <Stack direction="row" spacing={1}>
          {isAdmin && (
            <Button
              variant="outlined"
              color="primary"
              size="small"
              startIcon={<EditCalendarIcon />}
              onClick={handleOpenEditLastUsed}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
            >
              Record / Edit Last Used
            </Button>
          )}

          <Button
            variant="outlined"
            color="primary"
            startIcon={<ImportIcon />}
            onClick={() => setImportModalOpen(true)}
            size="small"
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
          >
            Import Song
          </Button>

          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => navigate(`/songs/${id}/edit`)}
            size="small"
            sx={{ borderRadius: 2 }}
          >
            Edit Song
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleDelete}
            size="small"
            sx={{ borderRadius: 2 }}
          >
            Delete
          </Button>
        </Stack>
      </Box>

      {/* Song Metadata Card */}
      <Card sx={{ mb: 3, borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            alignItems={{ xs: 'flex-start', md: 'center' }}
            justifyContent="space-between"
            gap={2}
          >
            <Box display="flex" alignItems="center" gap={2}>
              <Box
                sx={{
                  width: 52,
                  height: 52,
                  borderRadius: 2.5,
                  bgcolor: 'rgba(37, 99, 235, 0.1)',
                  color: 'primary.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <MusicNoteIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box>
                <Typography variant="h5" fontWeight={700} sx={{ letterSpacing: '-0.02em' }}>
                  {song.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {song.artist || 'Unknown Artist'}
                  {song.album ? ` • ${song.album}` : ''}
                  {song.year ? ` (${song.year})` : ''}
                </Typography>
              </Box>
            </Box>

            {/* Quick Metadata Chips */}
            <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
              {song.key && (
                <Chip
                  label={`Key of ${song.key}`}
                  color="primary"
                  variant="outlined"
                  size="small"
                  sx={{ fontWeight: 700 }}
                />
              )}
              {song.bpm && (
                <Chip
                  icon={<SpeedIcon />}
                  label={`${song.bpm} BPM`}
                  size="small"
                  sx={{ fontWeight: 600 }}
                />
              )}
              {song.timeSignature && (
                <Chip
                  icon={<AccessTimeIcon />}
                  label={song.timeSignature}
                  size="small"
                  sx={{ fontWeight: 600 }}
                />
              )}
              {song.usage?.lastPerformed ? (
                <Chip
                  icon={<HistoryIcon />}
                  label={`Last Used: ${new Date(song.usage.lastPerformed).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}`}
                  size="small"
                  onClick={() => setHistoryDialogOpen(true)}
                  clickable
                  color="primary"
                  variant="outlined"
                  sx={{ fontWeight: 600 }}
                />
              ) : isAdmin ? (
                <Chip
                  icon={<EditCalendarIcon />}
                  label="Set Last Used"
                  size="small"
                  onClick={handleOpenEditLastUsed}
                  clickable
                  color="primary"
                  variant="outlined"
                  sx={{ fontWeight: 600 }}
                />
              ) : null}
              {song.capo > 0 && (
                <Chip
                  label={`Capo ${song.capo}`}
                  size="small"
                  variant="outlined"
                  sx={{ fontWeight: 600 }}
                />
              )}
              {song.tuning && song.tuning !== 'Standard' && (
                <Chip
                  label={`Tuning: ${song.tuning}`}
                  size="small"
                  variant="outlined"
                  sx={{ fontWeight: 600 }}
                />
              )}
              {song.source?.provider === 'ultimate_guitar' && (
                <Chip
                  label="Source: Ultimate Guitar"
                  size="small"
                  component={song.source.url ? 'a' : 'div'}
                  href={song.source.url || undefined}
                  target="_blank"
                  rel="noreferrer"
                  clickable={Boolean(song.source.url)}
                  sx={{
                    bgcolor: 'rgba(37, 99, 235, 0.08)',
                    color: 'primary.main',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                  }}
                />
              )}
            </Stack>
          </Stack>

          {/* Genres & Tags */}
          {(song.genre?.length > 0 || song.tags?.length > 0) && (
            <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              {song.genre?.map((g) => (
                <Chip
                  key={g}
                  label={g}
                  size="small"
                  sx={{ bgcolor: 'action.hover', fontSize: '0.75rem', fontWeight: 500 }}
                />
              ))}
              {song.tags?.map((t) => (
                <Chip
                  key={t}
                  label={`#${t}`}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.75rem' }}
                />
              ))}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Main Unified Chord Sheet & Lyrics Viewer */}
      <Box sx={{ mb: 2 }}>
        <ChordSheetViewer
          songId={id}
          song={song}
          onSaveSong={(updated) => setSong(updated)}
          rawContent={songContent}
          originalKey={song?.key || 'C'}
          title={song?.title}
          artist={song?.artist}
          bpm={song?.bpm}
          timeSignature={song?.timeSignature}
          onEdit={() => navigate(`/songs/${id}/edit`)}
          onImport={() => setImportModalOpen(true)}
        />
      </Box>

      {/* Performance History Dialog */}
      <Dialog
        open={historyDialogOpen}
        onClose={() => setHistoryDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              Song Performance History
            </Typography>
            <Typography variant="caption" color="primary.main" fontWeight={600}>
              {song.title}
            </Typography>
          </Box>
          {isAdmin && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<EditCalendarIcon sx={{ fontSize: 15 }} />}
              onClick={() => {
                setHistoryDialogOpen(false);
                handleOpenEditLastUsed();
              }}
              sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem', borderRadius: 1.5 }}
            >
              Record / Edit Date
            </Button>
          )}
        </DialogTitle>
        <DialogContent dividers>
          {song.usage?.usageHistory && song.usage.usageHistory.length > 0 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Worship Event</TableCell>
                    <TableCell>Date Performed</TableCell>
                    <TableCell align="center">Key Performed</TableCell>
                    {isAdmin && <TableCell align="right">Actions</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {song.usage.usageHistory
                    .sort((a, b) => new Date(b.usedAt) - new Date(a.usedAt))
                    .map((usage, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={0.75}>
                            <Typography variant="body2" fontWeight={600}>
                              {usage.eventTitle || 'Worship Service'}
                            </Typography>
                            {usage.isManual && (
                              <Chip
                                label="Manual"
                                size="small"
                                sx={{
                                  fontSize: '0.65rem',
                                  height: 18,
                                  bgcolor: 'rgba(14, 165, 233, 0.1)',
                                  color: '#0284c7',
                                  fontWeight: 600,
                                }}
                              />
                            )}
                          </Box>
                          {usage.notes && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              {usage.notes}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(usage.usedAt).toLocaleDateString(undefined, {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={`Key of ${usage.key || song.key || 'C'}`}
                            size="small"
                            color="primary"
                            variant="outlined"
                            sx={{ fontWeight: 700, fontSize: '0.75rem' }}
                          />
                        </TableCell>
                        {isAdmin && (
                          <TableCell align="right">
                            {usage.isManual && (
                              <Tooltip title="Delete manual entry">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleDeleteHistoryEntry(usage._id)}
                                >
                                  <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
              This song has not been scheduled or recorded in any worship events yet.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setHistoryDialogOpen(false)} variant="outlined">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Admin Edit Last Used Dialog */}
      <Dialog
        open={editLastUsedOpen}
        onClose={() => !savingLastUsed && setEditLastUsedOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              bgcolor: 'rgba(37, 99, 235, 0.1)',
              color: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <EditCalendarIcon sx={{ fontSize: 20 }} />
          </Box>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              Edit Last Used Date
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {song?.title} {song?.artist ? `• ${song.artist}` : ''}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ mt: 0.5 }}>
            <TextField
              label="Date When Song Was Used"
              type="date"
              fullWidth
              size="small"
              value={lastUsedDate}
              onChange={(e) => setLastUsedDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              helperText="Set when this song was performed or last used in church"
            />

            <TextField
              label="Service / Event Name"
              placeholder="e.g. Sunday Morning Worship"
              fullWidth
              size="small"
              value={lastUsedEventTitle}
              onChange={(e) => setLastUsedEventTitle(e.target.value)}
            />

            <FormControl fullWidth size="small">
              <InputLabel>Key Performed</InputLabel>
              <Select
                value={lastUsedKey}
                label="Key Performed"
                onChange={(e) => setLastUsedKey(e.target.value)}
              >
                {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map((k) => (
                  <MenuItem key={k} value={k}>
                    Key of {k}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Notes (Optional)"
              placeholder="e.g. Special arrangement"
              fullWidth
              size="small"
              multiline
              rows={2}
              value={lastUsedNotes}
              onChange={(e) => setLastUsedNotes(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
          {song?.usage?.lastPerformed ? (
            <Button
              color="error"
              size="small"
              onClick={handleClearLastUsed}
              disabled={savingLastUsed}
              sx={{ textTransform: 'none' }}
            >
              Clear Date
            </Button>
          ) : (
            <Box />
          )}

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setEditLastUsedOpen(false)}
              disabled={savingLastUsed}
              sx={{ textTransform: 'none', borderRadius: 1.5 }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={handleSaveLastUsed}
              disabled={savingLastUsed || !lastUsedDate}
              sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5 }}
            >
              {savingLastUsed ? 'Saving...' : 'Save Date'}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Action Notification Snackbar */}
      <Snackbar
        open={Boolean(toastMessage)}
        autoHideDuration={3000}
        onClose={() => setToastMessage('')}
        message={toastMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

      {/* Ultimate Guitar Song Import Modal */}
      <ImportSongModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        targetSongId={id}
        targetSongTitle={song?.title}
        onImportToEditor={(imported) => {
          navigate(`/songs/${id}/edit`, { state: { importedSong: imported } });
        }}
        onSongSaved={(updatedSong) => {
          setSong(updatedSong);
          setToastMessage(`Song "${updatedSong.title}" updated successfully with imported lyrics & chords!`);
        }}
      />
    </Box>
  );
}

export default SongDetails;
