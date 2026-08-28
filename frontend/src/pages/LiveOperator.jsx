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
  Menu,
  MenuItem,
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
  DeleteOutline as DeleteIcon,
  RestartAlt as RestoreIcon,
  Translate as TranslateIcon,
  VerticalSplit as SplitViewIcon,
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

function isSlideHidden(hiddenSlides, songId, sectionId, chunkIndex) {
  if (!hiddenSlides) return false;
  const key = `${songId}_${sectionId}_${chunkIndex}`;
  return Boolean(hiddenSlides[key]);
}

function getSongSectionsForLanguage(song, language = 'original') {
  if (!song) return [];
  if (language && language !== 'original' && song.regionalSections) {
    const langKey = language.toLowerCase();
    if (song.regionalSections[langKey] && song.regionalSections[langKey].length > 0) {
      return song.regionalSections[langKey];
    }
  }
  return song.sections || [];
}

function findNextValidSlide(songs, hiddenSlides, currentSongIdx, currentSecIdx, currentChunkIdx, language = 'original') {
  if (!Array.isArray(songs) || songs.length === 0) return null;
  const sStart = Math.max(0, currentSongIdx);

  for (let s = sStart; s < songs.length; s++) {
    const song = songs[s];
    const sections = getSongSectionsForLanguage(song, language);
    const secStart = s === sStart ? Math.max(0, currentSecIdx) : 0;

    for (let sec = secStart; sec < sections.length; sec++) {
      const section = sections[sec];
      const chunks = section.chunks || [];
      const chunkStart = (s === sStart && sec === secStart) ? currentChunkIdx + 1 : 0;

      for (let c = chunkStart; c < chunks.length; c++) {
        if (!isSlideHidden(hiddenSlides, song._id, section.sectionId, c)) {
          return {
            song,
            section,
            songIndex: s,
            sectionIndex: sec,
            chunkIndex: c,
            lines: chunks[c]?.lines || [],
          };
        }
      }
    }
  }
  return null;
}

