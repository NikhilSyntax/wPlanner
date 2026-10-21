import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  ListItemIcon,
  ListItemText,
  Menu,
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
  Tv as TvIcon,
  CloudDownload as ImportIcon,
  CloudDownload as CloudDownloadIcon,
  CloudDone as CloudDoneIcon,
  WifiOff as WifiOffIcon,
  Refresh as RefreshIcon,
  DeleteOutline as DeleteOutlineIcon,
  Print as PrintIcon,
  QueueMusic as QueueMusicIcon,
} from '@mui/icons-material';
import api from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ChordSheetViewer from '../components/common/ChordSheetViewer';
import ImportSongModal from '../components/songs/ImportSongModal';
import PrintSetlistModal from '../components/events/PrintSetlistModal';
import SongQuickNavModal from '../components/common/SongQuickNavModal';
import {
  downloadSetlist,
  getOfflineSetlist,
  getOfflineSong,
  isSetlistOffline,
  removeOfflineSetlist,
  saveOfflineSetlist,
  updateSongInOfflineSetlist,
} from '../services/setlistOfflineService';

const KEY_OPTIONS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const TIME_SIG_OPTIONS = ['2/4', '3/4', '4/4', '5/4', '6/8', '7/8'];

function EventSetlistSongView() {
  const { id, songId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const viewQuery = searchParams.get('view');
  const stageQuery = searchParams.get('stage');

  // Track current view mode ('chords' or 'lyrics') with persistence
  const [viewMode, setViewMode] = useState(() => {
    if (viewQuery === 'lyrics') return 'lyrics';
    if (viewQuery === 'chords') return 'chords';
    try {
      const saved = localStorage.getItem('wplanner_setlist_view_mode');
      if (saved === 'lyrics' || saved === 'chords') return saved;
    } catch (e) {}
    return 'chords';
  });

  // Track fullscreen stage mode synced with URL query (?stage=1)
  const [isFullscreenStage, setIsFullscreenStage] = useState(() => {
    return stageQuery === '1' || stageQuery === 'true';
  });

  // Keep viewMode synced if URL query explicitly changes
  useEffect(() => {
    if (viewQuery === 'lyrics' || viewQuery === 'chords') {
      setViewMode(viewQuery);
      try {
        localStorage.setItem('wplanner_setlist_view_mode', viewQuery);
      } catch (e) {}
    }
  }, [viewQuery]);

  // Keep isFullscreenStage synced if URL query explicitly changes
  useEffect(() => {
    setIsFullscreenStage(stageQuery === '1' || stageQuery === 'true');
  }, [stageQuery]);

  const handleViewModeChange = (newMode) => {
    const normalized = newMode === 'lyrics' ? 'lyrics' : 'chords';
    setViewMode(normalized);
    try {
      localStorage.setItem('wplanner_setlist_view_mode', normalized);
    } catch (e) {}
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('view', normalized);
      return next;
    }, { replace: true });
  };

  const handleFullscreenChange = (nextFs) => {
    setIsFullscreenStage(nextFs);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (nextFs) {
        next.set('stage', '1');
      } else {
        next.delete('stage');
      }
      return next;
    }, { replace: true });
  };

  // In-memory song cache: songId -> full song object
  const songsCacheRef = useRef(new Map());

  // Offline status & connectivity
  const initialOffline = useMemo(() => getOfflineSetlist(id), [id]);
  const [isOfflineReady, setIsOfflineReady] = useState(() => isSetlistOffline(id));
  const [downloading, setDownloading] = useState(false);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [offlineMenuAnchor, setOfflineMenuAnchor] = useState(null);

  // Synchronous pre-population from offline bundle if available for 0ms initial render
  const [eventTitle, setEventTitle] = useState(() => initialOffline?.eventTitle || '');
  const [setlist, setSetlist] = useState(() => initialOffline?.songs || []);
  const [song, setSong] = useState(() => {
    if (initialOffline?.songsById && initialOffline.songsById[String(songId)]) {
      return initialOffline.songsById[String(songId)];
    }
    return null;
  });
  const [loading, setLoading] = useState(() => {
    return !(initialOffline?.songsById && initialOffline.songsById[String(songId)]);
  });
  const [error, setError] = useState('');

  // Edit Modal State
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  // Import Modal State
  const [importModalOpen, setImportModalOpen] = useState(false);
  // Print Setlist Modal State
  const [printModalOpen, setPrintModalOpen] = useState(false);
  // Quick Song Navigation Modal State
  const [quickNavOpen, setQuickNavOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    artist: '',
    key: 'C',
    bpm: '',
    timeSignature: '4/4',
    content: '',
  });

  // Seed memory cache with initial offline data
  useEffect(() => {
    if (initialOffline?.songs && Array.isArray(initialOffline.songs)) {
      initialOffline.songs.forEach((s) => {
        if (s?._id) songsCacheRef.current.set(String(s._id), s);
      });
    }
  }, [initialOffline]);

  // Online / offline and setlist cache event listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleOfflineUpdated = (e) => {
      if (e?.detail?.eventId === String(id)) {
        setIsOfflineReady(true);
      }
    };
    const handleOfflineRemoved = (e) => {
      if (e?.detail?.eventId === String(id)) {
        setIsOfflineReady(false);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('wplanner:offline_setlist_updated', handleOfflineUpdated);
    window.addEventListener('wplanner:offline_setlist_removed', handleOfflineRemoved);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('wplanner:offline_setlist_updated', handleOfflineUpdated);
      window.removeEventListener('wplanner:offline_setlist_removed', handleOfflineRemoved);
    };
  }, [id]);

  // 1. Fetch event setlist with full song details in a single round trip (runs only when `id` changes)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.onLine) {
          const offlineBundle = getOfflineSetlist(id);
          if (offlineBundle && !cancelled) {
            setEventTitle(offlineBundle.eventTitle || 'Event');
            setSetlist(offlineBundle.songs || []);
            offlineBundle.songs.forEach((s) => {
              if (s?._id) songsCacheRef.current.set(String(s._id), s);
            });
            setIsOfflineReady(true);
          }
          return;
        }

        const eventRes = await api.get(`/events/${id}?fullSetlist=true`);
        if (cancelled) return;
        const eventDoc = eventRes.data || {};
        const list = Array.isArray(eventDoc.setlist) ? eventDoc.setlist : [];
        const title = eventDoc?.event?.title || eventDoc?.title || 'Event';
        setEventTitle(title);
        setSetlist(list);

        // Put songs into memory cache
        list.forEach((s) => {
          if (s && s._id) {
            songsCacheRef.current.set(String(s._id), s);
          }
        });

        // If previously saved offline, keep offline storage refreshed in background
        if (isSetlistOffline(id)) {
          const songsById = {};
          list.forEach((s) => {
            if (s?._id) songsById[String(s._id)] = s;
          });
          saveOfflineSetlist(id, {
            eventId: String(id),
            eventTitle: title,
            downloadedAt: Date.now(),
            songs: list,
            songsById,
            songCount: list.length,
            version: 1,
          });
          setIsOfflineReady(true);
        }
      } catch (e) {
        console.warn('[EventSetlistSongView] Failed to fetch full event setlist:', e);
        const offlineBundle = getOfflineSetlist(id);
        if (offlineBundle && !cancelled) {
          setEventTitle(offlineBundle.eventTitle || 'Event');
          setSetlist(offlineBundle.songs || []);
          offlineBundle.songs.forEach((s) => {
            if (s?._id) songsCacheRef.current.set(String(s._id), s);
          });
          setIsOfflineReady(true);
        } else if (!cancelled && !song) {
          setError(e?.response?.data?.message || 'Failed to load setlist');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // 2. Select / switch current song — INSTANT 0ms latency when song is in memory or offline cache
  useEffect(() => {
    let cancelled = false;
    const songIdStr = String(songId);

    // 1. Check in-memory cache first
    const inMemory = songsCacheRef.current.get(songIdStr);
    if (inMemory && (inMemory.content?.chords || inMemory.content?.lyrics || inMemory.content)) {
      setSong(inMemory);
      setLoading(false);
      return;
    }

    // 2. Check setlist array
    const fromList = setlist.find((s) => String(s?._id) === songIdStr);
    if (fromList && (fromList.content?.chords || fromList.content?.lyrics || fromList.content)) {
      songsCacheRef.current.set(songIdStr, fromList);
      setSong(fromList);
      setLoading(false);
      return;
    }

    // 3. Check offline cache
    const offlineSong = getOfflineSong(id, songIdStr);
    if (offlineSong && (offlineSong.content?.chords || offlineSong.content?.lyrics || offlineSong.content)) {
      songsCacheRef.current.set(songIdStr, offlineSong);
      setSong(offlineSong);
      setLoading(false);
      return;
    }

    // 4. Fallback: fetch single song from API (only if missing from all caches)
    (async () => {
      try {
        if (!song) setLoading(true);
        setError('');
        const songRes = await api.get(`/songs/${songId}`);
        if (cancelled) return;
        const fetchedSong = songRes.data || null;
        if (fetchedSong) {
          songsCacheRef.current.set(songIdStr, fetchedSong);
          setSong(fetchedSong);
        }
      } catch (err) {
        if (!cancelled && !song) {
          setError(err?.response?.data?.message || 'Failed to load lyrics and chords');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, songId, setlist]);

  const currentIndex = useMemo(
    () => setlist.findIndex((s) => String(s?._id) === String(songId)),
    [setlist, songId]
  );
  const nextSong = currentIndex >= 0 ? setlist[currentIndex + 1] : null;
  const prevSong = currentIndex > 0 ? setlist[currentIndex - 1] : null;

  const goNextSong = () => {
    if (!nextSong?._id) return;
    const stageParam = isFullscreenStage ? '&stage=1' : '';
    navigate(`/events/${id}/setlist/${nextSong._id}?view=${viewMode}${stageParam}`);
  };

  const goPrevSong = () => {
    if (!prevSong?._id) return;
    const stageParam = isFullscreenStage ? '&stage=1' : '';
    navigate(`/events/${id}/setlist/${prevSong._id}?view=${viewMode}${stageParam}`);
  };

  const handleSelectSongFromList = (targetSong) => {
    if (!targetSong?._id) return;
    const stageParam = isFullscreenStage ? '&stage=1' : '';
    navigate(`/events/${id}/setlist/${targetSong._id}?view=${viewMode}${stageParam}`);
  };

  const handleDownloadSetlist = async () => {
    try {
      setDownloading(true);
      const bundle = await downloadSetlist(id);
      setIsOfflineReady(true);
      bundle.songs.forEach((s) => {
        if (s?._id) songsCacheRef.current.set(String(s._id), s);
      });
      setSetlist(bundle.songs);
      if (bundle.songsById && bundle.songsById[String(songId)]) {
        setSong(bundle.songsById[String(songId)]);
      }
      setToastMessage(`Setlist downloaded (${bundle.songCount} songs)! Available offline.`);
    } catch (err) {
      console.error('Download setlist failed:', err);
      setToastMessage('Failed to download setlist for offline use.');
    } finally {
      setDownloading(false);
    }
  };

  const handleRemoveOffline = () => {
    removeOfflineSetlist(id);
    setIsOfflineReady(false);
    setOfflineMenuAnchor(null);
    setToastMessage('Offline setlist removed from device.');
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

      let updatedSong = { ...song, ...payload };

      if (navigator.onLine) {
        const res = await api.put(`/songs/${songId}`, payload);
        if (res.data) updatedSong = res.data;
      }

      setSong(updatedSong);
      songsCacheRef.current.set(String(songId), updatedSong);
      setSetlist((prev) =>
        prev.map((s) => (String(s._id) === String(songId) ? { ...s, ...updatedSong } : s))
      );
      updateSongInOfflineSetlist(id, updatedSong);

      setToastMessage(
        navigator.onLine
          ? 'Lyrics & chords updated successfully!'
          : 'Saved offline! Changes stored on this device.'
      );
      setEditDialogOpen(false);
    } catch (err) {
      console.error('Failed to update song:', err);
      if (!navigator.onLine || err.message?.includes('Network')) {
        const updatedSong = {
          ...song,
          title: editForm.title.trim(),
          artist: editForm.artist.trim(),
          key: editForm.key,
          bpm: editForm.bpm ? parseInt(editForm.bpm, 10) : undefined,
          timeSignature: editForm.timeSignature,
          content: { chords: editForm.content, lyrics: editForm.content },
        };
        setSong(updatedSong);
        songsCacheRef.current.set(String(songId), updatedSong);
        updateSongInOfflineSetlist(id, updatedSong);
        setToastMessage('Saved offline on this device.');
        setEditDialogOpen(false);
      } else {
        setEditError(
          err?.response?.data?.message || 'Failed to save changes. Please try again.'
        );
      }
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
    <Box sx={{ p: { xs: 1.5, sm: 2.5, md: 3 }, maxWidth: 1050, mx: 'auto' }}>
      {/* Toast Notification */}
      <Snackbar
        open={Boolean(toastMessage)}
        autoHideDuration={3000}
        onClose={() => setToastMessage('')}
        message={toastMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

      {/* Header Top Bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
          gap: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
          <IconButton
            onClick={() => navigate(`/events/${id}`)}
            aria-label="Back to event"
            sx={{ bgcolor: 'action.hover', borderRadius: 2 }}
          >
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="h6"
              fontWeight={700}
              noWrap
              sx={{ lineHeight: 1.2, fontSize: { xs: '1.05rem', sm: '1.25rem' } }}
            >
              {viewMode === 'lyrics' ? 'Song Lyrics' : 'Chords & Lyrics'}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {eventTitle}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {/* Download Setlist / Offline Ready Control */}
          {isOfflineReady ? (
            <>
              <Tooltip title="Setlist is downloaded & available offline. Click for options.">
                <Chip
                  icon={<CloudDoneIcon sx={{ fontSize: '15px !important' }} />}
                  label="Offline Ready"
                  size="small"
                  color="success"
                  variant="outlined"
                  onClick={(e) => setOfflineMenuAnchor(e.currentTarget)}
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    height: 30,
                    cursor: 'pointer',
                    bgcolor: (th) =>
                      th.palette.mode === 'dark'
                        ? 'rgba(34, 197, 94, 0.15)'
                        : 'rgba(34, 197, 94, 0.08)',
                    borderColor: 'success.main',
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: 'success.main',
                      color: 'success.contrastText',
                      '& .MuiChip-icon': {
                        color: 'inherit',
                      },
                    },
                  }}
                />
              </Tooltip>
              <Menu
                anchorEl={offlineMenuAnchor}
                open={Boolean(offlineMenuAnchor)}
                onClose={() => setOfflineMenuAnchor(null)}
              >
                <MenuItem
                  onClick={() => {
                    setOfflineMenuAnchor(null);
                    handleDownloadSetlist();
                  }}
                >
                  <ListItemIcon>
                    <RefreshIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Update / Re-download"
                    secondary="Fetch latest chords & lyrics from server"
                  />
                </MenuItem>
                <MenuItem onClick={handleRemoveOffline} sx={{ color: 'error.main' }}>
                  <ListItemIcon sx={{ color: 'error.main' }}>
                    <DeleteOutlineIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Remove from Device"
                    secondary="Delete cached chords & lyrics"
                  />
                </MenuItem>
              </Menu>
            </>
          ) : (
            <Button
              size="small"
              variant="outlined"
              color="primary"
              disabled={downloading}
              startIcon={
                downloading ? (
                  <CircularProgress size={13} color="inherit" />
                ) : (
                  <CloudDownloadIcon fontSize="small" />
                )
              }
              onClick={handleDownloadSetlist}
              sx={{
                fontWeight: 700,
                fontSize: '0.75rem',
                height: 30,
                textTransform: 'none',
                borderRadius: 2,
              }}
            >
              {downloading ? 'Downloading...' : 'Download Setlist'}
            </Button>
          )}

          <Button
            size="small"
            variant="outlined"
            color="primary"
            startIcon={<PrintIcon fontSize="small" />}
            onClick={() => setPrintModalOpen(true)}
            sx={{
              fontWeight: 700,
              fontSize: '0.75rem',
              height: 30,
              textTransform: 'none',
              borderRadius: 2,
            }}
          >
            Print Set List
          </Button>

          <Button
            size="small"
            variant="contained"
            color="primary"
            startIcon={<TvIcon fontSize="small" />}
            onClick={() => navigate(`/live/operator/${id}`)}
            sx={{
              fontWeight: 700,
              fontSize: '0.75rem',
              height: 30,
              textTransform: 'none',
              borderRadius: 2,
            }}
          >
            Live TV
          </Button>

          {setlist.length > 0 && (
            <Tooltip title="Tap to view all setlist songs & quickly jump">
              <Chip
                icon={<QueueMusicIcon sx={{ fontSize: '15px !important' }} />}
                label={`Song ${currentIndex + 1} of ${setlist.length}`}
                size="small"
                color="primary"
                variant="outlined"
                onClick={() => setQuickNavOpen(true)}
                sx={{
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  height: 28,
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.35)',
                    '& .MuiChip-icon': {
                      color: 'inherit',
                    },
                  },
                }}
              />
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Offline Alert Banner */}
      {!isOnline && (
        <Alert
          severity="warning"
          icon={<WifiOffIcon />}
          sx={{
            mb: 2,
            borderRadius: 2,
            boxShadow: '0 2px 8px rgba(234, 88, 12, 0.1)',
          }}
        >
          <strong>Offline Mode:</strong> Disconnected from internet. All chords and lyrics are served instantly from your offline download.
        </Alert>
      )}

      {/* Song Hero Card with Touch-friendly Navigation Bar */}
      <Card
        variant="outlined"
        sx={{
          borderRadius: 3,
          mb: 2.5,
          bgcolor: 'background.paper',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 2.5 }, pb: { xs: '16px !important', sm: '20px !important' } }}>
          {/* Top row: Title + Artist + Key/BPM Badges */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 1.5,
              flexWrap: 'wrap',
              mb: 1.75,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2.5,
                  bgcolor: 'rgba(37, 99, 235, 0.1)',
                  color: 'primary.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <MusicIcon />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="h6"
                  fontWeight={700}
                  sx={{ lineHeight: 1.25, fontSize: { xs: '1.05rem', sm: '1.25rem' } }}
                >
                  {song?.title || 'Untitled Song'}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  noWrap
                  sx={{ fontSize: '0.8125rem', mt: 0.25 }}
                >
                  {song?.artist || 'Unknown Artist'}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
              {song?.key && (
                <Chip
                  size="small"
                  label={`Key: ${song.key}`}
                  color="primary"
                  sx={{ fontWeight: 700, fontSize: '0.75rem', height: 24 }}
                />
              )}
              {song?.bpm && (
                <Chip
                  size="small"
                  label={`${song.bpm} BPM`}
                  variant="outlined"
                  sx={{ fontWeight: 600, fontSize: '0.72rem', height: 24 }}
                />
              )}
              {song?.timeSignature && (
                <Chip
                  size="small"
                  label={song.timeSignature}
                  variant="outlined"
                  sx={{ fontWeight: 600, fontSize: '0.72rem', height: 24 }}
                />
              )}
            </Box>
          </Box>

          {/* Bottom row: Prev / Next Navigation & Edit Button */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              pt: 1.5,
              borderTop: '1px solid',
              borderColor: 'divider',
              flexWrap: 'wrap',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: { xs: 1, sm: 'none' } }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<PrevIcon />}
                onClick={goPrevSong}
                disabled={!prevSong}
                sx={{
                  textTransform: 'none',
                  borderRadius: 1.75,
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  py: 0.5,
                  px: { xs: 1.25, sm: 1.75 },
                  flex: { xs: 1, sm: 'none' },
                }}
              >
                {prevSong ? 'Prev' : 'First'}
              </Button>
              <Button
                variant="contained"
                size="small"
                endIcon={<NextIcon />}
                onClick={goNextSong}
                disabled={!nextSong}
                sx={{
                  textTransform: 'none',
                  borderRadius: 1.75,
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  py: 0.5,
                  px: { xs: 1.25, sm: 1.75 },
                  flex: { xs: 1, sm: 'none' },
                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)',
                }}
              >
                {nextSong ? 'Next' : 'Last'}
              </Button>

              {setlist.length > 1 && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<QueueMusicIcon sx={{ fontSize: 16 }} />}
                  onClick={() => setQuickNavOpen(true)}
                  sx={{
                    textTransform: 'none',
                    borderRadius: 1.75,
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    py: 0.5,
                    px: 1.25,
                    color: 'primary.main',
                    borderColor: 'primary.light',
                    bgcolor: (th) =>
                      th.palette.mode === 'dark' ? 'rgba(37, 99, 235, 0.12)' : 'rgba(37, 99, 235, 0.06)',
                    '&:hover': {
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                    },
                  }}
                >
                  All Songs ({setlist.length})
                </Button>
              )}
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>
              <Button
                variant="outlined"
                color="primary"
                size="small"
                startIcon={<ImportIcon sx={{ fontSize: 16 }} />}
                onClick={() => setImportModalOpen(true)}
                sx={{
                  textTransform: 'none',
                  borderRadius: 1.75,
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  py: 0.5,
                  px: 1.25,
                }}
              >
                Import Song
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                size="small"
                startIcon={<EditIcon sx={{ fontSize: 15 }} />}
                onClick={handleOpenEditModal}
                sx={{
                  textTransform: 'none',
                  borderRadius: 1.75,
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  py: 0.5,
                  px: 1.25,
                }}
              >
                Edit Sheet
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Unified Chord Sheet Viewer with Hide/Show Chords initialized from URL query */}
      <ChordSheetViewer
        key={`${songId}-${viewMode}-${song?.updatedAt || ''}`}
        songId={songId}
        song={song}
        onSaveSong={(updated) => {
          setSong(updated);
          if (updated?._id) {
            songsCacheRef.current.set(String(updated._id), updated);
            updateSongInOfflineSetlist(id, updated);
          }
        }}
        rawContent={songContent}
        originalKey={song?.key || 'C'}
        title={song?.title}
        artist={song?.artist}
        initialShowChords={viewMode !== 'lyrics'}
        onViewModeChange={handleViewModeChange}
        onEdit={handleOpenEditModal}
        onPrevSong={goPrevSong}
        onNextSong={goNextSong}
        prevSong={prevSong}
        nextSong={nextSong}
        currentIndex={currentIndex}
        totalSongs={setlist.length}
        onOpenSongList={() => setQuickNavOpen(true)}
        isFullscreen={isFullscreenStage}
        onFullscreenChange={handleFullscreenChange}
      />

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
          <Box display="flex" alignItems="center" gap={1}>
            <Button
              size="small"
              variant="outlined"
              color="primary"
              startIcon={<ImportIcon sx={{ fontSize: 15 }} />}
              onClick={() => setImportModalOpen(true)}
              sx={{
                textTransform: 'none',
                borderRadius: 1.5,
                fontWeight: 600,
                fontSize: '0.75rem',
                py: 0.35,
                px: 1.25,
              }}
            >
              Import Song
            </Button>
            <IconButton
              size="small"
              onClick={() => setEditDialogOpen(false)}
              disabled={editLoading}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
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

      {/* Ultimate Guitar Song Import Modal */}
      <ImportSongModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        targetSongId={songId}
        targetSongTitle={song?.title}
        onImportToEditor={(imported) => {
          setEditForm((prev) => ({
            title: imported.title || prev.title || song?.title || '',
            artist: imported.artist || prev.artist || song?.artist || '',
            key: imported.key || prev.key || song?.key || 'C',
            bpm: imported.bpm !== undefined ? String(imported.bpm) : prev.bpm || (song?.bpm ? String(song.bpm) : ''),
            timeSignature: imported.timeSignature || prev.timeSignature || song?.timeSignature || '4/4',
            content: imported.content?.chords || imported.content?.lyrics || prev.content,
          }));
          setEditDialogOpen(true);
        }}
        onSongSaved={(updatedSong) => {
          setSong(updatedSong);
          if (updatedSong?._id) {
            songsCacheRef.current.set(String(updatedSong._id), updatedSong);
            updateSongInOfflineSetlist(id, updatedSong);
          }
          setToastMessage(`Song "${updatedSong.title}" updated successfully with imported lyrics & chords!`);
        }}
      />

      {/* Print Set List Modal */}
      <PrintSetlistModal
        open={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        event={{ _id: id, title: eventTitle }}
        setlist={setlist}
      />

      {/* Mobile Floating Quick Jump Button (Hidden in Fullscreen to prevent overlapping floating auto-scroll) */}
      {!isFullscreenStage && setlist.length > 1 && (
        <Box
          sx={{
            position: 'fixed',
            bottom: { xs: 18, sm: 24 },
            right: { xs: 72, sm: 82 },
            zIndex: 1200,
            display: { xs: 'block', md: 'none' },
          }}
        >
          <Button
            variant="contained"
            color="primary"
            onClick={() => setQuickNavOpen(true)}
            startIcon={<QueueMusicIcon sx={{ fontSize: 17 }} />}
            sx={{
              borderRadius: 6,
              px: 1.75,
              py: 0.75,
              fontWeight: 700,
              fontSize: '0.78rem',
              textTransform: 'none',
              boxShadow: '0 4px 16px rgba(37, 99, 235, 0.45)',
              backdropFilter: 'blur(10px)',
            }}
          >
            Songs ({currentIndex + 1}/{setlist.length})
          </Button>
        </Box>
      )}

      {/* Mobile-Friendly Quick Song Navigation Popup */}
      <SongQuickNavModal
        open={quickNavOpen}
        onClose={() => setQuickNavOpen(false)}
        songs={setlist}
        currentSongId={songId}
        onSelectSong={handleSelectSongFromList}
        title="Setlist Songs"
        subtitle={eventTitle ? `Setlist for ${eventTitle}` : 'Tap any song to jump to its chords & lyrics'}
      />
    </Box>
  );
}

export default EventSetlistSongView;
