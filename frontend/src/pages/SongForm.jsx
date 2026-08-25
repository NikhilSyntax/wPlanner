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
    lyrics: '',
    chords: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isEdit) fetchSong();
  }, [id]);

  const fetchSong = async () => {
    try {
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
        lyrics: song.content?.lyrics || '',
        chords: song.content?.chords || '',
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
      genre: form.genre.split(',').map((g) => g.trim()).filter(Boolean),
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      content: { lyrics: form.lyrics, chords: form.chords },
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

  const keyOptions = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

  return (
    <Box className="form-page">
      {/* Header */}
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <IconButton onClick={handleCancel} sx={{ mr: 1 }}>
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
            {isEdit ? 'Edit Song' : 'Add New Song'}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {isEdit ? 'Update song details and chords' : 'Add a new song to your worship bank'}
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
          <Grid item xs={12} lg={8}>
            <Card sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Box display="flex" alignItems="center" gap={2} mb={3}>
                  <MusicNoteIcon color="primary" />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Song Details
                  </Typography>
                </Box>

                <Grid container spacing={3}>
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
                          <MenuItem key={k} value={k}>{k}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="BPM"
                      name="bpm"
                      type="number"
                      value={form.bpm}
                      onChange={handleChange}
                      variant="outlined"
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
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


                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Tags (comma-separated)"
                      name="tags"
                      value={form.tags}
                      onChange={handleChange}
                      variant="outlined"
                      helperText="e.g. Upbeat, Slow, Easter, Christmas"
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Lyrics & Chords */}
          <Grid item xs={12} lg={4}>
            <Card sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                  Lyrics & Chords
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <TextField
                    fullWidth
                    multiline
                    rows={8}
                    label="Lyrics"
                    name="lyrics"
                    value={form.lyrics}
                    onChange={handleChange}
                    variant="outlined"
                    placeholder="Enter song lyrics..."
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />

                  <TextField
                    fullWidth
                    multiline
                    rows={8}
                    label="Chords"
                    name="chords"
                    value={form.chords}
                    onChange={handleChange}
                    variant="outlined"
                    placeholder="Enter chord progression..."
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Form Actions */}
        <Card sx={{ borderRadius: 3, mt: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Divider sx={{ mb: 3 }} />
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
