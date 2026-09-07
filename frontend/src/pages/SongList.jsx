import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  IconButton,
  Paper,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Card,
  CardContent,
  Stack,
  Snackbar,
  Alert,
} from '@mui/material';
import SongForm from '../pages/SongForm';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Add as AddIcon,
  MusicNote as MusicNoteIcon,
  History as HistoryIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Clear as ClearIcon,
  CalendarMonth as EditCalendarIcon,
  DeleteOutline as DeleteOutlineIcon,
  CloudDownload as ImportIcon,
} from '@mui/icons-material';
import DataTable from '../components/common/DataTable';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useAuth } from '../hooks/useAuth';
import ImportSongModal from '../components/songs/ImportSongModal';

function SongList() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const isAdmin = Boolean(
    user?.isAdmin ||
    user?.isSubAdmin ||
    user?.role === 'Admin' ||
    user?.role === 'admin' ||
    user?.roles?.includes('admin') ||
    user?.role === 'team_leader'
  );

  const [tabIndex, setTabIndex] = useState(0);
  const [songs, setSongs] = useState([]);
  const [filters, setFilters] = useState({ title: '', artist: '', key: '' });
  const [loading, setLoading] = useState(true);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedSongHistory, setSelectedSongHistory] = useState(null);

  // Edit Last Used Dialog State
  const [editLastUsedOpen, setEditLastUsedOpen] = useState(false);
  const [selectedSongForEdit, setSelectedSongForEdit] = useState(null);
  const [lastUsedDate, setLastUsedDate] = useState('');
  const [lastUsedEventTitle, setLastUsedEventTitle] = useState('');
  const [lastUsedKey, setLastUsedKey] = useState('C');
  const [lastUsedNotes, setLastUsedNotes] = useState('');
  const [savingLastUsed, setSavingLastUsed] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importedSongForEditor, setImportedSongForEditor] = useState(null);

  useEffect(() => {
    fetchSongs();
  }, [location.pathname]);

  const fetchSongs = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.title) params.title = filters.title;
      if (filters.artist) params.artist = filters.artist;
      if (filters.key) params.key = filters.key;
      const res = await api.get('/songs', { params });
      setSongs(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this song from your church song bank?')) {
      try {
        await api.delete(`/songs/${id}`);
        fetchSongs();
      } catch (err) {
        console.error(err);
        alert('Error deleting song');
      }
    }
  };

  const handleOpenHistory = async (song) => {
    try {
      const res = await api.get(`/songs/${song._id}`);
      setSelectedSongHistory(res.data);
      setHistoryDialogOpen(true);
    } catch (err) {
      console.error(err);
      setSelectedSongHistory(song);
      setHistoryDialogOpen(true);
    }
  };

  const handleOpenEditLastUsed = (song) => {
    setSelectedSongForEdit(song);
    // Pre-fill with existing lastPerformed or today's date formatted as YYYY-MM-DD
    const existingDate = song.usage?.lastPerformed ? new Date(song.usage.lastPerformed) : new Date();
    const yyyy = existingDate.getFullYear();
    const mm = String(existingDate.getMonth() + 1).padStart(2, '0');
    const dd = String(existingDate.getDate()).padStart(2, '0');
    setLastUsedDate(`${yyyy}-${mm}-${dd}`);
    setLastUsedEventTitle('');
    setLastUsedKey(song.key || 'C');
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
      const res = await api.put(`/songs/${selectedSongForEdit._id}/usage`, {
        action: 'setLastUsed',
        lastPerformed: new Date(lastUsedDate).toISOString(),
        eventTitle: lastUsedEventTitle.trim() || 'Worship Service',
        key: lastUsedKey,
        notes: lastUsedNotes.trim(),
      });

      setSongs((prev) =>
        prev.map((s) => (s._id === selectedSongForEdit._id ? res.data : s))
      );
      if (selectedSongHistory && selectedSongHistory._id === selectedSongForEdit._id) {
        setSelectedSongHistory(res.data);
      }
      setToastMessage(`Last used date updated for "${selectedSongForEdit.title}"`);
      setEditLastUsedOpen(false);
    } catch (err) {
      console.error('Error saving last used date:', err);
      alert(err.response?.data?.message || 'Failed to update last used date.');
    } finally {
      setSavingLastUsed(false);
    }
  };

  const handleClearLastUsed = async () => {
    if (!window.confirm(`Clear last used date for "${selectedSongForEdit?.title}"?`)) {
      return;
    }
    try {
      setSavingLastUsed(true);
      const res = await api.put(`/songs/${selectedSongForEdit._id}/usage`, {
        action: 'clearLastUsed',
        clearManualHistory: true,
      });
      setSongs((prev) =>
        prev.map((s) => (s._id === selectedSongForEdit._id ? res.data : s))
      );
      if (selectedSongHistory && selectedSongHistory._id === selectedSongForEdit._id) {
        setSelectedSongHistory(res.data);
      }
      setToastMessage(`Cleared last used date for "${selectedSongForEdit.title}"`);
      setEditLastUsedOpen(false);
    } catch (err) {
      console.error('Error clearing last used date:', err);
      alert('Failed to clear last used date.');
    } finally {
      setSavingLastUsed(false);
    }
  };

  const handleDeleteHistoryEntry = async (songId, usageId) => {
    if (!window.confirm('Remove this performance entry?')) return;
    try {
      const res = await api.put(`/songs/${songId}/usage`, {
        action: 'deleteUsage',
        usageId,
      });
      setSongs((prev) => prev.map((s) => (s._id === songId ? res.data : s)));
      setSelectedSongHistory(res.data);
      setToastMessage('Performance record removed.');
    } catch (err) {
      console.error(err);
      alert('Failed to remove performance entry.');
    }
  };

  const filteredSongs = songs.filter((song) => {
    if (
      filters.title &&
      !song.title.toLowerCase().includes(filters.title.toLowerCase())
    )
      return false;
    if (
      filters.artist &&
      !(song.artist || '').toLowerCase().includes(filters.artist.toLowerCase())
    )
      return false;
    if (filters.key && song.key !== filters.key) return false;
    return true;
  });

  const columns = [
    {
      field: 'title',
      headerName: 'Song Title & Artist',
      render: (value, row) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: 1.5,
              bgcolor: 'rgba(37, 99, 235, 0.08)',
              color: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <MusicNoteIcon sx={{ fontSize: 18 }} />
          </Box>
          <Box>
            <Typography variant="body2" fontWeight={600} color="text.primary">
              {row.title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {row.artist || 'Original / Unspecified'}
            </Typography>
          </Box>
        </Box>
      ),
    },
    {
      field: 'key',
      headerName: 'Key',
      render: (value, row) => (
        <Chip
          label={row.key || 'C'}
          size="small"
          sx={{
            fontWeight: 700,
            fontSize: '0.75rem',
            bgcolor: 'rgba(245, 158, 11, 0.1)',
            color: '#d97706',
            border: '1px solid rgba(245, 158, 11, 0.25)',
          }}
        />
      ),
    },
    {
      field: 'bpm',
      headerName: 'Tempo',
      render: (value, row) => {
        const bpmVal = row.bpm || row.tempo || value;
        return (
          <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', fontWeight: 500 }}>
            {bpmVal ? `${bpmVal} BPM` : '—'}
          </Typography>
        );
      },
    },
    {
      field: 'lastUsed',
      headerName: 'Last Used',
      render: (value, row) => {
        const lastUsed = row.usage?.lastPerformed;
        if (!lastUsed) {
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                Never used
              </Typography>
              {isAdmin && (
                <Tooltip title="Set when song was used">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEditLastUsed(row);
                    }}
                    sx={{
                      p: 0.35,
                      color: 'primary.main',
                      bgcolor: 'rgba(37, 99, 235, 0.08)',
                      '&:hover': { bgcolor: 'rgba(37, 99, 235, 0.18)' },
                    }}
                  >
                    <EditCalendarIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          );
        }
        const d = new Date(lastUsed);
        if (Number.isNaN(d.getTime())) {
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                Never used
              </Typography>
              {isAdmin && (
                <Tooltip title="Set when song was used">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEditLastUsed(row);
                    }}
                    sx={{ p: 0.35, color: 'primary.main' }}
                  >
                    <EditCalendarIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          );
        }
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Tooltip title="View performance history">
              <Chip
                icon={<HistoryIcon sx={{ fontSize: '14px !important' }} />}
                label={d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenHistory(row);
                }}
                clickable
                variant="outlined"
                sx={{ fontSize: '0.75rem', fontWeight: 500 }}
              />
            </Tooltip>
            {isAdmin && (
              <Tooltip title="Edit when song was used">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenEditLastUsed(row);
                  }}
                  sx={{
                    p: 0.35,
                    color: 'text.secondary',
                    '&:hover': { color: 'primary.main', bgcolor: 'rgba(37, 99, 235, 0.08)' },
                  }}
                >
                  <EditCalendarIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        );
      },
    },
    {
      field: 'timesUsed',
      headerName: 'Total Plays',
      render: (value, row) => (
        <Chip
          label={`${row.usage?.timesPerformed || 0}x`}
          size="small"
          sx={{
            fontSize: '0.75rem',
            fontWeight: 600,
            bgcolor: 'action.hover',
          }}
        />
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      render: (value, row) => (
        <Box display="flex" gap={0.5} onClick={(e) => e.stopPropagation()}>
          <Tooltip title="Edit Song Chords & Details">
            <IconButton
              component={Link}
              to={`/songs/${row._id}/edit`}
              size="small"
              sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete Song">
            <IconButton
              onClick={() => handleDelete(row._id)}
              size="small"
              sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box className="fade-in">
      {/* Header Banner */}
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h4" fontWeight={700} sx={{ letterSpacing: '-0.02em' }}>
            Song Bank
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Your church&apos;s exclusive song repository, chord charts, and lyrics.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant={tabIndex === 0 ? 'contained' : 'outlined'}
            onClick={() => setTabIndex(0)}
            sx={{ borderRadius: 2 }}
          >
            All Songs ({songs.length})
          </Button>
          <Button
            variant={tabIndex === 1 ? 'contained' : 'outlined'}
            startIcon={<AddIcon />}
            onClick={() => {
              setImportedSongForEditor(null);
              setTabIndex(1);
            }}
            sx={{ borderRadius: 2 }}
          >
            Add New Song
          </Button>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<ImportIcon />}
            onClick={() => setImportModalOpen(true)}
            sx={{ borderRadius: 2 }}
          >
            Import Song
          </Button>
        </Box>
      </Box>

      {tabIndex === 0 && (
        <>
          {/* Filter Toolbar */}
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              mb: 3,
              borderRadius: 2.5,
              bgcolor: 'background.paper',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', flex: 1 }}>
              <TextField
                placeholder="Search song title or lyrics..."
                value={filters.title}
                onChange={(e) =>
                  setFilters({ ...filters, title: e.target.value })
                }
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
                sx={{ minWidth: { xs: '100%', sm: 260 } }}
                size="small"
              />

              <TextField
                placeholder="Filter by artist..."
                value={filters.artist}
                onChange={(e) =>
                  setFilters({ ...filters, artist: e.target.value })
                }
                sx={{ minWidth: { xs: '100%', sm: 180 } }}
                size="small"
              />

              <FormControl sx={{ minWidth: 120 }} size="small">
                <InputLabel>Key</InputLabel>
                <Select
                  value={filters.key}
                  label="Key"
                  onChange={(e) =>
                    setFilters({ ...filters, key: e.target.value })
                  }
                >
                  <MenuItem value="">All Keys</MenuItem>
                  {[
                    'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
                  ].map((k) => (
                    <MenuItem key={k} value={k}>
                      Key of {k}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {(filters.title || filters.artist || filters.key) && (
                <Button
                  size="small"
                  variant="text"
                  startIcon={<ClearIcon />}
                  onClick={() => setFilters({ title: '', artist: '', key: '' })}
                  sx={{ color: 'text.secondary' }}
                >
                  Reset
                </Button>
              )}
            </Box>

            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              Showing {filteredSongs.length} of {songs.length} songs
            </Typography>
          </Paper>

          {/* Songs Data Table */}
          {loading ? (
            <LoadingSpinner />
          ) : (
            <DataTable
              columns={columns}
              data={filteredSongs}
              title="Church Songs"
              actions={false}
              onRowClick={(row) => navigate(`/songs/${row._id}`)}
            />
          )}
        </>
      )}

      {tabIndex === 1 && (
        <SongForm
          initialData={importedSongForEditor}
          onSave={() => {
            setImportedSongForEditor(null);
            setTabIndex(0);
            fetchSongs();
          }}
          onClose={() => {
            setImportedSongForEditor(null);
            setTabIndex(0);
          }}
        />
      )}

      {/* Usage History Dialog */}
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
              {selectedSongHistory?.title}
            </Typography>
          </Box>
          {isAdmin && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<EditCalendarIcon sx={{ fontSize: 15 }} />}
              onClick={() => {
                setHistoryDialogOpen(false);
                handleOpenEditLastUsed(selectedSongHistory);
              }}
              sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem', borderRadius: 1.5 }}
            >
              Record / Edit Date
            </Button>
          )}
        </DialogTitle>
        <DialogContent dividers>
          {selectedSongHistory?.usage?.usageHistory &&
          selectedSongHistory.usage.usageHistory.length > 0 ? (
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
                  {selectedSongHistory.usage.usageHistory
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
                            label={`Key of ${usage.key || selectedSongHistory.key || 'C'}`}
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
                                  onClick={() => handleDeleteHistoryEntry(selectedSongHistory._id, usage._id)}
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
              {selectedSongForEdit?.title} {selectedSongForEdit?.artist ? `• ${selectedSongForEdit.artist}` : ''}
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
              placeholder="e.g. Led by guest team, special arrangement"
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
          {selectedSongForEdit?.usage?.lastPerformed ? (
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

      {/* Ultimate Guitar Song Import Modal */}
      <ImportSongModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImportToEditor={(imported) => {
          setImportModalOpen(false);
          if (imported.existingSongId) {
            navigate(`/songs/${imported.existingSongId}/edit`, { state: { importedSong: imported } });
          } else {
            setImportedSongForEditor(imported);
            setTabIndex(1);
          }
        }}
        onSongSaved={(savedSong) => {
          fetchSongs();
          setToastMessage(`Song "${savedSong.title}" saved successfully to library!`);
        }}
      />

      {/* Action Feedback Toast */}
      <Snackbar
        open={Boolean(toastMessage)}
        autoHideDuration={3500}
        onClose={() => setToastMessage('')}
        message={toastMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}

export default SongList;
