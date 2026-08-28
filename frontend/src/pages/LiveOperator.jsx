import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Chip,
  Stack,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Tooltip,
  Badge,
  useTheme,
  Grid,
  TextField,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  NavigateNext as NextIcon,
  NavigateBefore as PrevIcon,
  Tv as TvIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  StopCircle as BlackoutIcon,
  CleaningServices as ClearIcon,
  MusicNote as MusicIcon,
  OpenInNew as OpenInNewIcon,
  ContentCopy as CopyIcon,
  Check as CheckIcon,
  Keyboard as KeyboardIcon,
  Fullscreen as FullscreenIcon,
  Edit as EditIcon,
  Close as CloseIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { io } from 'socket.io-client';
import api from '../services/api';
import AnchoredLyricRow from '../components/live/AnchoredLyricRow';
import LoadingSpinner from '../components/common/LoadingSpinner';

function lineToInlineChordPro(line) {
  if (!line) return '';
  const text = line.text || '';
  const chords = [...(line.chords || [])].sort((a, b) => b.position - a.position);
  let result = text;
  for (const c of chords) {
    const pos = Math.min(Math.max(0, c.position), result.length);
    result = result.slice(0, pos) + `[${c.chord}]` + result.slice(pos);
  }
  return result;
}

function inlineChordProToLine(str = '') {
  let text = '';
  const chords = [];
  const regex = /\[([A-G][^\]]*)\]/g;
  let lastIdx = 0;
  let match;
  while ((match = regex.exec(str)) !== null) {
    text += str.substring(lastIdx, match.index);
    chords.push({
      chord: match[1].trim(),
      position: text.length,
    });
    lastIdx = match.index + match[0].length;
  }
  text += str.substring(lastIdx);
  return { text, chords };
}

