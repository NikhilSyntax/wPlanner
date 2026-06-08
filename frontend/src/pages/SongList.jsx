import React, { useState, useEffect } from 'react';
import axios from 'axios';
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
} from '@mui/material';
import SongForm from '../pages/SongForm';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
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
      const token = localStorage.getItem('accessToken');
      const params = {};
      if (filters.title) params.title = filters.title;
      if (filters.artist) params.artist = filters.artist;
      if (filters.key) params.key = filters.key;
      const res = await axios.get('/api/songs', {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      setSongs(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this song?')) {
      try {
        const token = localStorage.getItem('accessToken');
        await axios.delete(`/api/songs/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        fetchSongs(); // refresh list
      } catch (err) {
        console.error(err);
        alert('Error deleting song');
      }
    }
  };

  const handleOpenHistory = async (song) => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await axios.get(`/api/songs/${song._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSelectedSongHistory(res.data);
      setHistoryDialogOpen(true);
    } catch (err) {
      console.error(err);
      setSelectedSongHistory(song);
      setHistoryDialogOpen(true);
    }
  };

  // Apply filters locally (or server-side, but we already passed params)
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

  if (loading) return <LoadingSpinner />;

  const columns = [
    {
      field: 'title',
      headerName: 'Title',
      render: (value, row) => (
        <Box display="inline-flex" alignItems="baseline" gap={1} flexWrap="wrap">
          <Typography variant="body2">{row.title}</Typography>
          {row.timeSignature && (
            <Typography variant="caption" color="text.secondary">
              {row.timeSignature}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      field: 'key',
      headerName: 'Key',
      render: (value, row) => (
        <Typography variant="body2">{row.key}</Typography>
      ),
    },
    {
      field: 'lastUsed',
      headerName: 'Last Used',
      render: (value, row) => {
        const lastUsed = row.usage?.lastPerformed;
        if (!lastUsed) {
          return (
            <Typography variant="body2" color="text.secondary">
              Never
            </Typography>
          );
        }
        return (
          <Tooltip title="Click to view usage history">
            <Typography
              variant="body2"
              sx={{
                color: 'primary.main',
                cursor: 'pointer',
                textDecoration: 'underline',
                '&:hover': { fontWeight: 600 },
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleOpenHistory(row);
              }}
            >
              {new Date(lastUsed).toLocaleDateString()}
            </Typography>
          </Tooltip>
        );
      },
    },
    {
      field: 'timesUsed',
      headerName: 'Times Used',
      render: (value, row) => (
        <Typography variant="body2">
          {row.usage?.timesPerformed || 0}
        </Typography>
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      render: (value, row) => (
        <Box display="flex" gap={1} onClick={(e) => e.stopPropagation()}>
          <Tooltip title="Edit Song">
            <IconButton
              component={Link}
              to={`/songs/${row._id}/edit`}
              size="small"
              color="secondary"
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete Song">
            <IconButton
              onClick={() => handleDelete(row._id)}
              size="small"
              color="error"
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box className="list-page" sx={{ p: 2 }}>
      {/* Header */}
      <Box mb={3}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              Song Bank
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage your worship songs
            </Typography>
          </Box>
        </Box>
        <Tabs
          value={tabIndex}
          onChange={(e, newVal) => setTabIndex(newVal)}
          sx={{ mt: 2 }}
        >
          <Tab label="Songs" />
          <Tab label="Add New Song" />
        </Tabs>
      </Box>

      {tabIndex === 0 && (
        <>
          {/* Filters */}
          <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                mb: 3,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <FilterIcon />
              Filters
            </Typography>
            <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
              <TextField
                placeholder="Search title..."
                value={filters.title}
                onChange={(e) =>
                  setFilters({ ...filters, title: e.target.value })
                }
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
                sx={{ minWidth: 200 }}
                size="small"
              />
              <FormControl sx={{ minWidth: 150 }} size="small">
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
                  ].map((k) => (
                    <MenuItem key={k} value={k}>
                      {k}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Paper>

          {/* Songs Table */}
          <DataTable
            columns={columns}
            data={filteredSongs}
            title="Songs"
            actions={false}
            onRowClick={(row) => navigate(`/songs/${row._id}`)}
          />
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
        <DialogTitle>
          Song Usage History: <strong>{selectedSongHistory?.title}</strong>
        </DialogTitle>
        <DialogContent>
          {selectedSongHistory?.usage?.usageHistory &&
          selectedSongHistory.usage.usageHistory.length > 0 ? (
            <TableContainer sx={{ mt: 2 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: 'action.hover' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Event</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Date Used</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedSongHistory.usage.usageHistory
                    .sort((a, b) => new Date(b.usedAt) - new Date(a.usedAt))
                    .map((usage, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Typography variant="body2">
                            {usage.eventTitle || 'Unknown Event'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {new Date(usage.usedAt).toLocaleDateString(
                              'en-US',
                              {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              }
                            )}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              This song has never been used in an event.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default SongList;
