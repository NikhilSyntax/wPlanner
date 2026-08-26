import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Grid,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  IconButton,
  Alert,
  Divider,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  MusicNote as MusicNoteIcon,
  LibraryMusic as LibraryMusicIcon,
} from '@mui/icons-material';

function SongForm({ onSave, onClose }) {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: '',
    artist: '',
    album: '',
    year: '',
    key: 'C',
    bpm: '',
    timeSignature: '4/4',
    genre: '',
    tags: '',
    chords: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isEdit) fetchSong();
  }, [id]);

  const fetchSong = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/songs/${id}`);
      const song = res.data;
      setForm({
        title: song.title || '',
        artist: song.artist || '',
        album: song.album || '',
        year: song.year || '',
        key: song.key || 'C',
        bpm: song.bpm || '',
        timeSignature: song.timeSignature || '4/4',
        genre: (song.genre || []).join(', '),
        tags: (song.tags || []).join(', '),
        chords: song.content?.chords || song.content?.lyrics || '',
      });
    } catch (err) {
      console.error(err);
      setError('Failed to fetch song details');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      ...form,
      year: form.year ? parseInt(form.year) : undefined,
      bpm: form.bpm ? parseInt(form.bpm) : undefined,
      genre: form.genre ? form.genre.split(',').map((g) => g.trim()).filter(Boolean) : [],
      tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      content: { chords: form.chords },
    };

    try {
      if (isEdit) {
        await api.put(`/songs/${id}`, payload);
      } else {
        await api.post('/songs', payload);
      }
      if (onSave) {
        onSave();
      } else {
        navigate('/songs');
      }
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.message || 'Error saving song. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (onClose) {
      onClose();
    } else {
      navigate('/songs');
    }
  };

  const keyOptions = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  return (
    <Box className="form-page" sx={{ maxWidth: 1100, mx: 'auto', pb: 5 }}>
      {/* Header */}
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <IconButton onClick={handleCancel} sx={{ mr: 1 }}>
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 0.5 }}>
            {isEdit ? 'Edit Song' : 'Add New Song'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isEdit ? 'Update song metadata and chord progression' : 'Add a new worship song to your bank'}
          </Typography>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          {/* Basic Information */}
          <Grid item xs={12} lg={6}>
            <Card sx={{ borderRadius: 3, height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Box display="flex" alignItems="center" gap={1.5} mb={3}>
                  <MusicNoteIcon color="primary" />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Song Metadata
                  </Typography>
                </Box>

                <Grid container spacing={2.5}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Title"
                      name="title"
                      value={form.title}
                      onChange={handleChange}
                      required
                      variant="outlined"
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Artist / Author"
                      name="artist"
                      value={form.artist}
                      onChange={handleChange}
                      variant="outlined"
                      placeholder="e.g. Hillsong Worship, Bethel"
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Album"
                      name="album"
                      value={form.album}
                      onChange={handleChange}
                      variant="outlined"
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth>
                      <InputLabel>Original Key</InputLabel>
                      <Select
                        name="key"
                        value={form.key}
                        label="Original Key"
                        onChange={handleChange}
                        sx={{ borderRadius: 2 }}
                      >
                        {keyOptions.map((k) => (
                          <MenuItem key={k} value={k}>
                            {k}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="Tempo (BPM)"
                      name="bpm"
                      type="number"
                      value={form.bpm}
                      onChange={handleChange}
                      placeholder="e.g. 72"
                      variant="outlined"
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth>
                      <InputLabel>Time Signature</InputLabel>
                      <Select
                        name="timeSignature"
                        value={form.timeSignature}
                        label="Time Signature"
                        onChange={handleChange}
                        sx={{ borderRadius: 2 }}
                      >
                        {['2/4', '3/4', '4/4', '5/4', '6/8', '7/8'].map((ts) => (
                          <MenuItem key={ts} value={ts}>
                            {ts}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Release Year"
                      name="year"
                      type="number"
                      value={form.year}
                      onChange={handleChange}
                      placeholder="e.g. 2023"
                      variant="outlined"
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Genre (comma-separated)"
                      name="genre"
                      value={form.genre}
                      onChange={handleChange}
                      placeholder="e.g. Contemporary, Hymn, Gospel"
                      variant="outlined"
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Tags (comma-separated)"
                      name="tags"
                      value={form.tags}
                      onChange={handleChange}
                      variant="outlined"
                      helperText="e.g. Praise, Communion, Offering, Easter"
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Chords Sheet Entry */}
          <Grid item xs={12} lg={6}>
            <Card sx={{ borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Box display="flex" alignItems="center" gap={1.5} mb={2}>
                  <LibraryMusicIcon color="primary" />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Chords & Sheet
                  </Typography>
                </Box>

                <TextField
                  fullWidth
                  multiline
                  rows={15}
                  label="Chords Progression & Lyrics"
                  name="chords"
                  value={form.chords}
                  onChange={handleChange}
                  variant="outlined"
                  placeholder={`[Verse 1]\nG            C           G\nAmazing grace how sweet the sound\nEm          D\nThat saved a wretch like me\n\n[Chorus]\nC             G\nMy chains are gone`}
                  helperText="Format: Section tags ([Verse 1], [Chorus]) with chords placed directly above lyrics"
                  sx={{
                    flex: 1,
                    '& .MuiOutlinedInput-root': { borderRadius: 2 },
                    '& textarea': {
                      fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace',
                      fontSize: '0.88rem',
                      lineHeight: 1.6,
                    },
                  }}
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Form Actions */}
        <Card sx={{ borderRadius: 3, mt: 3 }}>
          <CardContent sx={{ p: 2.5 }}>
            <Box display="flex" gap={2} justifyContent="flex-end">
              <Button
                variant="outlined"
                onClick={handleCancel}
                startIcon={<CancelIcon />}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  px: 3,
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                startIcon={<SaveIcon />}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  px: 3,
                  minWidth: 120,
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
                }}
              >
                {loading ? 'Saving...' : isEdit ? 'Update Song' : 'Create Song'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </form>
    </Box>
  );
}

export default SongForm;