function computeOptimisticLiveState(state, type, payload = {}) {
  if (!state) return state;

  const songs = state.songs || [];
  let currentSongId = state.currentSongId;
  let currentSongTitle = state.currentSongTitle;
  let currentSongKey = state.currentSongKey;
  let currentSectionId = state.currentSectionId;
  let currentSectionName = state.currentSectionName;
  let currentChunkIndex = state.currentChunkIndex || 0;
  let displayMode = state.displayMode || 'LYRICS_CHORDS';
  let customChunkOverrides = { ...(state.customChunkOverrides || {}) };

  let currentSong = songs.find((s) => s._id?.toString() === currentSongId?.toString()) || songs[0];

  if (type === 'SET_SONG') {
    const targetSong = songs.find((s) => s._id?.toString() === payload.songId?.toString());
    if (targetSong) {
      currentSong = targetSong;
      currentSongId = targetSong._id;
      currentSongTitle = targetSong.title;
      currentSongKey = targetSong.key;
      currentSectionId = targetSong.sections?.[0]?.sectionId || '';
      currentSectionName = targetSong.sections?.[0]?.name || '';
      currentChunkIndex = 0;
      if (displayMode === 'BLACK' || displayMode === 'CLEAR') {
        displayMode = 'LYRICS_CHORDS';
      }
    }
  } else if (type === 'SET_SECTION') {
    if (currentSong && currentSong.sections) {
      const targetSec = currentSong.sections.find((s) => s.sectionId === payload.sectionId);
      if (targetSec) {
        currentSectionId = targetSec.sectionId;
        currentSectionName = targetSec.name;
        currentChunkIndex = payload.chunkIndex !== undefined ? payload.chunkIndex : 0;
        if (displayMode === 'BLACK' || displayMode === 'CLEAR') {
          displayMode = 'LYRICS_CHORDS';
        }
      }
    }
  } else if (type === 'NEXT') {
    if (currentSong && currentSong.sections?.length > 0) {
      const secIdx = currentSong.sections.findIndex((s) => s.sectionId === currentSectionId);
      const curSec = currentSong.sections[secIdx >= 0 ? secIdx : 0];
      const chunks = curSec.chunks || [];

      if (currentChunkIndex + 1 < chunks.length) {
        currentChunkIndex += 1;
      } else if (secIdx + 1 < currentSong.sections.length) {
        const nextSec = currentSong.sections[secIdx + 1];
        currentSectionId = nextSec.sectionId;
        currentSectionName = nextSec.name;
        currentChunkIndex = 0;
      } else {
        const songIdx = songs.findIndex((s) => s._id?.toString() === currentSong._id?.toString());
        if (songIdx + 1 < songs.length) {
          const nextSong = songs[songIdx + 1];
          currentSong = nextSong;
          currentSongId = nextSong._id;
          currentSongTitle = nextSong.title;
          currentSongKey = nextSong.key;
          currentSectionId = nextSong.sections?.[0]?.sectionId || '';
          currentSectionName = nextSong.sections?.[0]?.name || '';
          currentChunkIndex = 0;
        }
      }
      if (displayMode === 'BLACK' || displayMode === 'CLEAR') {
        displayMode = 'LYRICS_CHORDS';
      }
    }
  } else if (type === 'PREV') {
    if (currentSong && currentSong.sections?.length > 0) {
      const secIdx = currentSong.sections.findIndex((s) => s.sectionId === currentSectionId);
      if (currentChunkIndex > 0) {
        currentChunkIndex -= 1;
      } else if (secIdx > 0) {
        const prevSec = currentSong.sections[secIdx - 1];
        currentSectionId = prevSec.sectionId;
        currentSectionName = prevSec.name;
        currentChunkIndex = Math.max((prevSec.chunks?.length || 1) - 1, 0);
      } else {
        const songIdx = songs.findIndex((s) => s._id?.toString() === currentSong._id?.toString());
        if (songIdx > 0) {
          const prevSong = songs[songIdx - 1];
          currentSong = prevSong;
          currentSongId = prevSong._id;
          currentSongTitle = prevSong.title;
          currentSongKey = prevSong.key;
          const lastSec = prevSong.sections?.[(prevSong.sections?.length || 1) - 1];
          if (lastSec) {
            currentSectionId = lastSec.sectionId;
            currentSectionName = lastSec.name;
            currentChunkIndex = Math.max((lastSec.chunks?.length || 1) - 1, 0);
          }
        }
      }
      if (displayMode === 'BLACK' || displayMode === 'CLEAR') {
        displayMode = 'LYRICS_CHORDS';
      }
    }
  } else if (type === 'SET_DISPLAY_MODE') {
    if (['LYRICS_CHORDS', 'LYRICS', 'CHORDS', 'BLACK', 'CLEAR'].includes(payload.mode)) {
      displayMode = payload.mode;
    }
  } else if (type === 'BLACK_SCREEN') {
    displayMode = displayMode === 'BLACK' ? 'LYRICS_CHORDS' : 'BLACK';
  } else if (type === 'CLEAR_SCREEN') {
    displayMode = displayMode === 'CLEAR' ? 'LYRICS_CHORDS' : 'CLEAR';
  } else if (type === 'UPDATE_CHUNK') {
    const { lines, songId, sectionId, chunkIndex } = payload || {};
    if (Array.isArray(lines)) {
      const targetSongId = songId || currentSongId;
      const targetSectionId = sectionId || currentSectionId;
      const targetChunkIdx = chunkIndex !== undefined ? chunkIndex : currentChunkIndex;
      const overrideKey = `${targetSongId}_${targetSectionId}_${targetChunkIdx}`;
      customChunkOverrides[overrideKey] = lines;
    }
  }

  // Calculate current and next chunk lines
  let currentChunk = [];
  let nextChunk = null;
  let currentSectionIndex = 0;

  if (currentSong && currentSong.sections?.length > 0) {
    const secIdx = currentSong.sections.findIndex((sec) => sec.sectionId === currentSectionId);
    currentSectionIndex = secIdx >= 0 ? secIdx : 0;
    const curSec = currentSong.sections[currentSectionIndex];
    currentSectionId = curSec.sectionId;
    currentSectionName = curSec.name;

    const chunks = curSec.chunks || [];
    const chunkIdx = Math.min(Math.max(currentChunkIndex || 0, 0), Math.max(chunks.length - 1, 0));
    currentChunkIndex = chunkIdx;
    const rawChunk = chunks[chunkIdx] || { lines: [] };

    const overrideKey = `${currentSongId}_${currentSectionId}_${chunkIdx}`;
    currentChunk = customChunkOverrides[overrideKey] || rawChunk.lines || [];

    if (chunkIdx + 1 < chunks.length) {
      nextChunk = {
        sectionName: curSec.name,
        lines: chunks[chunkIdx + 1].lines,
      };
    } else if (currentSectionIndex + 1 < currentSong.sections.length) {
      const nextSec = currentSong.sections[currentSectionIndex + 1];
      nextChunk = {
        sectionName: nextSec.name,
        lines: nextSec.chunks?.[0]?.lines || [],
      };
    } else {
      const currentSongIdx = songs.findIndex((s) => s._id?.toString() === currentSong._id?.toString());
      if (currentSongIdx + 1 < songs.length) {
        const nextSong = songs[currentSongIdx + 1];
        nextChunk = {
          songTitle: nextSong.title,
          sectionName: nextSong.sections?.[0]?.name || 'Intro',
          lines: nextSong.sections?.[0]?.chunks?.[0]?.lines || [],
        };
      } else {
        nextChunk = {
          sectionName: 'End of Service',
          lines: [],
        };
      }
    }
  }

  return {
    ...state,
    currentSongId,
    currentSongTitle,
    currentSongKey,
    currentSectionId,
    currentSectionName,
    currentSectionIndex,
    currentChunkIndex,
    displayMode,
    customChunkOverrides,
    currentChunk,
    nextChunk,
  };
}

