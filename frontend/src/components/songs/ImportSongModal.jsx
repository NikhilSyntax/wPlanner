import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
  Button,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
  Chip,
  Paper,
  Stack,
  IconButton,
  Tooltip,
  Divider,
  Rating,
} from '@mui/material';
import {
  Close as CloseIcon,
  CloudDownload as ImportIcon,
  ContentPaste as PasteIcon,
  Search as SearchIcon,
  CheckCircle as CheckCircleIcon,
  WarningAmber as WarningIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Link as LinkIcon,
  Star as StarIcon,
  LibraryMusic as LibraryMusicIcon,
} from '@mui/icons-material';
import api from '../../services/api';

export default function ImportSongModal({
  open,
  onClose,
  targetSongId,
  targetSongTitle,
  onImportToEditor,
  onSongSaved,
}) {
  // Tab Navigation: 0 = Search, 1 = Direct URL, 2 = Manual Paste Fallback
  const [tabIndex, setTabIndex] = useState(0);

  // Search State
  const [searchTitle, setSearchTitle] = useState('');
  const [searchArtist, setSearchArtist] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [importingResultId, setImportingResultId] = useState(null);

  // URL Import State
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  // Fallback Paste State
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteArtist, setPasteArtist] = useState('');
  const [pasteKey, setPasteKey] = useState('C');
  const [pasteContent, setPasteContent] = useState('');

  // Shared Preview & Error State
  const [error, setError] = useState('');
  const [previewSong, setPreviewSong] = useState(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [existingSong, setExistingSong] = useState(null);
  const [savingDirectly, setSavingDirectly] = useState(false);

  const resetState = () => {
    setUrl('');
    setError('');
    setLoading(false);
    setSearching(false);
    setSearchTitle('');
    setSearchArtist('');
    setSearchResults([]);
    setHasSearched(false);
    setImportingResultId(null);
    setPreviewSong(null);
    setIsDuplicate(false);
    setExistingSong(null);
    setPasteTitle('');
    setPasteArtist('');
    setPasteKey('C');
    setPasteContent('');
    setSavingDirectly(false);
    setTabIndex(0);
  };

  const handleClose = () => {
    resetState();
    if (onClose) onClose();
  };

  // -------------------------------------------------------------
  // TAB 0: Search Ultimate Guitar
  // -------------------------------------------------------------
  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    const query = [searchTitle.trim(), searchArtist.trim()].filter(Boolean).join(' ');

    if (!query) {
      setError('Please enter a song title or artist to search.');
      return;
    }

    try {
      setSearching(true);
      setError('');
      setHasSearched(true);
      setSearchResults([]);

      const res = await api.get('/songs/import/search', {
        params: { q: query },
      });

      const list = res.data?.results || [];
      setSearchResults(list);
    } catch (err) {
      console.error('Ultimate Guitar search error:', err);
      const msg =
        err.response?.data?.message ||
        'Unable to search Ultimate Guitar right now. You can paste the direct tab URL or paste chords manually.';
      setError(msg);
    } finally {
      setSearching(false);
    }
  };

  // -------------------------------------------------------------
  // Import a Selected Search Result
  // -------------------------------------------------------------
  const handleImportFromResult = async (item) => {
    if (!item?.url) {
      setError('Selected result does not have a valid tab URL.');
      return;
    }

    try {
      setImportingResultId(item.id);
      setError('');

      const res = await api.post('/songs/import', { url: item.url });
      const { song, isDuplicate: dup, existingSong: existing } = res.data;

      setPreviewSong(song);
      setIsDuplicate(Boolean(dup || item.inLibrary));
      setExistingSong(existing || (item.inLibrary ? { _id: item.existingSongId, title: item.existingSongTitle } : null));
    } catch (err) {
      console.error('Import from result error:', err);
      const msg =
        err.response?.data?.message ||
        'Failed to import this chord chart. It may be restricted or temporarily unavailable.';
      setError(msg);
    } finally {
      setImportingResultId(null);
    }
  };

  // -------------------------------------------------------------
  // TAB 1: Import via Direct URL
  // -------------------------------------------------------------
  const handleImportUrl = async (e) => {
    if (e) e.preventDefault();
    const cleanUrl = url.trim();

    if (!cleanUrl) {
      setError('Please enter an Ultimate Guitar song URL.');
      return;
    }

    if (!cleanUrl.includes('ultimate-guitar.com') || !cleanUrl.includes('/tab/')) {
      setError(
        'Please enter a valid Ultimate Guitar chord/tab URL (e.g., https://tabs.ultimate-guitar.com/tab/...)'
      );
      return;
    }

    try {
      setLoading(true);
      setError('');

      const res = await api.post('/songs/import', { url: cleanUrl });
      const { song, isDuplicate: dup, existingSong: existing } = res.data;

      setPreviewSong(song);
      setIsDuplicate(Boolean(dup));
      setExistingSong(existing || null);
    } catch (err) {
      console.error('Import URL error:', err);
      const msg =
        err.response?.data?.message ||
        'Import failed. The external page may be temporarily unavailable. You can search or paste chords manually.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // TAB 2: Parse Paste Fallback
  // -------------------------------------------------------------
  const handleParsePaste = async (e) => {
    if (e) e.preventDefault();
    if (!pasteContent.trim()) {
      setError('Please paste chords and lyrics.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const res = await api.post('/songs/parse-raw', {
        title: pasteTitle.trim() || 'Pasted Song',
        artist: pasteArtist.trim() || 'Unknown Artist',
        key: pasteKey,
        chords: pasteContent.trim(),
      });

      setPreviewSong(res.data.song);
      setIsDuplicate(false);
      setExistingSong(null);
    } catch (err) {
      console.error('Parse paste error:', err);
      setError(err.response?.data?.message || 'Failed to parse pasted chords.');
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Actions on Preview: Edit in Editor or Save
  // -------------------------------------------------------------
  const handleEditInEditor = () => {
    if (!previewSong) return;
    if (onImportToEditor) {
      onImportToEditor(previewSong);
    }
    handleClose();
  };

  const handleSaveDirectly = async (forceNew = false) => {
    if (!previewSong) return;
    try {
      setSavingDirectly(true);
      setError('');

      const payload = {
        title: targetSongTitle || previewSong.title,
        artist: previewSong.artist,
        key: previewSong.key,
        bpm: previewSong.bpm,
        timeSignature: previewSong.timeSignature || '4/4',
        capo: previewSong.capo || 0,
        tuning: previewSong.tuning || 'Standard',
        source: previewSong.source || { type: 'external', provider: 'ultimate_guitar' },
        content: previewSong.content,
      };

      let res;
      const songIdToUpdate = !forceNew ? (targetSongId || (isDuplicate ? existingSong?._id : null)) : null;

      if (songIdToUpdate) {
        res = await api.put(`/songs/${songIdToUpdate}`, payload);
      } else {
        res = await api.post('/songs', payload);
      }

      if (onSongSaved) {
        onSongSaved(res.data);
      }
      handleClose();
    } catch (err) {
      console.error('Failed to save song:', err);
      setError(err.response?.data?.message || 'Failed to save song to library.');
    } finally {
      setSavingDirectly(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          bgcolor: 'background.paper',
        },
      }}
    >
      {/* Modal Header */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid',
          borderColor: 'divider',
          pb: 1.5,
        }}
      >
        <Box display="flex" alignItems="center" gap={1.5}>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: 2,
              bgcolor: 'rgba(37, 99, 235, 0.1)',
              color: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ImportIcon sx={{ fontSize: 22 }} />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              {previewSong
                ? 'Import Preview'
                : targetSongTitle
                ? `Import Chords: ${targetSongTitle}`
                : 'Import from Ultimate Guitar'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {previewSong
                ? targetSongId
                  ? `Review extracted chords before updating "${targetSongTitle}"`
                  : 'Review extracted chords before loading into editor or saving'
                : 'Search songs on Ultimate Guitar, choose a chord version, and import into your church library'}
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={handleClose} size="small" sx={{ color: 'text.secondary' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: { xs: 2, sm: 3 } }}>
        {error && (
          <Alert
            severity="error"
            sx={{ mb: 2.5, borderRadius: 2 }}
            action={
              tabIndex !== 2 && !previewSong ? (
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => {
                    setError('');
                    setTabIndex(2);
                  }}
                >
                  Paste Manually
                </Button>
              ) : null
            }
          >
            {error}
          </Alert>
        )}

        {/* -----------------------------------------------------------------
            VIEW 1: INPUT SCREEN (Search, Direct URL, or Fallback Paste)
            ----------------------------------------------------------------- */}
        {!previewSong && (
          <Box>
            {targetSongTitle && (
              <Alert
                severity="info"
                sx={{
                  mb: 2.5,
                  borderRadius: 2,
                  bgcolor: 'rgba(37, 99, 235, 0.08)',
                  borderColor: 'rgba(37, 99, 235, 0.25)',
                }}
              >
                Target Song: <strong>{targetSongTitle}</strong>. Chords and lyrics imported will update this song.
              </Alert>
            )}

            <Tabs
              value={tabIndex}
              onChange={(e, val) => {
                setTabIndex(val);
                setError('');
              }}
              sx={{ mb: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}
            >
              <Tab
                icon={<SearchIcon sx={{ fontSize: 18 }} />}
                iconPosition="start"
                label="Search Ultimate Guitar"
                sx={{ textTransform: 'none', fontWeight: 600 }}
              />
              <Tab
                icon={<LinkIcon sx={{ fontSize: 18 }} />}
                iconPosition="start"
                label="Direct Tab URL"
                sx={{ textTransform: 'none', fontWeight: 600 }}
              />
              <Tab
                icon={<PasteIcon sx={{ fontSize: 18 }} />}
                iconPosition="start"
                label="Paste Chords & Lyrics (Fallback)"
                sx={{ textTransform: 'none', fontWeight: 600 }}
              />
            </Tabs>

            {/* TAB 0: Search Ultimate Guitar (Primary Experience) */}
            {tabIndex === 0 && (
              <Box>
                <Box
                  component="form"
                  onSubmit={handleSearch}
                  sx={{
                    p: 2,
                    mb: 2.5,
                    bgcolor: 'action.hover',
                    borderRadius: 2.5,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
                    Search for a Song
                  </Typography>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center">
                    <TextField
                      fullWidth
                      size="small"
                      label="Song Title or Keywords"
                      placeholder="e.g. Goodness of God, Way Maker, Amazing Grace"
                      value={searchTitle}
                      onChange={(e) => setSearchTitle(e.target.value)}
                      disabled={searching || importingResultId !== null}
                      autoFocus
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                    <TextField
                      size="small"
                      label="Artist (optional)"
                      placeholder="e.g. Bethel Music, Chris Tomlin"
                      value={searchArtist}
                      onChange={(e) => setSearchArtist(e.target.value)}
                      disabled={searching || importingResultId !== null}
                      sx={{ minWidth: { xs: '100%', sm: 220 }, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={searching || !searchTitle.trim()}
                      startIcon={searching ? <CircularProgress size={16} color="inherit" /> : <SearchIcon />}
                      sx={{
                        borderRadius: 2,
                        textTransform: 'none',
                        px: 3,
                        py: 1,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        alignSelf: { xs: 'stretch', sm: 'center' },
                      }}
                    >
                      {searching ? 'Searching...' : 'Search'}
                    </Button>
                  </Stack>
                </Box>

                {/* Search Loading State */}
                {searching && (
                  <Box display="flex" flexDirection="column" alignItems="center" py={5} gap={1.5}>
                    <CircularProgress size={36} />
                    <Typography variant="body2" color="text.secondary" fontWeight={600}>
                      Searching Ultimate Guitar for chord charts...
                    </Typography>
                  </Box>
                )}

                {/* Empty State */}
                {!searching && hasSearched && searchResults.length === 0 && (
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 4,
                      textAlign: 'center',
                      borderRadius: 2.5,
                      bgcolor: 'background.default',
                    }}
                  >
                    <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                      No matching chord charts found
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 450, mx: 'auto', mb: 2 }}>
                      Try searching with just the main song title, or paste the exact tab link into the Direct Tab URL tab.
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => setTabIndex(1)}
                      startIcon={<LinkIcon />}
                      sx={{ borderRadius: 1.5, textTransform: 'none' }}
                    >
                      Use Direct Tab URL Instead
                    </Button>
                  </Paper>
                )}

                {/* Search Results List */}
                {!searching && searchResults.length > 0 && (
                  <Box>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                      <Typography variant="subtitle2" fontWeight={700} color="text.secondary">
                        {searchResults.length} CHORD VERSIONS FOUND
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Click &quot;Import&quot; to inspect & load chords
                      </Typography>
                    </Box>

                    <Stack spacing={1.5} sx={{ maxHeight: 420, overflowY: 'auto', pr: 0.5 }}>
                      {searchResults.map((item) => {
                        const isImportingThis = importingResultId === item.id;
                        return (
                          <Paper
                            key={item.id}
                            variant="outlined"
                            sx={{
                              p: 2,
                              borderRadius: 2,
                              display: 'flex',
                              flexDirection: { xs: 'column', sm: 'row' },
                              alignItems: { xs: 'flex-start', sm: 'center' },
                              justifyContent: 'space-between',
                              gap: 1.5,
                              transition: 'all 0.15s ease-in-out',
                              '&:hover': {
                                borderColor: 'primary.main',
                                bgcolor: 'rgba(37, 99, 235, 0.02)',
                              },
                            }}
                          >
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                                <Typography variant="subtitle1" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                                  {item.title}
                                </Typography>
                                <Chip
                                  label={`Ver ${item.version}`}
                                  size="small"
                                  sx={{ fontWeight: 700, fontSize: '0.7rem', height: 20 }}
                                />
                                {item.tonality && (
                                  <Chip
                                    label={`Key: ${item.tonality}`}
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                    sx={{ fontWeight: 700, fontSize: '0.7rem', height: 20 }}
                                  />
                                )}
                                {item.capo > 0 && (
                                  <Chip
                                    label={`Capo ${item.capo}`}
                                    size="small"
                                    variant="outlined"
                                    sx={{ fontWeight: 600, fontSize: '0.7rem', height: 20 }}
                                  />
                                )}
                                {item.inLibrary && (
                                  <Chip
                                    label="In Your Library"
                                    size="small"
                                    color="success"
                                    icon={<CheckCircleIcon />}
                                    sx={{ fontWeight: 700, fontSize: '0.7rem', height: 20 }}
                                  />
                                )}
                              </Box>

                              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                {item.artist}
                              </Typography>

                              {/* Rating & Votes */}
                              <Box display="flex" alignItems="center" gap={0.75} mt={0.75} flexWrap="wrap">
                                {item.rating ? (
                                  <>
                                    <Rating
                                      value={item.rating}
                                      precision={0.1}
                                      readOnly
                                      size="small"
                                      emptyIcon={<StarIcon fontSize="inherit" />}
                                    />
                                    <Typography variant="caption" fontWeight={700} color="text.primary">
                                      {item.rating.toFixed(1)}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      ({item.votes.toLocaleString()} votes)
                                    </Typography>
                                  </>
                                ) : (
                                  <Typography variant="caption" color="text.secondary">
                                    Community Chord Chart
                                  </Typography>
                                )}
                              </Box>

                              {item.versionDescription && (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                    mt: 0.5,
                                    fontStyle: 'italic',
                                  }}
                                >
                                  {item.versionDescription}
                                </Typography>
                              )}
                            </Box>

                            <Button
                              variant="contained"
                              color={item.inLibrary ? 'secondary' : 'primary'}
                              size="small"
                              disabled={importingResultId !== null}
                              onClick={() => handleImportFromResult(item)}
                              startIcon={
                                isImportingThis ? (
                                  <CircularProgress size={16} color="inherit" />
                                ) : (
                                  <ImportIcon />
                                )
                              }
                              sx={{
                                borderRadius: 2,
                                textTransform: 'none',
                                fontWeight: 700,
                                px: 2.5,
                                py: 0.75,
                                flexShrink: 0,
                                alignSelf: { xs: 'stretch', sm: 'center' },
                              }}
                            >
                              {isImportingThis ? 'Importing...' : 'Import'}
                            </Button>
                          </Paper>
                        );
                      })}
                    </Stack>
                  </Box>
                )}
              </Box>
            )}

            {/* TAB 1: Direct Tab URL */}
            {tabIndex === 1 && (
              <Box component="form" onSubmit={handleImportUrl}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Paste a direct Ultimate Guitar tab URL to extract the chords, lyrics, key, and tempo.
                </Typography>

                <TextField
                  fullWidth
                  label="Ultimate Guitar URL"
                  placeholder="https://tabs.ultimate-guitar.com/tab/bethel-music/goodness-of-god-chords-2423013"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={loading}
                  autoFocus
                  variant="outlined"
                  sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  helperText="Supported: tabs.ultimate-guitar.com/tab/..."
                />

                {loading && (
                  <Box display="flex" alignItems="center" gap={2} py={2}>
                    <CircularProgress size={24} />
                    <Typography variant="body2" color="primary.main" fontWeight={600}>
                      Importing song from Ultimate Guitar...
                    </Typography>
                  </Box>
                )}
              </Box>
            )}

            {/* TAB 2: Paste Chords & Lyrics (Fallback) */}
            {tabIndex === 2 && (
              <Box component="form" onSubmit={handleParsePaste}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  If external network access is restricted, you can paste chord and lyric text directly below.
                </Typography>

                <Stack spacing={2}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Song Title"
                      value={pasteTitle}
                      onChange={(e) => setPasteTitle(e.target.value)}
                      placeholder="e.g. Goodness of God"
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                    <TextField
                      fullWidth
                      size="small"
                      label="Artist"
                      value={pasteArtist}
                      onChange={(e) => setPasteArtist(e.target.value)}
                      placeholder="e.g. Bethel Music"
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                    <TextField
                      size="small"
                      label="Key"
                      value={pasteKey}
                      onChange={(e) => setPasteKey(e.target.value)}
                      sx={{ minWidth: 100, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                  </Stack>

                  <TextField
                    fullWidth
                    multiline
                    rows={10}
                    label="Chords & Lyrics Text"
                    value={pasteContent}
                    onChange={(e) => setPasteContent(e.target.value)}
                    placeholder={`[Verse 1]\nG              C           G\nAmazing grace, how sweet the sound\nEm          D\nThat saved a wretch like me`}
                    sx={{
                      '& .MuiOutlinedInput-root': { borderRadius: 2 },
                      '& textarea': {
                        fontFamily: '"SFMono-Regular", Consolas, Menlo, monospace',
                        fontSize: '0.85rem',
                      },
                    }}
                  />
                </Stack>
              </Box>
            )}
          </Box>
        )}

        {/* -----------------------------------------------------------------
            VIEW 2: IMPORT PREVIEW SCREEN
            ----------------------------------------------------------------- */}
        {previewSong && (
          <Box>
            {/* Duplicate Detection Alert */}
            {!targetSongId && isDuplicate && existingSong && (
              <Alert
                severity="warning"
                icon={<WarningIcon />}
                sx={{ mb: 2.5, borderRadius: 2 }}
              >
                <Typography variant="subtitle2" fontWeight={700}>
                  This song already exists in your church library.
                </Typography>
                <Typography variant="body2">
                  &quot;{existingSong.title}&quot; is already in your song bank. You can choose &quot;Update Existing&quot; or &quot;Create as New&quot;.
                </Typography>
              </Alert>
            )}

            {targetSongId ? (
              <Alert severity="info" icon={<CheckCircleIcon />} sx={{ mb: 2.5, borderRadius: 2 }}>
                Import successful! Ready to update <strong>{targetSongTitle || previewSong.title}</strong>. Click &quot;Update This Song&quot; to save directly, or &quot;Edit in Song Editor&quot; to review in your edit sheet first.
              </Alert>
            ) : (
              <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2.5, borderRadius: 2 }}>
                Song imported successfully! Review the metadata and chords below before editing or saving.
              </Alert>
            )}

            {/* Song Metadata Card */}
            <Paper
              variant="outlined"
              sx={{
                p: 2.5,
                mb: 2.5,
                borderRadius: 2.5,
                bgcolor: 'background.default',
              }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
                <Box>
                  <Typography variant="h5" fontWeight={800} color="text.primary">
                    {previewSong.title}
                  </Typography>
                  <Typography variant="subtitle2" color="text.secondary" fontWeight={500}>
                    {previewSong.artist || 'Unknown Artist'}
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Chip label={`Key: ${previewSong.key || 'C'}`} color="primary" size="small" sx={{ fontWeight: 700 }} />
                  {previewSong.capo > 0 && (
                    <Chip label={`Capo: ${previewSong.capo}`} variant="outlined" size="small" />
                  )}
                  {previewSong.tuning && previewSong.tuning !== 'Standard' && (
                    <Chip label={`Tuning: ${previewSong.tuning}`} variant="outlined" size="small" />
                  )}
                  {previewSong.bpm && (
                    <Chip label={`${previewSong.bpm} BPM`} variant="outlined" size="small" />
                  )}
                  {previewSong.sections?.length > 0 && (
                    <Chip label={`${previewSong.sections.length} Sections`} size="small" variant="outlined" />
                  )}
                </Stack>
              </Box>

              {previewSong.source?.url && (
                <Box display="flex" alignItems="center" gap={1} mt={1.5}>
                  <Typography variant="caption" color="text.secondary">
                    Source:
                  </Typography>
                  <Chip
                    label="Ultimate Guitar"
                    size="small"
                    component="a"
                    href={previewSong.source.url}
                    target="_blank"
                    rel="noreferrer"
                    clickable
                    sx={{ fontSize: '0.75rem', height: 22 }}
                  />
                </Box>
              )}
            </Paper>

            {/* Chords Progression Monospace Preview */}
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
              Chords & Lyrics Preview
            </Typography>

            <Paper
              variant="outlined"
              sx={{
                p: 2,
                maxHeight: 280,
                overflowY: 'auto',
                borderRadius: 2,
                bgcolor: '#0f172a',
                color: '#e2e8f0',
                fontFamily: '"SFMono-Regular", Consolas, Menlo, monospace',
                fontSize: '0.84rem',
                lineHeight: 1.6,
                whiteSpace: 'pre',
              }}
            >
              {previewSong.content?.chords || 'No chord lines parsed.'}
            </Paper>
          </Box>
        )}
      </DialogContent>

      {/* Modal Actions */}
      <DialogActions sx={{ p: 2.5, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button onClick={handleClose} sx={{ borderRadius: 2, textTransform: 'none', px: 2.5 }}>
          Cancel
        </Button>

        {!previewSong ? (
          tabIndex === 0 ? (
            // Search Tab: User can also trigger search via dialog action
            <Button
              variant="contained"
              onClick={handleSearch}
              disabled={searching || !searchTitle.trim()}
              startIcon={searching ? <CircularProgress size={16} color="inherit" /> : <SearchIcon />}
              sx={{ borderRadius: 2, textTransform: 'none', px: 3 }}
            >
              {searching ? 'Searching...' : 'Search'}
            </Button>
          ) : tabIndex === 1 ? (
            <Button
              variant="contained"
              onClick={handleImportUrl}
              disabled={loading || !url.trim()}
              startIcon={<ImportIcon />}
              sx={{ borderRadius: 2, textTransform: 'none', px: 3 }}
            >
              {loading ? 'Importing...' : 'Import Song'}
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleParsePaste}
              disabled={loading || !pasteContent.trim()}
              startIcon={<PasteIcon />}
              sx={{ borderRadius: 2, textTransform: 'none', px: 3 }}
            >
              Parse Chords
            </Button>
          )
        ) : (
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="outlined"
              onClick={() => {
                setPreviewSong(null);
                setIsDuplicate(false);
              }}
              sx={{ borderRadius: 2, textTransform: 'none' }}
            >
              {hasSearched ? 'Back to Results' : 'Import Another'}
            </Button>
            <Button
              variant="outlined"
              color="primary"
              onClick={handleEditInEditor}
              startIcon={<EditIcon />}
              sx={{ borderRadius: 2, textTransform: 'none', px: 2.5, fontWeight: 600 }}
            >
              Edit in Song Editor
            </Button>
            {!targetSongId && isDuplicate && (
              <Button
                variant="outlined"
                color="inherit"
                onClick={() => handleSaveDirectly(true)}
                disabled={savingDirectly}
                sx={{ borderRadius: 2, textTransform: 'none' }}
              >
                Create as New
              </Button>
            )}
            <Button
              variant="contained"
              color="primary"
              onClick={() => handleSaveDirectly(false)}
              disabled={savingDirectly}
              startIcon={savingDirectly ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
              sx={{ borderRadius: 2, textTransform: 'none', px: 3, fontWeight: 700 }}
            >
              {savingDirectly
                ? 'Saving...'
                : targetSongId
                ? 'Update This Song'
                : isDuplicate
                ? 'Update Existing'
                : 'Save to Library'}
            </Button>
          </Stack>
        )}
      </DialogActions>
    </Dialog>
  );
}
