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
  Menu,
  MenuItem,
  Chip,
  Grid,
  Divider,
} from '@mui/material';
import {
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  Tv as TvIcon,
  Wifi as WifiIcon,
  WifiOff as WifiOffIcon,
  Refresh as RefreshIcon,
  Translate as TranslateIcon,
  VerticalSplit as SplitViewIcon,
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
  const [languageMenuAnchor, setLanguageMenuAnchor] = useState(null);

  const socketRef = useRef(null);
  const hideControlsTimeout = useRef(null);

  // Sync route token with state
  useEffect(() => {
    if (routeToken && routeToken !== displayToken) {
      setDisplayToken(routeToken);
      localStorage.setItem('wplanner_display_token', routeToken);
    }
  }, [routeToken, displayToken]);

  // Fetch Viewer State by token or direct event ID
  const fetchViewerState = useCallback(async (token) => {
    try {
      setLoadingState(true);
      if (token) {
        const res = await api.get(`/live/display/${token}`);
        setLiveState(res.data);
      } else if (directEventId) {
        const res = await api.get(`/live/session/${directEventId}`);
        setLiveState(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch viewer state:', err);
    } finally {
      setLoadingState(false);
    }
  }, [directEventId]);

  // Connect WebSocket
  useEffect(() => {
    if (!displayToken && !directEventId) {
      setLoadingState(false);
      return;
    }

    fetchViewerState(displayToken);

    const socketUrl =
      import.meta.env.VITE_SOCKET_URL ||
      (import.meta.env.DEV ? 'http://localhost:3000' : 'https://wplanner-j7a7.onrender.com');

    const socket = io(socketUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 25,
      reconnectionDelay: 1000,
      timeout: 5000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      if (displayToken) {
        socket.emit('live:viewer:join', { token: displayToken });
      } else if (directEventId) {
        socket.emit('live:viewer:join', { eventId: directEventId });
      }
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('live:state:updated', (newState) => {
      if (newState) {
        setLiveState((prev) => ({
          ...prev,
          ...newState,
        }));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [displayToken, directEventId, fetchViewerState]);

  // Local BroadcastChannel for zero-latency presentation in same-browser popups
  useEffect(() => {
    const activeEventId = directEventId || liveState?.eventId;
    if (!activeEventId || typeof BroadcastChannel === 'undefined') return;

    try {
      const channel = new BroadcastChannel(`wplanner_live_${activeEventId}`);
      channel.onmessage = (event) => {
        if (event.data?.type === 'LIVE_STATE_UPDATE' && event.data?.payload) {
          setLiveState((prev) => ({
            ...prev,
            ...event.data.payload,
          }));
        }
      };
      return () => {
        channel.close();
      };
    } catch {
      // Ignored if BroadcastChannel unsupported
    }
  }, [directEventId, liveState?.eventId]);

  // Auto-hide top toolbar on idle mouse
  const handleMouseMove = () => {
    setShowControls(true);
    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current);
    }
    hideControlsTimeout.current = setTimeout(() => {
      setShowControls(false);
    }, 2800);
  };

  // Toggle Fullscreen mode
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error('Error enabling fullscreen:', err);
      });
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  // Pair display with code
  const handlePairDisplay = async (e) => {
    e.preventDefault();
    if (!pairingCodeInput.trim()) return;

    try {
      setPairingLoading(true);
      setPairingError('');
      const res = await api.post('/live/pair', {
        pairingCode: pairingCodeInput.trim().toUpperCase(),
        name: navigator.userAgent.includes('TV') ? 'Smart TV Display' : 'Presentation Display',
      });
      const token = res.data.token;
      setDisplayToken(token);
      localStorage.setItem('wplanner_display_token', token);
      fetchViewerState(token);
    } catch (err) {
      console.error('Pairing failed:', err);
      setPairingError(err?.response?.data?.message || 'Invalid or expired pairing code.');
    } finally {
      setPairingLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Unpaired / Setup Screen
  // -------------------------------------------------------------
  if (!displayToken && !directEventId && !liveState) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          width: '100vw',
          bgcolor: '#0a0f1d',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
        }}
      >
        <Paper
          elevation={6}
          sx={{
            p: { xs: 3, sm: 5 },
            maxWidth: 480,
            width: '100%',
            borderRadius: 4,
            bgcolor: '#131b2e',
            color: '#ffffff',
            border: '1px solid rgba(255,255,255,0.1)',
            textAlign: 'center',
          }}
        >
          <TvIcon sx={{ fontSize: 56, color: 'primary.main', mb: 2 }} />
          <Typography variant="h5" fontWeight={800} gutterBottom>
            wPlanner TV Display
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4, color: 'rgba(255,255,255,0.7)' }}>
            Enter the 4-digit pairing code shown on the worship leader's live console.
          </Typography>

          {pairingError && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {pairingError}
            </Alert>
          )}

          <Box component="form" onSubmit={handlePairDisplay} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <TextField
              variant="outlined"
              placeholder="e.g. 8492"
              value={pairingCodeInput}
              onChange={(e) => setPairingCodeInput(e.target.value.toUpperCase())}
              inputProps={{
                maxLength: 6,
                style: {
                  textAlign: 'center',
                  fontSize: '2rem',
                  fontWeight: 900,
                  letterSpacing: '0.25em',
                  color: '#38bdf8',
                },
              }}
              sx={{
                bgcolor: 'rgba(0,0,0,0.3)',
                borderRadius: 2,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
              }}
            />

            <Button
              type="submit"
              variant="contained"
              color="primary"
              size="large"
              disabled={pairingLoading || !pairingCodeInput.trim()}
              sx={{
                py: 1.5,
                fontWeight: 800,
                fontSize: '1rem',
                borderRadius: 2,
                boxShadow: '0 4px 16px rgba(56, 189, 248, 0.4)',
              }}
            >
              {pairingLoading ? <CircularProgress size={24} color="inherit" /> : 'Connect Live Screen'}
            </Button>
          </Box>
        </Paper>
      </Box>
    );
  }

  // -------------------------------------------------------------
  // Initial Loading Screen
  // -------------------------------------------------------------
  if (loadingState && !liveState) {
    return (
      <Box
        sx={{
          height: '100vh',
          width: '100vw',
          bgcolor: '#000000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <CircularProgress size={48} sx={{ color: '#38bdf8' }} />
        <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
          Syncing Live Worship Presentation...
        </Typography>
      </Box>
    );
  }

  // Presentation Mode Values
  const displayMode = liveState?.displayMode || 'LYRICS_CHORDS';
  const isBlackScreen = displayMode === 'BLACK';
  const isClearScreen = displayMode === 'CLEAR';
  const showChords = displayMode === 'LYRICS_CHORDS' || displayMode === 'CHORDS';

  const hiddenSlides = liveState?.hiddenSlides || {};
  const currentSlideKey = `${liveState?.currentSongId}_${liveState?.currentSectionId}_${liveState?.currentChunkIndex}`;
  const isSlideHidden = Boolean(hiddenSlides[currentSlideKey]);
  const shouldClearTV = isClearScreen || isSlideHidden;

  const isSplitView = Boolean(liveState?.isSplitView);
  const splitLanguage = liveState?.splitLanguage || 'Regional';

  // Strictly enforce TWO lyric lines at any given time
  const rawChunkLines = Array.isArray(liveState?.currentChunk) ? liveState.currentChunk : [];
  const displayLines = shouldClearTV ? [] : rawChunkLines.slice(0, 2);

  // Split View lines: Left = English, Right = Regional
  const rawLeftChunk = Array.isArray(liveState?.leftChunk) ? liveState.leftChunk : displayLines;
  const rawRightChunk = Array.isArray(liveState?.rightChunk) ? liveState.rightChunk : displayLines;
  const splitLeftLines = shouldClearTV ? [] : rawLeftChunk.slice(0, 2);
  const splitRightLines = shouldClearTV ? [] : rawRightChunk.slice(0, 2);

  const nextLines = Array.isArray(liveState?.nextChunk?.lines) ? liveState.nextChunk.lines.slice(0, 2) : [];
  const nextLeftLines = Array.isArray(liveState?.nextLeftChunk) ? liveState.nextLeftChunk.slice(0, 2) : nextLines;
  const nextRightLines = Array.isArray(liveState?.nextRightChunk) ? liveState.nextRightChunk.slice(0, 2) : nextLines;

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
        p: { xs: 2, sm: 3, md: 4 },
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
            {/* Language & Split View Switcher */}
            {Array.isArray(liveState?.availableLanguages) && liveState.availableLanguages.length > 1 && (
              <>
                <Chip
                  icon={isSplitView ? <SplitViewIcon style={{ fontSize: 14, color: '#38bdf8' }} /> : <TranslateIcon style={{ fontSize: 14, color: '#ffffff' }} />}
                  label={
                    isSplitView
                      ? `Split View (${splitLanguage})`
                      : liveState?.activeLanguage && liveState.activeLanguage !== 'original'
                      ? liveState.activeLanguage
                      : 'Original'
                  }
                  size="small"
                  onClick={(e) => setLanguageMenuAnchor(e.currentTarget)}
                  sx={{
                    bgcolor: isSplitView ? 'rgba(56, 189, 248, 0.2)' : 'rgba(0,0,0,0.6)',
                    color: isSplitView ? '#38bdf8' : '#ffffff',
                    border: isSplitView ? '1px solid #38bdf8' : 'none',
                    fontWeight: 800,
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
                  }}
                />
                <Menu
                  anchorEl={languageMenuAnchor}
                  open={Boolean(languageMenuAnchor)}
                  onClose={() => setLanguageMenuAnchor(null)}
                >
                  <MenuItem
                    selected={!isSplitView && (!liveState?.activeLanguage || liveState.activeLanguage === 'original')}
                    onClick={() => {
                      if (socketRef.current) {
                        socketRef.current.emit('live:command', {
                          eventId: directEventId || liveState?.eventId,
                          type: 'SET_LANGUAGE',
                          payload: { language: 'original' },
                        });
                      }
                      setLanguageMenuAnchor(null);
                    }}
                  >
                    Original (English Only)
                  </MenuItem>

                  {liveState.availableLanguages
                    .filter((l) => l !== 'original')
                    .map((lang) => (
                      <MenuItem
                        key={lang}
                        selected={!isSplitView && liveState?.activeLanguage?.toLowerCase() === lang.toLowerCase()}
                        onClick={() => {
                          if (socketRef.current) {
                            socketRef.current.emit('live:command', {
                              eventId: directEventId || liveState?.eventId,
                              type: 'SET_LANGUAGE',
                              payload: { language: lang },
                            });
                          }
                          setLanguageMenuAnchor(null);
                        }}
                      >
                        {lang} (Full Screen)
                      </MenuItem>
                    ))}

                  <Divider sx={{ my: 0.5 }} />

                  {/* Split View Options */}
                  {liveState.availableLanguages
                    .filter((l) => l !== 'original')
                    .map((lang) => (
                      <MenuItem
                        key={`split_${lang}`}
                        selected={isSplitView && splitLanguage.toLowerCase() === lang.toLowerCase()}
                        onClick={() => {
                          if (socketRef.current) {
                            socketRef.current.emit('live:command', {
                              eventId: directEventId || liveState?.eventId,
                              type: 'SET_SPLIT_VIEW',
                              payload: { isSplitView: true, splitLanguage: lang },
                            });
                          }
                          setLanguageMenuAnchor(null);
                        }}
                      >
                        <SplitViewIcon sx={{ fontSize: 16, mr: 1, color: '#38bdf8' }} />
                        Split View (English + {lang})
                      </MenuItem>
                    ))}
                </Menu>
              </>
            )}

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
          MAIN PRESENTATION CONTAINER (Standard 2-Line or Bilingual Split View)
          ========================================================================= */}
      {isBlackScreen ? (
        // Mode: BLACK (Complete blackout for transitions / sermon / prayer)
        <Box sx={{ width: '100%', height: '100%', bgcolor: '#000000' }} />
      ) : isClearScreen || (isSplitView ? splitLeftLines.length === 0 && splitRightLines.length === 0 : displayLines.length === 0) ? (
        // Mode: CLEAR (Clean empty state)
        <Box sx={{ flex: 1, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Fade in={true} timeout={1000}>
            <Typography variant="h5" sx={{ color: 'rgba(255,255,255,0.15)', fontWeight: 600, letterSpacing: '0.1em' }}>
              wPlanner Live
            </Typography>
          </Fade>
        </Box>
      ) : isSplitView ? (
        // ================= SPLIT VIEW (Left: English, Right: Regional Language) =================
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          {/* Main Slide Content: 2 Columns Side-by-Side */}
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              width: '100%',
              maxWidth: '96vw',
              mx: 'auto',
              px: { xs: 1, sm: 2, md: 3 },
              overflow: 'hidden',
            }}
          >
            <Fade in={true} timeout={120} key={`split_${liveState?.currentSongTitle}_${liveState?.currentSectionName}_${liveState?.currentChunkIndex}`}>
              <Grid container spacing={{ xs: 2, sm: 3, md: 4 }} alignItems="center" sx={{ height: '100%' }}>
                {/* Left Column: English (Original) */}
                <Grid item xs={6} sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1, sm: 1.5, md: 2 } }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: '#94a3b8',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.14em',
                      fontSize: 'clamp(0.8rem, 1.1vw, 1.15rem)',
                      opacity: 0.85,
                    }}
                  >
                    {liveState?.currentSectionName ? `${liveState.currentSectionName} (English)` : 'English'}
                  </Typography>

                  {splitLeftLines.map((lineObj, idx) => (
                    <AnchoredLyricRow
                      key={`left_${idx}`}
                      line={lineObj}
                      showChords={showChords}
                      fontSize={showChords ? 'clamp(1.4rem, 2.4vw, 2.8rem)' : 'clamp(1.7rem, 2.9vw, 3.4rem)'}
                      chordColor="#38bdf8"
                      textColor="#ffffff"
                      align="left"
                    />
                  ))}
                </Grid>

                {/* Right Column: Regional Language (e.g. Telugu) */}
                <Grid
                  item
                  xs={6}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: { xs: 1, sm: 1.5, md: 2 },
                    borderLeft: '1px solid rgba(255, 255, 255, 0.12)',
                    pl: { xs: 2, sm: 3, md: 4 },
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      color: '#38bdf8',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.14em',
                      fontSize: 'clamp(0.8rem, 1.1vw, 1.15rem)',
                      opacity: 0.9,
                    }}
                  >
                    {liveState?.currentSectionName
                      ? `${liveState.currentSectionName} (${splitLanguage})`
                      : splitLanguage}
                  </Typography>

                  {splitRightLines.map((lineObj, idx) => (
                    <AnchoredLyricRow
                      key={`right_${idx}`}
                      line={lineObj}
                      showChords={showChords}
                      fontSize={showChords ? 'clamp(1.4rem, 2.4vw, 2.8rem)' : 'clamp(1.7rem, 2.9vw, 3.4rem)'}
                      chordColor="#38bdf8"
                      textColor="#ffffff"
                      align="left"
                    />
                  ))}
                </Grid>
              </Grid>
            </Fade>
          </Box>

          {/* Bottom Next Slide Preview in Split View */}
          {(nextLeftLines.length > 0 || nextRightLines.length > 0) && (
            <Box
              sx={{
                flexShrink: 0,
                width: '100%',
                maxWidth: '96vw',
                mx: 'auto',
                px: { xs: 1, sm: 2, md: 3 },
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                pt: { xs: 0.75, sm: 1 },
                pb: { xs: 0.5, sm: 0.75 },
                opacity: 0.75,
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
                  display: 'block',
                }}
              >
                Next {liveState?.nextChunk?.sectionName ? `(${liveState.nextChunk.sectionName})` : ''}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  {nextLeftLines.map((lineObj, idx) => (
                    <AnchoredLyricRow
                      key={`next_left_${idx}`}
                      line={lineObj}
                      showChords={showChords}
                      fontSize="clamp(0.85rem, 1.4vw, 1.4rem)"
                      chordColor="rgba(56, 189, 248, 0.5)"
                      textColor="#94a3b8"
                      align="left"
                    />
                  ))}
                </Grid>
                <Grid item xs={6} sx={{ borderLeft: '1px solid rgba(255, 255, 255, 0.08)', pl: 2 }}>
                  {nextRightLines.map((lineObj, idx) => (
                    <AnchoredLyricRow
                      key={`next_right_${idx}`}
                      line={lineObj}
                      showChords={showChords}
                      fontSize="clamp(0.85rem, 1.4vw, 1.4rem)"
                      chordColor="rgba(56, 189, 248, 0.5)"
                      textColor="#94a3b8"
                      align="left"
                    />
                  ))}
                </Grid>
              </Grid>
            </Box>
          )}
        </Box>
      ) : (
        // ================= STANDARD FULL VIEW =================
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          {/* Main 2-Line Slide Content */}
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'flex-start',
              maxWidth: '94vw',
              width: '100%',
              mx: 'auto',
              px: { xs: 1, sm: 2, md: 4 },
              overflow: 'hidden',
            }}
          >
            <Fade in={true} timeout={120} key={`${liveState?.currentSongTitle}_${liveState?.currentSectionName}_${JSON.stringify(displayLines)}`}>
              <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: { xs: 1.5, sm: 2.5, md: 3.5 } }}>
                {/* Section Name in Gray */}
                {liveState?.currentSectionName && (
                  <Typography
                    variant="caption"
                    sx={{
                      color: '#94a3b8',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.14em',
                      fontSize: 'clamp(0.85rem, 1.2vw, 1.25rem)',
                      mb: { xs: -0.5, sm: -1 },
                      opacity: 0.85,
                    }}
                  >
                    {liveState.currentSectionName}
                  </Typography>
                )}

                {displayLines.map((lineObj, idx) => (
                  <AnchoredLyricRow
                    key={idx}
                    line={lineObj}
                    showChords={showChords}
                    fontSize={showChords ? 'clamp(1.6rem, 3.2vw, 3.6rem)' : 'clamp(2.0rem, 4.0vw, 4.4rem)'}
                    chordColor="#38bdf8"
                    textColor="#ffffff"
                    align="left"
                  />
                ))}
              </Box>
            </Fade>
          </Box>

          {/* Bottom Next Slide Preview in Natural Flex Flow (Guaranteed Zero Overlap) */}
          {nextLines.length > 0 && (
            <Box
              sx={{
                flexShrink: 0,
                width: '100%',
                maxWidth: '94vw',
                mx: 'auto',
                px: { xs: 1, sm: 2, md: 4 },
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                pt: { xs: 0.75, sm: 1.25 },
                pb: { xs: 0.5, sm: 1 },
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                opacity: 0.75,
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
                  fontSize="clamp(0.95rem, 1.8vw, 1.8rem)"
                  chordColor="rgba(56, 189, 248, 0.5)"
                  textColor="#94a3b8"
                  align="left"
                />
              ))}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
