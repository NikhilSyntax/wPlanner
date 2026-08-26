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
} from '@mui/icons-material';
import api from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ChordSheetViewer from '../components/common/ChordSheetViewer';

function SongDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);

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
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2.5 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/songs')}
          sx={{ textTransform: 'none', color: 'text.secondary', fontWeight: 600 }}
        >
          Song Database
        </Button>

        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            component={Link}
            to={`/songs/${id}/edit`}
            sx={{ textTransform: 'none', borderRadius: 2 }}
          >
            Edit Song
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleDelete}
            sx={{ textTransform: 'none', borderRadius: 2 }}
          >
            Delete
          </Button>
        </Stack>
      </Stack>

      {/* Song Metadata Card */}
      <Card sx={{ borderRadius: 3, mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
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
              {song.usage?.timesPerformed > 0 && (
                <Chip
                  icon={<HistoryIcon />}
                  label={`${song.usage.timesPerformed} performed`}
                  size="small"
                  onClick={() => setHistoryDialogOpen(true)}
                  clickable
                  color="primary"
                  variant="outlined"
                  sx={{ fontWeight: 600 }}
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
          rawContent={songContent}
          originalKey={song.key || 'C'}
          title={song.title}
          artist={song.artist}
          bpm={song.bpm}
          timeSignature={song.timeSignature}
          onEdit={() => navigate(`/songs/${id}/edit`)}
        />
      </Box>

      {/* Performance History Dialog */}
      <Dialog
        open={historyDialogOpen}
        onClose={() => setHistoryDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          Song Performance History: <span style={{ color: '#2563eb' }}>{song.title}</span>
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
                  </TableRow>
                </TableHead>
                <TableBody>
                  {song.usage.usageHistory
                    .sort((a, b) => new Date(b.usedAt) - new Date(a.usedAt))
                    .map((usage, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {usage.eventTitle || 'Worship Service'}
                          </Typography>
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
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
              This song has not been scheduled in any worship events yet.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setHistoryDialogOpen(false)} variant="outlined">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default SongDetails;
