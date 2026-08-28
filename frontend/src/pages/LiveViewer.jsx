import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  CircularProgress,
  Alert,
  IconButton,
  Fade,
} from '@mui/material';
import {
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  Tv as TvIcon,
  Wifi as WifiIcon,
  WifiOff as WifiOffIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { io } from 'socket.io-client';
import api from '../services/api';
import AnchoredLyricRow from '../components/live/AnchoredLyricRow';

export default function LiveViewer() {
  const { eventId: routeEventId, token: routeToken } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const directEventId = routeEventId || searchParams.get('eventId') || '';
  const [displayToken, setDisplayToken] = useState(
    routeToken || localStorage.getItem('wplanner_display_token') || ''
  );
  const [pairingCodeInput, setPairingCodeInput] = useState('');
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingError, setPairingError] = useState('');

  // Live state received from server
  const [liveState, setLiveState] = useState(null);
  const [loadingState, setLoadingState] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(false);

  const socketRef = useRef(null);
  const hideControlsTimeout = useRef(null);

  // Sync route token with state
  useEffect(() => {
    if (routeToken && routeToken !== displayToken) {
      setDisplayToken(routeToken);
      localStorage.setItem('wplanner_display_token', routeToken);
    }
  }, [routeToken, displayToken]);

  // Handle Display Pairing
  const handlePairSubmit = async (e) => {
    if (e) e.preventDefault();
    const code = pairingCodeInput.trim();
    if (code.length < 4) {
      setPairingError('Please enter a 4-digit pairing code');
      return;
    }

    try {
      setPairingLoading(true);
      setPairingError('');
      const res = await api.post('/live/pair', { pairingCode: code });
      const { token, eventId } = res.data;
      localStorage.setItem('wplanner_display_token', token);
      setDisplayToken(token);
      navigate(`/live/viewer/${token}`, { replace: true });
    } catch (err) {
      console.error('Pairing error:', err);
      setPairingError(err?.response?.data?.message || 'Invalid or expired pairing code');
    } finally {
      setPairingLoading(false);
    }
  };

  // Fetch initial viewer state via REST
  const fetchViewerState = useCallback(async () => {
    try {
      setLoadingState(true);
      if (directEventId) {
        const res = await api.get(`/live/viewer/event/${directEventId}`);
        setLiveState(res.data);
      } else if (displayToken) {
        const res = await api.get(`/live/viewer/state/${displayToken}`);
        setLiveState(res.data);
      }
    } catch (err) {
      console.error('Failed to load viewer state:', err);
      if (err?.response?.status === 401 && !directEventId) {
        localStorage.removeItem('wplanner_display_token');
        setDisplayToken('');
      }
    } finally {
      setLoadingState(false);
    }
  }, [directEventId, displayToken]);

  // Connect WebSocket & BroadcastChannel for real-time live synchronization
  useEffect(() => {
    if (!displayToken && !directEventId) {
      setLoadingState(false);
      return;
    }

    fetchViewerState();

    const socketUrl =
      import.meta.env.VITE_SOCKET_URL ||
      (import.meta.env.DEV ? 'http://localhost:3000' : 'https://wplanner-j7a7.onrender.com');

    const socketQuery = directEventId
      ? { eventId: directEventId, isViewer: 'true' }
      : { displayToken };

    const socket = io(socketUrl, {
      path: '/socket.io',
      query: socketQuery,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 15,
      reconnectionDelay: 1500,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      if (directEventId) {
        socket.emit('live:viewer:join', { eventId: directEventId });
      } else {
        socket.emit('live:viewer:join', { token: displayToken });
      }
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Real-time authoritative live state update from WebSocket
    socket.on('live:state:updated', (newState) => {
      if (newState) {
        setLiveState((prev) => ({
          ...prev,
          ...newState,
        }));
      }
    });

    // Zero-latency instant BroadcastChannel listener across same-machine tabs/popups
    const channelId = directEventId || liveState?.eventId;
    let bc = null;
    if (channelId && typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel(`wplanner_live_${channelId}`);
        bc.onmessage = (evt) => {
          if (evt.data?.payload) {
            setLiveState((prev) => ({
              ...prev,
              ...evt.data.payload,
            }));
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel not supported:', e);
      }
    }

    return () => {
      socket.disconnect();
      if (bc) bc.close();
    };
  }, [directEventId, displayToken, fetchViewerState, liveState?.eventId]);

  // Mouse movement hides top indicator after 3 seconds
  const handleMouseMove = () => {
    setShowControls(true);
    if (hideControlsTimeout.current) clearTimeout(hideControlsTimeout.current);
    hideControlsTimeout.current = setTimeout(() => {
      setShowControls(false);
    }, 3500);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // =========================================================================
  // VIEW 1: PAIRING SCREEN (When display is not yet paired and no direct eventId)
  // =========================================================================
  if (!displayToken && !directEventId) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          width: '100vw',
          bgcolor: '#090a0f',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
          fontFamily: '"Outfit", "Inter", sans-serif',
        }}
      >
        <Paper
          elevation={10}
          sx={{
            maxWidth: 480,
            width: '100%',
            p: { xs: 3, sm: 5 },
            borderRadius: 4,
            bgcolor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            textAlign: 'center',
          }}
        >
          <Box
            sx={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              bgcolor: 'rgba(56, 189, 248, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 3,
            }}
          >
            <TvIcon sx={{ fontSize: 38, color: '#38bdf8' }} />
          </Box>

          <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: '-0.02em', mb: 1 }}>
            wPlanner Live
          </Typography>
          <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.65)', mb: 4 }}>
            Connect this display or TV to the live worship session
          </Typography>

          {pairingError && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
              {pairingError}
            </Alert>
          )}

          <form onSubmit={handlePairSubmit}>
            <Typography variant="caption" sx={{ color: '#38bdf8', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 1, display: 'block' }}>
              Enter 4-Digit Display Code
            </Typography>
            <TextField
              fullWidth
              autoFocus
              variant="outlined"
              value={pairingCodeInput}
              onChange={(e) => setPairingCodeInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="e.g. 7429"
              inputProps={{
                style: {
                  textAlign: 'center',
                  fontSize: '2.5rem',
                  letterSpacing: '0.4em',
                  fontWeight: 800,
                  color: '#ffffff',
                  padding: '12px 16px',
                },
                maxLength: 4,
                inputMode: 'numeric',
              }}
              sx={{
                mb: 3,
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: 3,
                  '& fieldset': { borderColor: 'rgba(56, 189, 248, 0.4)' },
                  '&:hover fieldset': { borderColor: '#38bdf8' },
                  '&.Mui-focused fieldset': { borderColor: '#38bdf8', borderWidth: 2 },
                },
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={pairingLoading || pairingCodeInput.length < 4}
              sx={{
                py: 1.6,
                borderRadius: 3,
                fontWeight: 700,
                fontSize: '1.05rem',
                textTransform: 'none',
                background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
                boxShadow: '0 8px 24px rgba(56, 189, 248, 0.3)',
              }}
            >
              {pairingLoading ? <CircularProgress size={24} color="inherit" /> : 'Connect Live Display'}
            </Button>
          </form>
        </Paper>
      </Box>
    );
  }

  // =========================================================================
  // VIEW 2: PRESENTATION SCREEN (Clean TV / Projector Display)
  // =========================================================================
  if (loadingState && !liveState) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          width: '100vw',
          bgcolor: '#000000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress sx={{ color: '#38bdf8' }} size={48} />
      </Box>
    );
  }

  const displayMode = liveState?.displayMode || 'LYRICS_CHORDS';
  const isBlackScreen = displayMode === 'BLACK';
  const isClearScreen = displayMode === 'CLEAR';
  const showChords = displayMode === 'LYRICS_CHORDS' || displayMode === 'CHORDS';

  // Strictly enforce TWO lyric lines at any given time
  const rawChunkLines = Array.isArray(liveState?.currentChunk) ? liveState.currentChunk : [];
  const displayLines = rawChunkLines.slice(0, 2);
  const nextLines = Array.isArray(liveState?.nextChunk?.lines) ? liveState.nextChunk.lines.slice(0, 2) : [];

  return (
    <Box
      onMouseMove={handleMouseMove}
      sx={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        bgcolor: '#000000',
        color: '#ffffff',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        p: { xs: 2, sm: 4, md: 6, lg: 8 },
        boxSizing: 'border-box',
      }}
    >
      {/* Top Floating Subtle Status Indicator (Shows briefly on mouse movement) */}
      <Fade in={showControls}>
        <Box
          sx={{
            position: 'absolute',
            top: 20,
            left: 24,
            right: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 50,
            pointerEvents: 'auto',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', px: 2, py: 0.75, borderRadius: 3, border: '1px solid rgba(255,255,255,0.1)' }}>
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: isConnected ? '#22c55e' : '#ef4444',
                boxShadow: isConnected ? '0 0 10px #22c55e' : 'none',
              }}
            />
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.05em' }}>
              {isConnected ? 'LIVE SYNC' : 'RECONNECTING...'}
            </Typography>
            {liveState?.currentSongTitle && (
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', ml: 1 }}>
                • {liveState.currentSongTitle} ({liveState.currentSectionName})
              </Typography>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              size="small"
              onClick={() => fetchViewerState(displayToken)}
              sx={{ color: 'rgba(255,255,255,0.7)', bgcolor: 'rgba(0,0,0,0.6)', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
              title="Refresh State"
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={toggleFullscreen}
              sx={{ color: 'rgba(255,255,255,0.7)', bgcolor: 'rgba(0,0,0,0.6)', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
            </IconButton>
          </Box>
        </Box>
      </Fade>

      {/* =========================================================================
          MAIN 2-LINE PRESENTATION CONTAINER
          ========================================================================= */}
      {isBlackScreen ? (
        // Mode: BLACK (Complete blackout for transitions / sermon / prayer)
        <Box sx={{ width: '100%', height: '100%', bgcolor: '#000000' }} />
      ) : isClearScreen || displayLines.length === 0 ? (
        // Mode: CLEAR (Clean empty state)
        <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Fade in={true} timeout={1000}>
            <Typography variant="h5" sx={{ color: 'rgba(255,255,255,0.15)', fontWeight: 600, letterSpacing: '0.1em' }}>
              wPlanner Live
            </Typography>
          </Fade>
        </Box>
      ) : (
        // Main 2-Line High Contrast Presentation
        <Fade in={true} timeout={250} key={`${liveState?.currentSongTitle}_${liveState?.currentSectionName}_${JSON.stringify(displayLines)}`}>
          <Box
            sx={{
              maxWidth: '92vw',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              justifyContent: 'center',
              textAlign: 'left',
              gap: { xs: 2, sm: 3, md: 4.5 },
              px: { xs: 2, sm: 4, md: 8, lg: 12 },
              pb: nextLines.length > 0 ? { xs: 12, sm: 14, md: 18 } : 0,
            }}
          >
            {displayLines.map((lineObj, idx) => (
              <AnchoredLyricRow
                key={idx}
                line={lineObj}
                showChords={showChords}
                fontSize="clamp(2.0rem, 4.4vw, 4.6rem)"
                chordColor="#38bdf8"
                textColor="#ffffff"
                align="left"
              />
            ))}
          </Box>
        </Fade>
      )}

      {/* =========================================================================
          BOTTOM NEXT SLIDE PREVIEW (Subtle Gray Preview for Zero Hesitation)
          ========================================================================= */}
      {!isBlackScreen && !isClearScreen && nextLines.length > 0 && (
        <Box
          sx={{
            position: 'absolute',
            bottom: { xs: 16, sm: 24, md: 32 },
            left: 0,
            right: 0,
            px: { xs: 3, sm: 5, md: 9, lg: 13 },
            maxWidth: '92vw',
            mx: 'auto',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            pt: { xs: 1, sm: 1.5 },
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            opacity: 0.7,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: '#64748b',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontSize: '0.72rem',
              mb: 0.25,
            }}
          >
            Next {liveState?.nextChunk?.sectionName ? `(${liveState.nextChunk.sectionName})` : ''}
          </Typography>
          {nextLines.map((lineObj, idx) => (
            <AnchoredLyricRow
              key={`next_slide_${idx}`}
              line={lineObj}
              showChords={showChords}
              fontSize="clamp(1.1rem, 2.1vw, 2.1rem)"
              chordColor="rgba(56, 189, 248, 0.5)"
              textColor="#94a3b8"
              align="left"
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
