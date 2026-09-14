import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
  TextField,
  InputAdornment,
  List,
  ListItemButton,
  Chip,
  Stack,
  useTheme,
  useMediaQuery,
  Fade,
  Paper,
} from '@mui/material';
import {
  Close as CloseIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  MusicNote as MusicNoteIcon,
  QueueMusic as QueueMusicIcon,
  CheckCircle as CheckCircleIcon,
  PlayArrow as PlayArrowIcon,
} from '@mui/icons-material';

/**
 * Mobile-friendly popup modal/drawer for quick song jumping in Chords & Lyrics view.
 */
function SongQuickNavModal({
  open,
  onClose,
  songs = [],
  currentSongId,
  onSelectSong,
  title = 'Setlist Songs',
  subtitle,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef(null);
  const activeItemRef = useRef(null);

  // Clear search on open and focus input
  useEffect(() => {
    if (open) {
      setSearchTerm('');
      setTimeout(() => {
        if (activeItemRef.current) {
          activeItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }, 150);
    }
  }, [open]);

  // Filter songs based on search term
  const filteredSongs = useMemo(() => {
    if (!searchTerm.trim()) {
      return songs.map((song, index) => ({ song, originalIndex: index }));
    }
    const q = searchTerm.toLowerCase().trim();
    return songs
      .map((song, index) => ({ song, originalIndex: index }))
      .filter(({ song }) => {
        const titleMatch = (song?.title || '').toLowerCase().includes(q);
        const artistMatch = (song?.artist || '').toLowerCase().includes(q);
        const keyMatch = (song?.key || '').toLowerCase().includes(q);
        return titleMatch || artistMatch || keyMatch;
      });
  }, [songs, searchTerm]);

  const handleSelect = (song, index) => {
    if (onSelectSong) {
      onSelectSong(song, index);
    }
    if (onClose) {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      scroll="paper"
      TransitionComponent={Fade}
      PaperProps={{
        sx: {
          borderRadius: 3.5,
          m: { xs: 2, sm: 'auto' },
          maxHeight: { xs: '78vh', sm: '76vh' },
          bgcolor: 'background.paper',
          backgroundImage: 'none',
          boxShadow: { xs: '0 16px 48px rgba(0,0,0,0.3)', sm: '0 20px 50px rgba(0,0,0,0.22)' },
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid',
          borderColor: (th) => (th.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'),
        },
      }}
      sx={{
        zIndex: 9999,
        '& .MuiDialog-container': {
          alignItems: 'center',
          justifyContent: 'center',
        },
        '& .MuiBackdrop-root': {
          backdropFilter: 'blur(4px)',
          bgcolor: 'rgba(0, 0, 0, 0.6)',
        },
      }}
    >

      {/* Header */}
      <DialogTitle
        sx={{
          p: { xs: 2, sm: 2.5 },
          pb: 1.5,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <QueueMusicIcon fontSize="small" />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.2, fontSize: '1.1rem' }}>
                {title}
              </Typography>
              <Chip
                label={`${songs.length} ${songs.length === 1 ? 'song' : 'songs'}`}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ fontWeight: 700, height: 22, fontSize: '0.72rem' }}
              />
            </Box>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
              {subtitle || 'Tap any song to jump directly to its lyrics & chords'}
            </Typography>
          </Box>
        </Box>

        <IconButton
          onClick={onClose}
          size="small"
          aria-label="Close song list"
          sx={{
            color: 'text.secondary',
            bgcolor: 'action.hover',
            borderRadius: 1.5,
            p: 0.75,
            ml: 1,
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      {/* Search Bar */}
      {songs.length > 4 && (
        <Box sx={{ px: { xs: 2, sm: 2.5 }, pt: 1.75, pb: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search by title, artist, or key..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            inputRef={searchInputRef}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
              endAdornment: searchTerm ? (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => setSearchTerm('')}
                    edge="end"
                    aria-label="Clear search"
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
              sx: {
                borderRadius: 2.5,
                bgcolor: (th) => (th.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
                fontSize: '0.875rem',
              },
            }}
          />
        </Box>
      )}

      {/* Song List Content */}
      <DialogContent sx={{ p: { xs: 1.5, sm: 2 }, pt: { xs: 1, sm: 1.5 } }}>
        {filteredSongs.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
            <MusicNoteIcon sx={{ fontSize: 40, opacity: 0.4, mb: 1 }} />
            <Typography variant="body2" fontWeight={600}>
              No matching songs found
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Try searching with another keyword or key name
            </Typography>
          </Box>
        ) : (
          <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {filteredSongs.map(({ song, originalIndex }) => {
              const isCurrent = String(song?._id) === String(currentSongId);
              return (
                <ListItemButton
                  key={song?._id || originalIndex}
                  ref={isCurrent ? activeItemRef : null}
                  onClick={() => handleSelect(song, originalIndex)}
                  selected={isCurrent}
                  sx={{
                    borderRadius: 2.5,
                    p: { xs: 1.25, sm: 1.5 },
                    border: '1.5px solid',
                    borderColor: isCurrent ? 'primary.main' : 'divider',
                    bgcolor: isCurrent
                      ? (th) =>
                          th.palette.mode === 'dark'
                            ? 'rgba(37, 99, 235, 0.18)'
                            : 'rgba(37, 99, 235, 0.08)'
                      : (th) =>
                          th.palette.mode === 'dark'
                            ? 'rgba(255,255,255,0.02)'
                            : 'rgba(0,0,0,0.01)',
                    transition: 'all 0.15s ease-in-out',
                    '&:hover': {
                      bgcolor: isCurrent
                        ? (th) =>
                            th.palette.mode === 'dark'
                              ? 'rgba(37, 99, 235, 0.25)'
                              : 'rgba(37, 99, 235, 0.12)'
                        : 'action.hover',
                      borderColor: isCurrent ? 'primary.main' : 'primary.light',
                      transform: 'translateY(-1px)',
                    },
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1.5,
                  }}
                >
                  {/* Left: Number + Song Title + Artist */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, flex: 1 }}>
                    <Box
                      sx={{
                        width: 30,
                        height: 30,
                        borderRadius: '50%',
                        bgcolor: isCurrent ? 'primary.main' : 'action.selected',
                        color: isCurrent ? 'primary.contrastText' : 'text.primary',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '0.8rem',
                        flexShrink: 0,
                      }}
                    >
                      {originalIndex + 1}
                    </Box>

                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography
                          variant="body1"
                          fontWeight={isCurrent ? 800 : 600}
                          noWrap
                          sx={{
                            color: isCurrent ? 'primary.main' : 'text.primary',
                            fontSize: { xs: '0.92rem', sm: '1rem' },
                          }}
                        >
                          {song?.title || 'Untitled Song'}
                        </Typography>
                        {isCurrent && (
                          <Chip
                            icon={<PlayArrowIcon sx={{ fontSize: '12px !important' }} />}
                            label="Current"
                            size="small"
                            color="primary"
                            sx={{
                              height: 20,
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              px: 0.5,
                              display: { xs: 'none', sm: 'inline-flex' },
                            }}
                          />
                        )}
                      </Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        noWrap
                        display="block"
                        sx={{ fontSize: '0.78rem', mt: 0.2 }}
                      >
                        {song?.artist || 'Unknown Artist'}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Right: Key + BPM Badges */}
                  <Stack direction="row" spacing={0.75} alignItems="center" flexShrink={0}>
                    {song?.key && (
                      <Chip
                        label={`Key: ${song.key}`}
                        size="small"
                        color={isCurrent ? 'primary' : 'default'}
                        variant={isCurrent ? 'filled' : 'outlined'}
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.72rem',
                          height: 24,
                        }}
                      />
                    )}
                    {song?.bpm && (
                      <Chip
                        label={`${song.bpm} BPM`}
                        size="small"
                        variant="outlined"
                        sx={{
                          fontWeight: 600,
                          fontSize: '0.7rem',
                          height: 24,
                          display: { xs: 'none', sm: 'inline-flex' },
                        }}
                      />
                    )}
                    {isCurrent && (
                      <CheckCircleIcon
                        color="primary"
                        sx={{ fontSize: 20, ml: { xs: 0.25, sm: 0.5 } }}
                      />
                    )}
                  </Stack>
                </ListItemButton>
              );
            })}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default SongQuickNavModal;