function findPrevValidSlide(songs, hiddenSlides, currentSongIdx, currentSecIdx, currentChunkIdx, language = 'original') {
  if (!Array.isArray(songs) || songs.length === 0) return null;
  const sStart = Math.min(Math.max(0, currentSongIdx), songs.length - 1);

  for (let s = sStart; s >= 0; s--) {
    const song = songs[s];
    const sections = getSongSectionsForLanguage(song, language);
    const secStart = s === sStart ? Math.min(Math.max(0, currentSecIdx), sections.length - 1) : sections.length - 1;

    for (let sec = secStart; sec >= 0; sec--) {
      const section = sections[sec];
      const chunks = section.chunks || [];
      const chunkStart = (s === sStart && sec === secStart) ? currentChunkIdx - 1 : chunks.length - 1;

      for (let c = chunkStart; c >= 0; c--) {
        if (!isSlideHidden(hiddenSlides, song._id, section.sectionId, c)) {
          return {
            song,
            section,
            songIndex: s,
            sectionIndex: sec,
            chunkIndex: c,
            lines: chunks[c]?.lines || [],
          };
        }
      }
    }
  }
  return null;
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
  let activeLanguage = state.activeLanguage || 'original';
  let availableLanguages = state.availableLanguages || ['original'];
  let customChunkOverrides = { ...(state.customChunkOverrides || {}) };
  let hiddenSlides = { ...(state.hiddenSlides || {}) };

  let isSplitView = Boolean(
    state.isSplitView ||
      activeLanguage === 'split' ||
      (typeof activeLanguage === 'string' && activeLanguage.startsWith('split'))
  );

  let splitLanguage = state.splitLanguage || '';
  if (!splitLanguage && typeof activeLanguage === 'string' && activeLanguage.includes(':')) {
    splitLanguage = activeLanguage.split(':')[1];
  }
  if (!splitLanguage) {
    splitLanguage = availableLanguages.find((l) => l !== 'original') || 'Regional';
  }

  let leftChunk = [];
  let rightChunk = [];
  let nextLeftChunk = [];
  let nextRightChunk = [];

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
  } else if (type === 'SET_SPLIT_VIEW' || type === 'TOGGLE_SPLIT_VIEW') {
    isSplitView = payload?.isSplitView !== undefined ? payload.isSplitView : !isSplitView;
    if (payload?.splitLanguage) {
      splitLanguage = payload.splitLanguage;
    }
    if (isSplitView) {
      activeLanguage = `split:${splitLanguage || 'Regional'}`;
    } else {
      activeLanguage = 'original';
    }
  } else if (type === 'SET_LANGUAGE') {
    if (payload?.language) {
      activeLanguage = payload.language;
      if (payload.language.startsWith('split')) {
        isSplitView = true;
        if (payload.language.includes(':')) {
          splitLanguage = payload.language.split(':')[1];
        } else if (payload.splitLanguage) {
          splitLanguage = payload.splitLanguage;
        }
      } else {
        isSplitView = false;
      }
    }
  } else if (type === 'NEXT') {
    const curSongIdx = songs.findIndex((s) => s._id?.toString() === currentSongId?.toString());
    const curSecIdx = currentSong?.sections?.findIndex((s) => s.sectionId === currentSectionId) ?? 0;
    const nextValid = findNextValidSlide(songs, hiddenSlides, curSongIdx, curSecIdx, currentChunkIndex, activeLanguage);

    if (nextValid) {
      currentSong = nextValid.song;
      currentSongId = nextValid.song._id;
      currentSongTitle = nextValid.song.title;
      currentSongKey = nextValid.song.key;
      currentSectionId = nextValid.section.sectionId;
      currentSectionName = nextValid.section.name;
      currentChunkIndex = nextValid.chunkIndex;
      if (displayMode === 'BLACK' || displayMode === 'CLEAR') {
        displayMode = 'LYRICS_CHORDS';
      }
    }
  } else if (type === 'PREV') {
    const curSongIdx = songs.findIndex((s) => s._id?.toString() === currentSongId?.toString());
    const curSecIdx = currentSong?.sections?.findIndex((s) => s.sectionId === currentSectionId) ?? 0;
    const prevValid = findPrevValidSlide(songs, hiddenSlides, curSongIdx, curSecIdx, currentChunkIndex, activeLanguage);

    if (prevValid) {
      currentSong = prevValid.song;
      currentSongId = prevValid.song._id;
      currentSongTitle = prevValid.song.title;
      currentSongKey = prevValid.song.key;
      currentSectionId = prevValid.section.sectionId;
      currentSectionName = prevValid.section.name;
      currentChunkIndex = prevValid.chunkIndex;
      if (displayMode === 'BLACK' || displayMode === 'CLEAR') {
        displayMode = 'LYRICS_CHORDS';
      }
    }
  } else if (type === 'TOGGLE_HIDE_SLIDE' || type === 'HIDE_SLIDE' || type === 'DELETE_SLIDE') {
    const { songId, sectionId, chunkIndex } = payload || {};
    const targetSongId = songId || currentSongId;
    const targetSectionId = sectionId || currentSectionId;
    const targetChunkIdx = chunkIndex !== undefined ? chunkIndex : currentChunkIndex;
    const slideKey = `${targetSongId}_${targetSectionId}_${targetChunkIdx}`;

    if (type === 'HIDE_SLIDE' || type === 'DELETE_SLIDE') {
      hiddenSlides[slideKey] = true;
    } else {
      if (hiddenSlides[slideKey]) {
        delete hiddenSlides[slideKey];
      } else {
        hiddenSlides[slideKey] = true;
      }
    }
  } else if (type === 'TOGGLE_HIDE_SECTION' || type === 'HIDE_SECTION' || type === 'UNHIDE_SECTION') {
    const { songId, sectionId, hide } = payload || {};
    const targetSong = songs.find((s) => s._id?.toString() === (songId || currentSongId)?.toString());
    const targetSec = targetSong?.sections?.find((sec) => sec.sectionId === (sectionId || currentSectionId));
    if (targetSec && Array.isArray(targetSec.chunks)) {
      const shouldHide =
        hide !== undefined
          ? hide
          : !targetSec.chunks.every((_, cIdx) => isSlideHidden(hiddenSlides, targetSong._id, targetSec.sectionId, cIdx));
      targetSec.chunks.forEach((_, cIdx) => {
        const k = `${targetSong._id}_${targetSec.sectionId}_${cIdx}`;
        if (shouldHide) {
          hiddenSlides[k] = true;
        } else {
          delete hiddenSlides[k];
        }
      });
    }
  } else if (type === 'UNHIDE_ALL_SLIDES') {
    if (payload?.songId) {
      const prefix = `${payload.songId}_`;
      Object.keys(hiddenSlides).forEach((k) => {
        if (k.startsWith(prefix)) delete hiddenSlides[k];
      });
    } else {
      hiddenSlides = {};
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
    const defaultSections = currentSong.sections || [];
    const activeSections = getSongSectionsForLanguage(currentSong, activeLanguage);

    const secIdx = defaultSections.findIndex((sec) => sec.sectionId === currentSectionId);
    currentSectionIndex = secIdx >= 0 ? secIdx : 0;
    const curSec = defaultSections[currentSectionIndex] || { sectionId: '', name: 'Section', chunks: [] };
    currentSectionId = curSec.sectionId;
    currentSectionName = curSec.name;

    const langSec = activeSections[currentSectionIndex] || curSec;
    const chunks = langSec.chunks || [];
    let chunkIdx = Math.min(Math.max(currentChunkIndex || 0, 0), Math.max(chunks.length - 1, 0));
    currentChunkIndex = chunkIdx;
    const rawChunk = chunks[chunkIdx] || { lines: [] };

    const overrideKey = `${currentSongId}_${currentSectionId}_${chunkIdx}`;
    currentChunk = customChunkOverrides[overrideKey] || rawChunk.lines || [];

    // Build Split View Chunks
    const origSec = defaultSections[currentSectionIndex] || { chunks: [] };
    const origChunk = (origSec.chunks || [])[chunkIdx] || { lines: [] };
    leftChunk = origChunk.lines || [];

    const regSections = getSongSectionsForLanguage(currentSong, splitLanguage);
    const regSec = regSections[currentSectionIndex] || origSec;
    const regChunk = (regSec.chunks || [])[chunkIdx] || origChunk;
    rightChunk = regChunk.lines || [];

    const curSongIdx = songs.findIndex((s) => s._id?.toString() === currentSongId?.toString());
    const nextValid = findNextValidSlide(songs, hiddenSlides, curSongIdx, currentSectionIndex, chunkIdx, activeLanguage);

    if (nextValid) {
      nextChunk = {
        songTitle: nextValid.song._id?.toString() !== currentSongId?.toString() ? nextValid.song.title : undefined,
        sectionName: nextValid.section.name,
        lines: nextValid.lines,
      };

      const nextOrigSecs = nextValid.song.sections || [];
      const nextOrigSec = nextOrigSecs[nextValid.sectionIndex] || { chunks: [] };
      nextLeftChunk = (nextOrigSec.chunks || [])[nextValid.chunkIndex]?.lines || [];

      const nextRegSecs = getSongSectionsForLanguage(nextValid.song, splitLanguage);
      const nextRegSec = nextRegSecs[nextValid.sectionIndex] || nextOrigSec;
      nextRightChunk = (nextRegSec.chunks || [])[nextValid.chunkIndex]?.lines || [];
    } else {
      nextChunk = {
        sectionName: 'End of Service',
        lines: [],
      };
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
    activeLanguage,
    availableLanguages,
    isSplitView,
    splitLanguage,
    customChunkOverrides,
    hiddenSlides,
    currentChunk,
    leftChunk,
    rightChunk,
    nextChunk,
    nextLeftChunk,
    nextRightChunk,
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
  const [languageMenuAnchor, setLanguageMenuAnchor] = useState(null);

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

  const hiddenSlides = liveState?.hiddenSlides || {};
  const currentSlideKey = `${currentSong?._id}_${liveState?.currentSectionId}_${liveState?.currentChunkIndex}`;
  const isCurrentSlideHidden = Boolean(hiddenSlides[currentSlideKey]);
  const hiddenCountInCurrentSong = Object.keys(hiddenSlides).filter(
    (k) => currentSong?._id && k.startsWith(`${currentSong._id}_`)
  ).length;

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

        {/* Center: Connected TV Display Counter & Language Switcher */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
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

          {/* Live Language Selector for TV */}
          <Tooltip title="Switch Live Presentation Language / Split View on TV">
            <Chip
              icon={liveState?.isSplitView ? <SplitViewIcon style={{ fontSize: 15 }} /> : <TranslateIcon style={{ fontSize: 15 }} />}
              label={
                liveState?.isSplitView
                  ? `Split: English + ${liveState.splitLanguage || 'Regional'}`
                  : liveState?.activeLanguage && liveState.activeLanguage !== 'original'
                  ? `Lang: ${liveState.activeLanguage}`
                  : 'Lang: Original'
              }
              size="small"
              variant={liveState?.isSplitView ? 'filled' : 'outlined'}
              color={liveState?.isSplitView ? 'info' : liveState?.activeLanguage && liveState.activeLanguage !== 'original' ? 'warning' : 'default'}
              onClick={(e) => setLanguageMenuAnchor(e.currentTarget)}
              sx={{ fontWeight: 800, cursor: 'pointer' }}
            />
          </Tooltip>
          <Menu
            anchorEl={languageMenuAnchor}
            open={Boolean(languageMenuAnchor)}
            onClose={() => setLanguageMenuAnchor(null)}
          >
            <MenuItem
              selected={!liveState?.isSplitView && (!liveState?.activeLanguage || liveState.activeLanguage === 'original')}
              onClick={() => {
                sendCommand('SET_LANGUAGE', { language: 'original' });
                setLanguageMenuAnchor(null);
              }}
            >
              Original (English Only)
            </MenuItem>
            {(liveState?.availableLanguages || [])
              .filter((l) => l !== 'original')
              .map((lang) => (
                <MenuItem
                  key={lang}
                  selected={!liveState?.isSplitView && liveState?.activeLanguage?.toLowerCase() === lang.toLowerCase()}
                  onClick={() => {
                    sendCommand('SET_LANGUAGE', { language: lang });
                    setLanguageMenuAnchor(null);
                  }}
                >
                  {lang} (Full Screen)
                </MenuItem>
              ))}

            <Divider sx={{ my: 0.5 }} />

            {/* Split View Options */}
            {(liveState?.availableLanguages || [])
              .filter((l) => l !== 'original')
              .map((lang) => (
                <MenuItem
                  key={`split_${lang}`}
                  selected={Boolean(liveState?.isSplitView) && liveState?.splitLanguage?.toLowerCase() === lang.toLowerCase()}
                  onClick={() => {
                    sendCommand('SET_SPLIT_VIEW', { isSplitView: true, splitLanguage: lang });
                    setLanguageMenuAnchor(null);
                  }}
                >
                  <SplitViewIcon sx={{ fontSize: 16, mr: 1, color: '#38bdf8' }} />
                  Split View (English + {lang})
                </MenuItem>
              ))}
          </Menu>
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
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {Object.keys(hiddenSlides).filter((k) => k.startsWith(`${song._id}_`)).length > 0 && (
                            <Tooltip title={`${Object.keys(hiddenSlides).filter((k) => k.startsWith(`${song._id}_`)).length} slides hidden`}>
                              <Chip
                                size="small"
                                label={`${Object.keys(hiddenSlides).filter((k) => k.startsWith(`${song._id}_`)).length} hidden`}
                                color="warning"
                                sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700, px: 0.2 }}
                              />
                            </Tooltip>
                          )}
                          <Chip
                            size="small"
                            label={`Key ${song.targetKey || song.key || 'C'}`}
                            sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700 }}
                          />
                        </Box>
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
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {hiddenCountInCurrentSong > 0 && (
                    <Tooltip title="Restore/Unhide all hidden slides in this song">
                      <Chip
                        size="small"
                        icon={<RestoreIcon style={{ fontSize: 12 }} />}
                        label={`${hiddenCountInCurrentSong} hidden`}
                        onClick={() => sendCommand('UNHIDE_ALL_SLIDES', { songId: currentSong?._id })}
                        color="warning"
                        variant="outlined"
                        sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}
                      />
                    </Tooltip>
                  )}
                  <Chip
                    size="small"
                    label={currentSong?.title || 'No Song'}
                    color="primary"
                    variant="outlined"
                    sx={{ fontWeight: 700, maxWidth: 120, height: 20, fontSize: '0.68rem' }}
                  />
                </Box>
              </Box>

              <Stack spacing={0.75} sx={{ overflowY: 'auto', flex: 1, pr: 0.5 }}>
                {sections.map((sec, sIdx) => {
                  const isCurrentSec = sec.sectionId === liveState?.currentSectionId;
                  const totalChunks = sec.chunks?.length || 1;
                  const isAllSectionHidden = Array.isArray(sec.chunks) && sec.chunks.length > 0 && sec.chunks.every((_, cIdx) => Boolean(hiddenSlides[`${currentSong?._id}_${sec.sectionId}_${cIdx}`]));

                  return (
                    <Box
                      key={sec.sectionId}
                      sx={{
                        p: 1,
                        borderRadius: 2,
                        border: '1.5px solid',
                        borderColor: isCurrentSec ? 'primary.main' : isAllSectionHidden ? 'warning.dark' : 'divider',
                        bgcolor: isCurrentSec
                          ? (theme) => (theme.palette.mode === 'dark' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(56, 189, 248, 0.06)')
                          : isAllSectionHidden
                          ? (theme) => (theme.palette.mode === 'dark' ? 'rgba(245, 158, 11, 0.06)' : 'rgba(245, 158, 11, 0.04)')
                          : 'background.paper',
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          mb: totalChunks > 1 ? 0.5 : 0,
                        }}
                      >
                        <Box
                          onClick={() => sendCommand('SET_SECTION', { sectionId: sec.sectionId, chunkIndex: 0 })}
                          sx={{ display: 'flex', alignItems: 'center', gap: 0.75, cursor: 'pointer', flex: 1 }}
                        >
                          <Typography variant="subtitle2" fontWeight={isCurrentSec ? 800 : 700} sx={{ fontSize: '0.82rem' }}>
                            {sec.name}
                          </Typography>
                          {totalChunks === 1 && (
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                              (1 slide)
                            </Typography>
                          )}
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {totalChunks > 1 && (
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                              {totalChunks} slides
                            </Typography>
                          )}

                          {/* Quick Toggle Hide Entire Section */}
                          <Tooltip title={isAllSectionHidden ? "Unhide all slides in this section" : "Hide all slides in this section"}>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                sendCommand('TOGGLE_HIDE_SECTION', {
                                  songId: currentSong?._id,
                                  sectionId: sec.sectionId,
                                });
                              }}
                              sx={{
                                p: 0.2,
                                color: isAllSectionHidden ? '#f59e0b' : 'text.secondary',
                                opacity: 0.8,
                                '&:hover': { opacity: 1 },
                              }}
                            >
                              {isAllSectionHidden ? (
                                <VisibilityOffIcon sx={{ fontSize: 14 }} />
                              ) : (
                                <VisibilityIcon sx={{ fontSize: 14 }} />
                              )}
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>

                      {/* 2-line slide pills inside section */}
                      {totalChunks > 1 && (
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {sec.chunks.map((chunk, cIdx) => {
                            const isCurrentChunk = isCurrentSec && liveState?.currentChunkIndex === cIdx;
                            const isChunkHidden = Boolean(hiddenSlides[`${currentSong?._id}_${sec.sectionId}_${cIdx}`]);
                            return (
                              <Tooltip
                                key={cIdx}
                                title={
                                  isChunkHidden
                                    ? `Slide ${cIdx + 1} (HIDDEN - Click to view or right-click to unhide)`
                                    : `Slide ${cIdx + 1} (Right-click to hide/delete)`
                                }
                              >
                                <Button
                                  size="small"
                                  variant={isCurrentChunk ? 'contained' : 'outlined'}
                                  color={isChunkHidden ? 'inherit' : isCurrentChunk ? 'primary' : 'inherit'}
                                  onClick={() => sendCommand('SET_SECTION', { sectionId: sec.sectionId, chunkIndex: cIdx })}
                                  onContextMenu={(e) => {
                                    e.preventDefault();
                                    sendCommand('TOGGLE_HIDE_SLIDE', {
                                      songId: currentSong?._id,
                                      sectionId: sec.sectionId,
                                      chunkIndex: cIdx,
                                    });
                                  }}
                                  sx={{
                                    minWidth: 26,
                                    height: 22,
                                    p: 0,
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    borderRadius: 1,
                                    opacity: isChunkHidden ? 0.45 : 1,
                                    borderStyle: isChunkHidden ? 'dashed' : 'solid',
                                    borderColor: isChunkHidden ? 'warning.main' : undefined,
                                    textDecoration: isChunkHidden ? 'line-through' : 'none',
                                  }}
                                >
                                  {cIdx + 1}
                                </Button>
                              </Tooltip>
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
                  borderColor: isBlack ? '#ef4444' : isClear ? '#f59e0b' : isCurrentSlideHidden ? '#f59e0b' : '#38bdf8',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                {/* Header Tag with Quick Live Slide Editor & Hide/Delete Buttons */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Chip
                      label={isBlack ? 'BLACK SCREEN ACTIVE' : isClear ? 'CLEAR SCREEN ACTIVE' : isCurrentSlideHidden ? 'SLIDE HIDDEN ●' : 'LIVE ON TV'}
                      size="small"
                      sx={{
                        fontWeight: 800,
                        fontSize: '0.65rem',
                        height: 20,
                        bgcolor: isBlack ? '#ef4444' : isClear ? '#f59e0b' : isCurrentSlideHidden ? '#f59e0b' : '#38bdf8',
                        color: '#000000',
                      }}
                    />

                    {/* Quick Edit Slide & Chords */}
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

                    {/* Quick Hide / Unhide Slide Button */}
                    <Tooltip title={isCurrentSlideHidden ? 'Unhide Slide (Include in Live Presentation)' : 'Hide Slide (Skip this slide on TV)'}>
                      <IconButton
                        size="small"
                        onClick={() =>
                          sendCommand('TOGGLE_HIDE_SLIDE', {
                            songId: currentSong?._id,
                            sectionId: liveState?.currentSectionId,
                            chunkIndex: liveState?.currentChunkIndex,
                          })
                        }
                        sx={{
                          p: 0.3,
                          color: isCurrentSlideHidden ? '#f59e0b' : 'rgba(255,255,255,0.7)',
                          bgcolor: isCurrentSlideHidden ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255,255,255,0.08)',
                          borderRadius: 1.5,
                          '&:hover': { bgcolor: isCurrentSlideHidden ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255,255,255,0.18)' },
                        }}
                      >
                        {isCurrentSlideHidden ? <VisibilityIcon sx={{ fontSize: 14 }} /> : <VisibilityOffIcon sx={{ fontSize: 14 }} />}
                      </IconButton>
                    </Tooltip>

                    {/* Delete / Remove Slide Button */}
                    <Tooltip title="Delete Slide (Remove from Live Set)">
                      <IconButton
                        size="small"
                        onClick={() => {
                          sendCommand('HIDE_SLIDE', {
                            songId: currentSong?._id,
                            sectionId: liveState?.currentSectionId,
                            chunkIndex: liveState?.currentChunkIndex,
                          });
                        }}
                        sx={{
                          p: 0.3,
                          color: 'rgba(248, 113, 113, 0.85)',
                          bgcolor: 'rgba(239, 68, 68, 0.12)',
                          borderRadius: 1.5,
                          '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.25)', color: '#ef4444' },
                        }}
                      >
                        <DeleteIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: '0.72rem' }}>
                    {liveState?.currentSectionName || 'Section'} • Slide {(liveState?.currentChunkIndex || 0) + 1}
                  </Typography>
                </Box>

                {/* Hidden Slide Warning Bar */}
                {isCurrentSlideHidden && (
                  <Box
                    sx={{
                      bgcolor: 'rgba(245, 158, 11, 0.15)',
                      border: '1px solid rgba(245, 158, 11, 0.35)',
                      borderRadius: 1.5,
                      px: 1,
                      py: 0.25,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      mt: 0.25,
                    }}
                  >
                    <Typography variant="caption" sx={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.68rem' }}>
                      ⚠️ This slide is HIDDEN / DELETED (TV skips it)
                    </Typography>
                    <Button
                      size="small"
                      onClick={() =>
                        sendCommand('TOGGLE_HIDE_SLIDE', {
                          songId: currentSong?._id,
                          sectionId: liveState?.currentSectionId,
                          chunkIndex: liveState?.currentChunkIndex,
                        })
                      }
                      sx={{ color: '#f59e0b', fontSize: '0.65rem', py: 0, textTransform: 'none', fontWeight: 800 }}
                    >
                      Unhide / Restore
                    </Button>
                  </Box>
                )}

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
                    ) : liveState?.isSplitView ? (
                      <Grid container spacing={1.5} alignItems="flex-start">
                        <Grid item xs={6}>
                          <Typography
                            variant="caption"
                            sx={{
                              color: '#94a3b8',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              fontSize: '0.65rem',
                              display: 'block',
                              mb: 0.25,
                            }}
                          >
                            {liveState?.currentSectionName || 'Section'} (English)
                          </Typography>
                          {(liveState?.leftChunk || []).slice(0, 2).map((line, idx) => (
                            <AnchoredLyricRow
                              key={`op_left_${idx}`}
                              line={line}
                              showChords={showChords}
                              fontSize="clamp(0.85rem, 1.1vw, 1rem)"
                              chordColor="#38bdf8"
                              textColor="#ffffff"
                              align="left"
                            />
                          ))}
                        </Grid>
                        <Grid item xs={6} sx={{ borderLeft: '1px solid rgba(255,255,255,0.12)', pl: 1.5 }}>
                          <Typography
                            variant="caption"
                            sx={{
                              color: '#38bdf8',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              fontSize: '0.65rem',
                              display: 'block',
                              mb: 0.25,
                            }}
                          >
                            {liveState?.currentSectionName || 'Section'} ({liveState?.splitLanguage || 'Regional'})
                          </Typography>
                          {(liveState?.rightChunk || []).slice(0, 2).map((line, idx) => (
                            <AnchoredLyricRow
                              key={`op_right_${idx}`}
                              line={line}
                              showChords={showChords}
                              fontSize="clamp(0.85rem, 1.1vw, 1rem)"
                              chordColor="#38bdf8"
                              textColor="#ffffff"
                              align="left"
                            />
                          ))}
                        </Grid>
                      </Grid>
                    ) : currentLines.length === 0 ? (
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', display: 'block' }}>
                        No lyrics in this section
                      </Typography>
                    ) : (
                      <>
                        {liveState?.currentSectionName && (
                          <Typography
                            variant="caption"
                            sx={{
                              color: '#94a3b8',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              letterSpacing: '0.08em',
                              fontSize: '0.68rem',
                              display: 'block',
                              mb: 0.4,
                              textAlign: 'left',
                              opacity: 0.9,
                            }}
                          >
                            {liveState.currentSectionName}
                          </Typography>
                        )}
                        {currentLines.slice(0, 2).map((line, idx) => (
                          <AnchoredLyricRow
                            key={idx}
                            line={line}
                            showChords={showChords}
                            fontSize="clamp(1.05rem, 1.4vw, 1.25rem)"
                            chordColor="#38bdf8"
                            textColor="#ffffff"
                            align="left"
                          />
                        ))}
                      </>
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