export default function LiveOperator() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [liveState, setLiveState] = useState(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);
  const [pairingModalOpen, setPairingModalOpen] = useState(false);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);

  // Live slide inline editing
  const [isEditingSlide, setIsEditingSlide] = useState(false);
  const [editLine1, setEditLine1] = useState('');
  const [editLine2, setEditLine2] = useState('');

  const socketRef = useRef(null);
  const broadcastRef = useRef(null);

  // Fetch initial session state
  const fetchSession = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get(`/live/session/${eventId}`);
      setLiveState(res.data);
    } catch (err) {
      console.error('Failed to load live session:', err);
      setError(err?.response?.data?.message || 'Failed to initialize live session');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  // Connect WebSocket
  useEffect(() => {
    fetchSession();

    const token = localStorage.getItem('accessToken');
    const socketUrl =
      import.meta.env.VITE_SOCKET_URL ||
      (import.meta.env.DEV ? 'http://localhost:3000' : 'https://wplanner-j7a7.onrender.com');

    const socket = io(socketUrl, {
      path: '/socket.io',
      query: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 25,
      reconnectionDelay: 1000,
      timeout: 5000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('live:operator:join', { eventId });
    });

    socket.on('live:viewer:count', ({ count }) => {
      setViewerCount(count || 0);
    });

    socket.on('live:state:updated', (newState) => {
      if (newState) {
        setLiveState((prev) => ({
          ...prev,
          ...newState,
        }));
        if (broadcastRef.current) {
          broadcastRef.current.postMessage({ type: 'LIVE_STATE_UPDATE', payload: newState });
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [eventId, fetchSession]);

  // Zero-latency instant BroadcastChannel across same-machine popups
  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        broadcastRef.current = new BroadcastChannel(`wplanner_live_${eventId}`);
      } catch (e) {}
    }
    return () => {
      if (broadcastRef.current) broadcastRef.current.close();
    };
  }, [eventId]);

  const handlePopoutViewer = () => {
    const width = 1200;
    const height = 700;
    const left = Math.max(0, (window.screen.width - width) / 2);
    const top = Math.max(0, (window.screen.height - height) / 2);
    window.open(
      `/live/viewer/event/${eventId}`,
      `wPlannerLiveViewer_${eventId}`,
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes`
    );
  };

  // Dispatch operator commands via WebSocket & Instant Local Broadcast (0ms)
  const sendCommand = (type, payload = {}) => {
    // 1. Instant Optimistic Local UI & BroadcastChannel (0ms delay)
    setLiveState((prevState) => {
      const optimistic = computeOptimisticLiveState(prevState, type, payload);
      if (broadcastRef.current) {
        broadcastRef.current.postMessage({ type: 'LIVE_STATE_UPDATE', payload: optimistic });
      }
      try {
        localStorage.setItem(
          `wplanner_live_sync_${eventId}`,
          JSON.stringify({ payload: optimistic, ts: Date.now() })
        );
      } catch (e) {}
      return optimistic;
    });

    // 2. Low-latency WebSocket transmission to cloud and remote TV screens
    if (socketRef.current) {
      socketRef.current.emit('live:command', {
        eventId,
        command: { type, payload },
      });
    }
  };

  const sendCommandRef = useRef(sendCommand);
  sendCommandRef.current = sendCommand;

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept when typing in inputs
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        sendCommandRef.current('NEXT');
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        sendCommandRef.current('PREV');
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        sendCommandRef.current('BLACK_SCREEN');
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        sendCommandRef.current('CLEAR_SCREEN');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCopyPairingCode = () => {
    if (liveState?.pairingCode) {
      navigator.clipboard.writeText(liveState.pairingCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <Box sx={{ p: 4, maxWidth: 600, mx: 'auto', textAlign: 'center' }}>
        <Typography variant="h6" color="error" gutterBottom>
          {error}
        </Typography>
        <Button variant="outlined" onClick={() => navigate(`/events/${eventId}`)}>
          Back to Event
        </Button>
      </Box>
    );
  }

  const songs = liveState?.songs || [];
  const currentSong = songs.find((s) => s._id.toString() === liveState?.currentSongId?.toString()) || songs[0];
  const sections = currentSong?.sections || [];
  const displayMode = liveState?.displayMode || 'LYRICS_CHORDS';
  const isBlack = displayMode === 'BLACK';
  const isClear = displayMode === 'CLEAR';
  const showChords = displayMode === 'LYRICS_CHORDS' || displayMode === 'CHORDS';

  const currentLines = Array.isArray(liveState?.currentChunk) ? liveState.currentChunk : [];
  const nextLines = Array.isArray(liveState?.nextChunk?.lines) ? liveState.nextChunk.lines : [];

  return (
    <Box
      sx={{
        height: '100vh',
        maxHeight: '100vh',
        overflow: 'hidden',
        bgcolor: (theme) => (theme.palette.mode === 'dark' ? '#0c0e14' : '#f8fafc'),
        color: 'text.primary',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* =========================================================================
          TOP APP HEADER (Compact)
          ========================================================================= */}
      <Paper
        elevation={1}
        sx={{
          py: 0.75,
          px: { xs: 1.5, md: 2.5 },
          borderRadius: 0,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'nowrap',
          gap: 1.5,
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        {/* Left Title & Status */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <IconButton
            size="small"
            onClick={() => navigate(`/events/${eventId}`)}
            sx={{ bgcolor: 'action.hover', borderRadius: 1.5, p: 0.5 }}
          >
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Typography variant="subtitle2" fontWeight={800} noWrap sx={{ lineHeight: 1.2 }}>
                Live Worship Presentation
              </Typography>
              <Chip
                label="LIVE ●"
                size="small"
                sx={{
                  bgcolor: isBlack ? '#ef4444' : isClear ? '#f59e0b' : '#22c55e',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.65rem',
                  height: 18,
                  px: 0.25,
                }}
              />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
              Authoritative Live Operator Console
            </Typography>
          </Box>
        </Box>

        {/* Center: Connected TV Display Counter */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            icon={<TvIcon style={{ fontSize: 16 }} />}
            label={`${viewerCount} ${viewerCount === 1 ? 'Display' : 'Displays'} Connected`}
            size="small"
            variant="outlined"
            color={viewerCount > 0 ? 'success' : 'default'}
            sx={{ fontWeight: 700 }}
          />

          <Chip
            label={`Code: ${liveState?.pairingCode || '----'}`}
            size="small"
            onClick={() => setPairingModalOpen(true)}
            sx={{
              fontWeight: 800,
              cursor: 'pointer',
              bgcolor: 'primary.main',
              color: '#ffffff',
              '&:hover': { bgcolor: 'primary.dark' },
            }}
          />
        </Box>

        {/* Right Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="Keyboard Shortcuts (Space, Arrows, B, C)">
            <IconButton size="small" onClick={() => setShortcutsModalOpen(true)}>
              <KeyboardIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Button
            size="small"
            variant="contained"
            color="primary"
            startIcon={<OpenInNewIcon fontSize="small" />}
            onClick={handlePopoutViewer}
            sx={{
              textTransform: 'none',
              borderRadius: 2,
              fontWeight: 800,
              boxShadow: '0 4px 14px rgba(56, 189, 248, 0.3)',
            }}
          >
            Pop Out TV Window
          </Button>
        </Box>
      </Paper>

      {/* =========================================================================
          MAIN 3-COLUMN WORKSPACE (Viewport-fitted)
          ========================================================================= */}
      <Box sx={{ flex: 1, minHeight: 0, p: { xs: 1, sm: 1.25 }, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Grid container spacing={1.25} sx={{ height: '100%', minHeight: 0, flex: 1 }}>
          {/* -------------------------------------------------------------
              COLUMN 1: SETLIST SONGS
              ------------------------------------------------------------- */}
          <Grid item xs={12} md={3} sx={{ height: '100%', minHeight: 0 }}>
            <Paper
              variant="outlined"
              sx={{
                p: 1.25,
                borderRadius: 2.5,
                height: '100%',
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Typography variant="caption" fontWeight={800} sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary', mb: 1 }}>
                Order of Worship ({songs.length})
              </Typography>

              <Stack spacing={0.75} sx={{ overflowY: 'auto', flex: 1, pr: 0.5 }}>
                {songs.map((song, idx) => {
                  const isSelected = song._id.toString() === currentSong?._id.toString();
                  return (
                    <Paper
                      key={song._id}
                      onClick={() => sendCommand('SET_SONG', { songId: song._id })}
                      sx={{
                        p: 1,
                        borderRadius: 1.5,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        border: '1.5px solid',
                        borderColor: isSelected ? 'primary.main' : 'divider',
                        bgcolor: isSelected
                          ? (theme) => (theme.palette.mode === 'dark' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(56, 189, 248, 0.08)')
                          : 'background.paper',
                        '&:hover': {
                          borderColor: 'primary.main',
                        },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="subtitle2" fontWeight={isSelected ? 800 : 600} noWrap sx={{ fontSize: '0.82rem' }}>
                          {idx + 1}. {song.title}
                        </Typography>
                        <Chip
                          size="small"
                          label={`Key ${song.targetKey || song.key || 'C'}`}
                          sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700 }}
                        />
                      </Box>
                      {song.artist && (
                        <Typography variant="caption" color="text.secondary" noWrap display="block" sx={{ fontSize: '0.7rem' }}>
                          {song.artist}
                        </Typography>
                      )}
                    </Paper>
                  );
                })}
              </Stack>
            </Paper>
          </Grid>

          {/* -------------------------------------------------------------
              COLUMN 2: SONG SECTIONS
              ------------------------------------------------------------- */}
          <Grid item xs={12} md={3.5} sx={{ height: '100%', minHeight: 0 }}>
            <Paper
              variant="outlined"
              sx={{
                p: 1.25,
                borderRadius: 2.5,
                height: '100%',
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" fontWeight={800} sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary' }}>
                  Song Sections
                </Typography>
                <Chip
                  size="small"
                  label={currentSong?.title || 'No Song'}
                  color="primary"
                  variant="outlined"
                  sx={{ fontWeight: 700, maxWidth: 140, height: 20, fontSize: '0.68rem' }}
                />
              </Box>

              <Stack spacing={0.75} sx={{ overflowY: 'auto', flex: 1, pr: 0.5 }}>
                {sections.map((sec, sIdx) => {
                  const isCurrentSec = sec.sectionId === liveState?.currentSectionId;
                  const totalChunks = sec.chunks?.length || 1;

                  return (
                    <Box
                      key={sec.sectionId}
                      sx={{
                        p: 1,
                        borderRadius: 2,
                        border: '1.5px solid',
                        borderColor: isCurrentSec ? 'primary.main' : 'divider',
                        bgcolor: isCurrentSec
                          ? (theme) => (theme.palette.mode === 'dark' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(56, 189, 248, 0.06)')
                          : 'background.paper',
                      }}
                    >
                      <Box
                        onClick={() => sendCommand('SET_SECTION', { sectionId: sec.sectionId, chunkIndex: 0 })}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          mb: totalChunks > 1 ? 0.5 : 0,
                        }}
                      >
                        <Typography variant="subtitle2" fontWeight={isCurrentSec ? 800 : 700} sx={{ fontSize: '0.82rem' }}>
                          {sec.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                          {totalChunks} {totalChunks === 1 ? 'slide' : 'slides'}
                        </Typography>
                      </Box>

                      {/* 2-line slide pills inside section */}
                      {totalChunks > 1 && (
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {sec.chunks.map((chunk, cIdx) => {
                            const isCurrentChunk = isCurrentSec && liveState?.currentChunkIndex === cIdx;
                            return (
                              <Button
                                key={cIdx}
                                size="small"
                                variant={isCurrentChunk ? 'contained' : 'outlined'}
                                onClick={() => sendCommand('SET_SECTION', { sectionId: sec.sectionId, chunkIndex: cIdx })}
                                sx={{
                                  minWidth: 26,
                                  height: 22,
                                  p: 0,
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  borderRadius: 1,
                                }}
                              >
                                {cIdx + 1}
                              </Button>
                            );
                          })}
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Stack>
            </Paper>
          </Grid>

          {/* -------------------------------------------------------------
              COLUMN 3: LIVE OUTPUT & NEXT PREVIEW (Compact & Non-scrolling)
              ------------------------------------------------------------- */}
          <Grid item xs={12} md={5.5} sx={{ height: '100%', minHeight: 0 }}>
            <Stack spacing={1.25} sx={{ height: '100%', minHeight: 0 }}>
              {/* CURRENT LIVE ON TV (Strictly 2 lines) */}
              <Paper
                elevation={3}
                sx={{
                  flex: '1 1 58%',
                  minHeight: 0,
                  p: 1.5,
                  borderRadius: 2.5,
                  bgcolor: isBlack ? '#000000' : isClear ? '#0f172a' : '#090a0f',
                  border: '2px solid',
                  borderColor: isBlack ? '#ef4444' : isClear ? '#f59e0b' : '#38bdf8',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                {/* Header Tag with Quick Live Slide Editor */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Chip
                      label={isBlack ? 'BLACK SCREEN ACTIVE' : isClear ? 'CLEAR SCREEN ACTIVE' : 'LIVE ON TV'}
                      size="small"
                      sx={{
                        fontWeight: 800,
                        fontSize: '0.65rem',
                        height: 20,
                        bgcolor: isBlack ? '#ef4444' : isClear ? '#f59e0b' : '#38bdf8',
                        color: '#000000',
                      }}
                    />
                    <Tooltip title={isEditingSlide ? 'Cancel Edit' : 'Quick Edit Slide & Chords'}>
                      <IconButton
                        size="small"
                        onClick={() => {
                          if (isEditingSlide) {
                            setIsEditingSlide(false);
                          } else {
                            setEditLine1(lineToInlineChordPro(currentLines[0] || { text: '', chords: [] }));
                            setEditLine2(lineToInlineChordPro(currentLines[1] || { text: '', chords: [] }));
                            setIsEditingSlide(true);
                          }
                        }}
                        sx={{
                          p: 0.3,
                          color: isEditingSlide ? '#38bdf8' : 'rgba(255,255,255,0.7)',
                          bgcolor: isEditingSlide ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.08)',
                          borderRadius: 1.5,
                          '&:hover': { bgcolor: 'rgba(56, 189, 248, 0.3)' },
                        }}
                      >
                        {isEditingSlide ? <CloseIcon sx={{ fontSize: 14 }} /> : <EditIcon sx={{ fontSize: 14 }} />}
                      </IconButton>
                    </Tooltip>
                  </Box>

                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: '0.72rem' }}>
                    {liveState?.currentSectionName || 'Section'} • Slide {(liveState?.currentChunkIndex || 0) + 1}
                  </Typography>
                </Box>

                {/* Live Output / Inline Slide Editor */}
                {isEditingSlide ? (
                  <Box sx={{ my: 'auto', py: 0.5, display: 'flex', flexDirection: 'column', gap: 0.75, overflow: 'hidden' }}>
                    <Typography variant="caption" sx={{ color: '#38bdf8', fontSize: '0.68rem', fontWeight: 700 }}>
                      Live Slide Editor (Inline chords: [G]Amazing [Em]grace)
                    </Typography>
                    <TextField
                      size="small"
                      value={editLine1}
                      onChange={(e) => setEditLine1(e.target.value)}
                      placeholder="Line 1: [G]Amazing grace [Em]how sweet"
                      variant="outlined"
                      fullWidth
                      inputProps={{
                        style: {
                          fontSize: '0.82rem',
                          padding: '5px 8px',
                          fontFamily: '"Outfit", "Inter", sans-serif',
                          color: '#ffffff',
                        },
                      }}
                      sx={{
                        bgcolor: 'rgba(255,255,255,0.06)',
                        borderRadius: 1.5,
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(56, 189, 248, 0.4)' },
                      }}
                    />
                    <TextField
                      size="small"
                      value={editLine2}
                      onChange={(e) => setEditLine2(e.target.value)}
                      placeholder="Line 2: [C]That saved a [G]wretch like me"
                      variant="outlined"
                      fullWidth
                      inputProps={{
                        style: {
                          fontSize: '0.82rem',
                          padding: '5px 8px',
                          fontFamily: '"Outfit", "Inter", sans-serif',
                          color: '#ffffff',
                        },
                      }}
                      sx={{
                        bgcolor: 'rgba(255,255,255,0.06)',
                        borderRadius: 1.5,
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(56, 189, 248, 0.4)' },
                      }}
                    />
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                      <Button
                        size="small"
                        onClick={() => setIsEditingSlide(false)}
                        sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', textTransform: 'none', py: 0.2 }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        color="primary"
                        startIcon={<SaveIcon sx={{ fontSize: 14 }} />}
                        onClick={() => {
                          const parsedLine1 = inlineChordProToLine(editLine1);
                          const parsedLine2 = inlineChordProToLine(editLine2);
                          sendCommand('UPDATE_CHUNK', { lines: [parsedLine1, parsedLine2] });
                          setIsEditingSlide(false);
                        }}
                        sx={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'none', py: 0.3, px: 1.5, borderRadius: 1.5 }}
                      >
                        Push Live to TV
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  /* 2-line rendering */
                  <Box sx={{ my: 'auto', py: 0.5, overflow: 'hidden' }}>
                    {isBlack ? (
                      <Typography variant="body2" sx={{ color: '#ef4444', textAlign: 'center', fontWeight: 700 }}>
                        [Screen is Blacked Out]
                      </Typography>
                    ) : isClear ? (
                      <Typography variant="body2" sx={{ color: '#f59e0b', textAlign: 'center', fontWeight: 700 }}>
                        [Screen is Cleared]
                      </Typography>
                    ) : currentLines.length === 0 ? (
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', display: 'block' }}>
                        No lyrics in this section
                      </Typography>
                    ) : (
                      currentLines.slice(0, 2).map((line, idx) => (
                        <AnchoredLyricRow
                          key={idx}
                          line={line}
                          showChords={showChords}
                          fontSize="clamp(1.05rem, 1.4vw, 1.25rem)"
                          chordColor="#38bdf8"
                          textColor="#ffffff"
                          align="left"
                        />
                      ))
                    )}
                  </Box>
                )}

                {/* Mode indicator footer */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 0.5, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.68rem' }}>
                    Mode: {displayMode}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.68rem' }}>
                    Max 2 lines per slide
                  </Typography>
                </Box>
              </Paper>

              {/* NEXT PREVIEW (Compact) */}
              <Paper
                variant="outlined"
                sx={{
                  flex: '0 0 auto',
                  maxHeight: '38%',
                  minHeight: 75,
                  p: 1.25,
                  borderRadius: 2.5,
                  bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
                  borderColor: 'divider',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  overflow: 'hidden',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.25 }}>
                  <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem' }}>
                    NEXT SLIDE PREVIEW
                  </Typography>
                  {liveState?.nextChunk?.sectionName && (
                    <Chip size="small" label={liveState.nextChunk.sectionName} sx={{ height: 18, fontSize: '0.65rem' }} />
                  )}
                </Box>

                <Box sx={{ my: 'auto', py: 0.25, overflow: 'hidden' }}>
                  {nextLines.length === 0 ? (
                    <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', display: 'block', textAlign: 'left', fontSize: '0.72rem' }}>
                      End of current song / setlist
                    </Typography>
                  ) : (
                    nextLines.slice(0, 2).map((line, idx) => (
                      <AnchoredLyricRow
                        key={idx}
                        line={line}
                        showChords={showChords}
                        fontSize="0.82rem"
                        chordColor="#94a3b8"
                        textColor={theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569'}
                        align="left"
                      />
                    ))
                  )}
                </Box>
              </Paper>
            </Stack>
          </Grid>
        </Grid>
      </Box>

      {/* =========================================================================
          BOTTOM CONTROL TOOLBAR (Compact)
          ========================================================================= */}
      <Paper
        elevation={3}
        sx={{
          py: 1,
          px: { xs: 1.5, md: 3 },
          borderRadius: 0,
          borderTop: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'nowrap',
          gap: 1.5,
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        {/* Left Side: Toggle buttons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            size="small"
            variant={isBlack ? 'contained' : 'outlined'}
            color={isBlack ? 'error' : 'inherit'}
            startIcon={<BlackoutIcon sx={{ fontSize: 18 }} />}
            onClick={() => sendCommand('BLACK_SCREEN')}
            sx={{ textTransform: 'none', borderRadius: 1.5, fontWeight: 700, fontSize: '0.8rem', py: 0.5, px: 1.2 }}
          >
            {isBlack ? 'Resume Video' : 'Black (B)'}
          </Button>

          <Button
            size="small"
            variant={isClear ? 'contained' : 'outlined'}
            color={isClear ? 'warning' : 'inherit'}
            startIcon={<ClearIcon sx={{ fontSize: 18 }} />}
            onClick={() => sendCommand('CLEAR_SCREEN')}
            sx={{ textTransform: 'none', borderRadius: 1.5, fontWeight: 700, fontSize: '0.8rem', py: 0.5, px: 1.2 }}
          >
            {isClear ? 'Resume (C)' : 'Clear (C)'}
          </Button>

          <Button
            size="small"
            variant={showChords ? 'contained' : 'outlined'}
            color="primary"
            startIcon={showChords ? <VisibilityIcon sx={{ fontSize: 18 }} /> : <VisibilityOffIcon sx={{ fontSize: 18 }} />}
            onClick={() => sendCommand('SET_DISPLAY_MODE', { mode: showChords ? 'LYRICS' : 'LYRICS_CHORDS' })}
            sx={{ textTransform: 'none', borderRadius: 1.5, fontWeight: 700, fontSize: '0.8rem', py: 0.5, px: 1.2 }}
          >
            {showChords ? 'Chords ON' : 'Chords OFF'}
          </Button>
        </Box>

        {/* Right Side: Step Navigation Buttons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<PrevIcon sx={{ fontSize: 18 }} />}
            onClick={() => sendCommand('PREV')}
            sx={{
              py: 0.6,
              px: 2,
              borderRadius: 2,
              fontWeight: 700,
              fontSize: '0.85rem',
              textTransform: 'none',
            }}
          >
            Previous
          </Button>

          <Button
            size="small"
            variant="contained"
            color="primary"
            endIcon={<NextIcon sx={{ fontSize: 18 }} />}
            onClick={() => sendCommand('NEXT')}
            sx={{
              py: 0.6,
              px: 3.5,
              borderRadius: 2,
              fontWeight: 800,
              fontSize: '0.9rem',
              textTransform: 'none',
              boxShadow: '0 4px 14px rgba(56, 189, 248, 0.3)',
            }}
          >
            NEXT (Space)
          </Button>
        </Box>
      </Paper>

      {/* =========================================================================
          DIALOG 1: DISPLAY PAIRING CODE POPUP
          ========================================================================= */}
      <Dialog open={pairingModalOpen} onClose={() => setPairingModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, textAlign: 'center' }}>
          Connect TV Display
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center', py: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Open the TV Presentation screen on your projector or display computer:
          </Typography>

          <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            4-Digit Pairing Code
          </Typography>
          <Typography variant="h2" fontWeight={900} sx={{ letterSpacing: '0.2em', my: 1, color: 'primary.main' }}>
            {liveState?.pairingCode || '----'}
          </Typography>

          <Button
            variant="outlined"
            size="small"
            startIcon={copiedCode ? <CheckIcon /> : <CopyIcon />}
            onClick={handleCopyPairingCode}
            sx={{ mt: 1, borderRadius: 2, textTransform: 'none' }}
          >
            {copiedCode ? 'Copied Code!' : 'Copy Code'}
          </Button>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button fullWidth variant="contained" onClick={() => setPairingModalOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* =========================================================================
          DIALOG 2: KEYBOARD SHORTCUTS
          ========================================================================= */}
      <Dialog open={shortcutsModalOpen} onClose={() => setShortcutsModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Keyboard Shortcuts</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">Advance to Next 2 Lines:</Typography>
              <Chip label="Space / Right Arrow" size="small" sx={{ fontWeight: 700 }} />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">Previous 2 Lines:</Typography>
              <Chip label="Left Arrow / Up Arrow" size="small" sx={{ fontWeight: 700 }} />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">Toggle Black Screen:</Typography>
              <Chip label="B" size="small" sx={{ fontWeight: 700 }} />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">Toggle Clear Screen:</Typography>
              <Chip label="C" size="small" sx={{ fontWeight: 700 }} />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button variant="contained" onClick={() => setShortcutsModalOpen(false)}>
            Got it
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
