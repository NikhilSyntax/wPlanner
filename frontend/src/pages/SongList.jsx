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
} from '@mui/icons-material';
import DataTable from '../components/common/DataTable';
import LoadingSpinner from '../components/common/LoadingSpinner';

function SongList() {
  const navigate = useNavigate();
  const location = useLocation();
  const [tabIndex, setTabIndex] = useState(0);
  const [songs, setSongs] = useState([]);
  const [filters, setFilters] = useState({ title: '', artist: '', key: '' });
  const [loading, setLoading] = useState(true);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedSongHistory, setSelectedSongHistory] = useState(null);

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
            <Typography variant="caption" color="text.secondary">
              Never used
            </Typography>
          );
        }
        const d = new Date(lastUsed);
        if (Number.isNaN(d.getTime())) {
          return (
            <Typography variant="caption" color="text.secondary">
              Never used
            </Typography>
          );
        }
        return (
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

        <Box sx={{ display: 'flex', gap: 1 }}>
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
            onClick={() => setTabIndex(1)}
            sx={{ borderRadius: 2 }}
          >
            Add New Song
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
          onSave={() => {
            setTabIndex(0);
            fetchSongs();
          }}
          onClose={() => setTabIndex(0)}
        />
      )}

      {/* Usage History Dialog */}
      <Dialog
        open={historyDialogOpen}
        onClose={() => setHistoryDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          Song Performance History: <span style={{ color: '#2563eb' }}>{selectedSongHistory?.title}</span>
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
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedSongHistory.usage.usageHistory
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
                            label={`Key of ${usage.key || selectedSongHistory.key || 'C'}`}
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

export default SongList;
