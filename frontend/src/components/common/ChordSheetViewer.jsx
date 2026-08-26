import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Chip,
  Stack,
  Divider,
  Paper,
  Tooltip,
  MenuItem,
  FormControl,
  Select,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  Speed as SpeedIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  RestartAlt as ResetIcon,
  ContentCopy as ContentCopyIcon,
  Check as CheckIcon,
  ViewAgenda as SingleColIcon,
  ViewWeek as TwoColIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  ColorLens as ThemeIcon,
  MusicNote as MusicNoteIcon,
  Print as PrintIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Edit as EditIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  Lyrics as LyricsIcon,
  QueueMusic as QueueMusicIcon,
} from '@mui/icons-material';
import './ChordSheetViewer.css';

// Musical notes mapping for transposition
const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const NOTE_MAP = {
  ...SHARPS.reduce((acc, note, idx) => ({ ...acc, [note]: idx }), {}),
  ...FLATS.reduce((acc, note, idx) => ({ ...acc, [note]: idx }), {}),
};

// Regex for recognizing standalone chords
const CHORD_REGEX_STR =
  '([A-G][#b]?(?:m|min|maj|dim|aug|sus[24]?|add[29]?|[2-9]|11|13|maj7|m7|7|6|9|dim7)?(?:\\/[A-G][#b]?)?)';
const CHORD_TOKEN_REGEX = new RegExp(`^${CHORD_REGEX_STR}$`);

// Section title matching
const SECTION_REGEX =
  /^\s*(\[|\()?(Intro|Verse(?:\s*\d+)?|Chorus(?:\s*\d+)?|Pre-Chorus(?:\s*\d+)?|Bridge(?:\s*\d+)?|Outro|Ending|Tag|Interlude|Hook|Solo|Instrumental)(\]|\)|\:)?\s*$/i;

/**
 * Transpose a single chord string by N semitones
 */
export const transposeChord = (chord, semitones) => {
  if (!chord || semitones === 0) return chord;
  const [rootPart, bassPart] = chord.split('/');
  const match = rootPart.match(/^([A-G])([#b]?)(.*)$/);
  if (!match) return chord;

  const [, base, accidental, suffix] = match;
  const noteName = base + accidental;
  let idx = NOTE_MAP[noteName];
  if (idx === undefined) return chord;

  idx = (idx + semitones) % 12;
  if (idx < 0) idx += 12;
  const newRoot = SHARPS[idx];

  let newBass = '';
  if (bassPart) {
    const bassMatch = bassPart.match(/^([A-G])([#b]?)(.*)$/);
    if (bassMatch) {
      const [, bBase, bAccidental, bSuffix] = bassMatch;
      let bIdx = NOTE_MAP[bBase + bAccidental];
      if (bIdx !== undefined) {
        bIdx = (bIdx + semitones) % 12;
        if (bIdx < 0) bIdx += 12;
        newBass = '/' + SHARPS[bIdx] + (bSuffix || '');
      } else {
        newBass = '/' + bassPart;
      }
    } else {
      newBass = '/' + bassPart;
    }
  }

  return newRoot + suffix + newBass;
};

/**
 * Transpose key name
 */
export const transposeKeyName = (key, semitones) => {
  if (!key) return '';
  const idx = NOTE_MAP[key];
  if (idx === undefined) return key;
  let newIdx = (idx + semitones) % 12;
  if (newIdx < 0) newIdx += 12;
  return SHARPS[newIdx];
};

/**
 * Check if a line is predominantly chord tokens
 */
const isChordLine = (line) => {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (SECTION_REGEX.test(trimmed)) return false;

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;

  let chordCount = 0;
  for (const token of tokens) {
    if (CHORD_TOKEN_REGEX.test(token)) {
      chordCount++;
    }
  }
  return chordCount / tokens.length >= 0.65;
};

function ChordSheetViewer({
  rawContent = '',
  originalKey = 'C',
  title = '',
  artist = '',
  bpm,
  timeSignature,
  initialTranspose = 0,
  initialShowChords = true,
  onEdit,
}) {
  // Show / Hide Chords Toggle State
  const [showChords, setShowChords] = useState(initialShowChords);

  useEffect(() => {
    setShowChords(initialShowChords);
  }, [initialShowChords]);

  // Transpose state
  const [transpose, setTranspose] = useState(initialTranspose);

  // Styling state
  const [themeMode, setThemeMode] = useState('light'); // 'light', 'dark', 'sepia'
  const [highlightStyle, setHighlightStyle] = useState('pill'); // 'pill', 'glow', 'bold', 'off'
  const [fontSize, setFontSize] = useState(15); // in pixels
  const [twoColumns, setTwoColumns] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Auto-scroll state
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(1); // 0.5 to 3
  const scrollIntervalRef = useRef(null);
  const viewerContainerRef = useRef(null);

  const [copied, setCopied] = useState(false);

  // Handle autoscroll
  useEffect(() => {
    if (isScrolling) {
      scrollIntervalRef.current = setInterval(() => {
        if (isFullscreen && viewerContainerRef.current) {
          viewerContainerRef.current.scrollBy({
            top: scrollSpeed * 1.5,
            left: 0,
            behavior: 'smooth',
          });
        } else {
          window.scrollBy({
            top: scrollSpeed * 1.5,
            left: 0,
            behavior: 'smooth',
          });
        }
      }, 50);
    } else {
      if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
    }
    return () => {
      if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
    };
  }, [isScrolling, scrollSpeed, isFullscreen]);

  // Escape key exits fullscreen
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Transpose step handler
  const handleTransposeStep = (delta) => {
    setTranspose((prev) => {
      const next = prev + delta;
      if (next > 11 || next < -11) return 0;
      return next;
    });
  };

  // Direct target key selector
  const handleTargetKeySelect = (targetKey) => {
    if (!targetKey || !originalKey) return;
    const originIdx = NOTE_MAP[originalKey];
    const targetIdx = NOTE_MAP[targetKey];
    if (originIdx !== undefined && targetIdx !== undefined) {
      let diff = targetIdx - originIdx;
      if (diff > 6) diff -= 12;
      if (diff < -6) diff += 12;
      setTranspose(diff);
    }
  };

  const currentDisplayKey = transposeKeyName(originalKey, transpose);

  // Parse lines and extract sections
  const { parsedLines, sections } = useMemo(() => {
    if (!rawContent) return { parsedLines: [], sections: [] };

    const lines = rawContent.split(/\r?\n/);
    const resultLines = [];
    const extractedSections = [];

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // Empty line
      if (!trimmed) {
        resultLines.push({ type: 'empty', raw: line, index });
        return;
      }

      // Section header
      const sectionMatch = trimmed.match(SECTION_REGEX);
      if (sectionMatch) {
        const cleanName = sectionMatch[2] || trimmed;
        const sectionId = `sec-${index}`;
        extractedSections.push({ name: cleanName, id: sectionId, lineIndex: index });

        // Identify category for accent
        const lower = cleanName.toLowerCase();
        let category = 'default';
        if (lower.includes('chorus')) category = 'chorus';
        else if (lower.includes('bridge')) category = 'bridge';
        else if (lower.includes('verse')) category = 'verse';
        else if (lower.includes('intro') || lower.includes('outro') || lower.includes('tag')) category = 'intro';

        resultLines.push({
          type: 'section',
          raw: trimmed,
          cleanName,
          category,
          id: sectionId,
          index,
        });
        return;
      }

      // Chord line
      if (isChordLine(line)) {
        const tokens = [];
        let lastIdx = 0;
        const tokenRegex = /\S+/g;
        let match;

        while ((match = tokenRegex.exec(line)) !== null) {
          if (match.index > lastIdx) {
            tokens.push({
              type: 'space',
              text: line.substring(lastIdx, match.index),
            });
          }

          const rawToken = match[0];
          const isChord = CHORD_TOKEN_REGEX.test(rawToken);
          const transposed = isChord ? transposeChord(rawToken, transpose) : rawToken;

          tokens.push({
            type: isChord ? 'chord' : 'text',
            text: transposed,
            original: rawToken,
          });

          lastIdx = match.index + rawToken.length;
        }

        if (lastIdx < line.length) {
          tokens.push({
            type: 'space',
            text: line.substring(lastIdx),
          });
        }

        resultLines.push({
          type: 'chord-line',
          tokens,
          raw: line,
          index,
        });
        return;
      }

      // Regular lyric line
      resultLines.push({
        type: 'lyric-line',
        raw: line,
        index,
      });
    });

    return { parsedLines: resultLines, sections: extractedSections };
  }, [rawContent, transpose]);

  // Jump to section smoothly
  const scrollToSection = (sectionId) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.transition = 'all 0.3s';
      el.style.transform = 'scale(1.04)';
      setTimeout(() => {
        el.style.transform = 'scale(1)';
      }, 400);
    }
  };

  // Generate transposed text for copying / printing (respects showChords setting)
  const getTransposedRawText = () => {
    return parsedLines
      .filter((line) => {
        if (!showChords && line.type === 'chord-line') return false;
        return true;
      })
      .map((line) => {
        if (line.type === 'empty') return '';
        if (line.type === 'section') return `[${line.cleanName}]`;
        if (line.type === 'chord-line') {
          return line.tokens.map((t) => t.text).join('');
        }
        return line.raw;
      })
      .join('\n');
  };

  const handleCopy = () => {
    const text = getTransposedRawText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Box
      ref={viewerContainerRef}
      className={`chord-sheet-container chord-sheet-theme-${themeMode} ${
        isFullscreen ? 'chord-sheet-fullscreen' : ''
      }`}
      sx={{ width: '100%' }}
    >
      {/* ================= Fullscreen Top Floating Navigation ================= */}
      {isFullscreen && (
        <Paper
          elevation={4}
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 20,
            p: 1.25,
            px: 2,
            mb: 2,
            borderRadius: 2,
            bgcolor: 'background.paper',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
            flexWrap: 'wrap',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle1" fontWeight={700} noWrap>
              {title || 'Music Stand View'}
            </Typography>
            {showChords && (
              <Chip
                size="small"
                label={`Key: ${currentDisplayKey || originalKey}`}
                color="primary"
                sx={{ fontWeight: 700, height: 22 }}
              />
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Font adjust */}
            <IconButton
              size="small"
              onClick={() => setFontSize((s) => Math.max(12, s - 1))}
              disabled={fontSize <= 12}
            >
              <Typography variant="caption" fontWeight={800}>
                A-
              </Typography>
            </IconButton>
            <Typography variant="caption" fontWeight={700}>
              {fontSize}px
            </Typography>
            <IconButton
              size="small"
              onClick={() => setFontSize((s) => Math.min(26, s + 1))}
              disabled={fontSize >= 26}
            >
              <Typography variant="caption" fontWeight={800}>
                A+
              </Typography>
            </IconButton>

            {/* Auto scroll */}
            <IconButton
              size="small"
              onClick={() => setIsScrolling(!isScrolling)}
              color={isScrolling ? 'primary' : 'default'}
              sx={{ bgcolor: isScrolling ? 'rgba(37, 99, 235, 0.1)' : 'transparent' }}
            >
              {isScrolling ? <PauseIcon fontSize="small" /> : <PlayIcon fontSize="small" />}
            </IconButton>

            <Button
              variant="contained"
              color="primary"
              size="small"
              startIcon={<FullscreenExitIcon />}
              onClick={() => setIsFullscreen(false)}
              sx={{ textTransform: 'none', borderRadius: 1.5, fontWeight: 700 }}
            >
              Exit Fullscreen
            </Button>
          </Box>
        </Paper>
      )}

      {/* ================= Musician Toolkit / Toolbar ================= */}
      {!isFullscreen && (
        <Paper
          variant="outlined"
          sx={{
            p: { xs: 1.25, sm: 1.75 },
            mb: 2,
            borderRadius: 2.5,
            bgcolor: 'background.paper',
            boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
          }}
        >
          {/* Tier 1: Primary Mode Switcher & Transpose Controls */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1.25,
              flexWrap: 'wrap',
              mb: 1.5,
            }}
          >
            {/* Mode Switcher Pill */}
            <ToggleButtonGroup
              size="small"
              value={showChords ? 'chords' : 'lyrics'}
              exclusive
              onChange={(e, val) => {
                if (val) setShowChords(val === 'chords');
              }}
              sx={{
                height: 34,
                '& .MuiToggleButton-root': {
                  px: { xs: 1.2, sm: 1.6 },
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  gap: 0.5,
                },
              }}
            >
              <ToggleButton value="chords">
                <QueueMusicIcon sx={{ fontSize: 16 }} />
                Chords & Lyrics
              </ToggleButton>
              <ToggleButton value="lyrics">
                <LyricsIcon sx={{ fontSize: 16 }} />
                Lyrics Only
              </ToggleButton>
            </ToggleButtonGroup>

            {/* Transpose Controls (when chords enabled) */}
            {showChords && (
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.75,
                  bgcolor: (theme) =>
                    theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#f8fafc',
                  p: '3px 8px',
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  flexWrap: 'wrap',
                }}
              >
                <Typography
                  variant="caption"
                  fontWeight={800}
                  color="text.secondary"
                  sx={{ fontSize: '0.7rem' }}
                >
                  KEY
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => handleTransposeStep(-1)}
                  sx={{ width: 26, height: 26, fontWeight: 700, fontSize: '0.9rem' }}
                  title="Transpose down 1 semitone"
                >
                  -
                </IconButton>
                <Chip
                  label={
                    transpose === 0
                      ? `Key: ${originalKey || 'C'}`
                      : `${currentDisplayKey} (${transpose > 0 ? `+${transpose}` : transpose})`
                  }
                  size="small"
                  color={transpose !== 0 ? 'primary' : 'default'}
                  sx={{ fontWeight: 700, fontSize: '0.78rem', height: 24 }}
                />
                <IconButton
                  size="small"
                  onClick={() => handleTransposeStep(1)}
                  sx={{ width: 26, height: 26, fontWeight: 700, fontSize: '0.9rem' }}
                  title="Transpose up 1 semitone"
                >
                  +
                </IconButton>
                {transpose !== 0 && (
                  <IconButton
                    size="small"
                    onClick={() => setTranspose(0)}
                    sx={{ width: 24, height: 24, color: 'text.secondary' }}
                    title="Reset to original key"
                  >
                    <ResetIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                )}

                <FormControl size="small" sx={{ minWidth: 70 }}>
                  <Select
                    value={currentDisplayKey}
                    onChange={(e) => handleTargetKeySelect(e.target.value)}
                    sx={{
                      height: 26,
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      borderRadius: 1.25,
                      '& .MuiSelect-select': { py: 0.25, px: 0.8 },
                    }}
                  >
                    {SHARPS.map((k) => (
                      <MenuItem key={k} value={k} sx={{ fontSize: '0.8rem' }}>
                        {k}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            )}
          </Box>

          {/* Tier 2: Display, Theme, Font, and Action Tools */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              flexWrap: 'wrap',
              pt: 1.25,
              borderTop: '1px solid',
              borderColor: 'divider',
            }}
          >
            {/* Left: Theme Switcher & Font Controls */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              {/* Theme Mode Selector */}
              <ToggleButtonGroup
                size="small"
                value={themeMode}
                exclusive
                onChange={(e, val) => val && setThemeMode(val)}
                sx={{ height: 30 }}
              >
                <ToggleButton value="light" title="Studio Light" sx={{ px: 1 }}>
                  <LightModeIcon sx={{ fontSize: 15 }} />
                </ToggleButton>
                <ToggleButton value="dark" title="Stage Dark" sx={{ px: 1 }}>
                  <DarkModeIcon sx={{ fontSize: 15 }} />
                </ToggleButton>
                <ToggleButton value="sepia" title="Warm Sepia" sx={{ px: 1 }}>
                  <ThemeIcon sx={{ fontSize: 15 }} />
                </ToggleButton>
              </ToggleButtonGroup>

              {/* Font Size Adjusters */}
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  bgcolor: (theme) =>
                    theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#f8fafc',
                  borderRadius: 1.5,
                  px: 0.75,
                  height: 30,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <IconButton
                  size="small"
                  onClick={() => setFontSize((s) => Math.max(12, s - 1))}
                  disabled={fontSize <= 12}
                  sx={{ p: 0.25, width: 22, height: 22 }}
                >
                  <Typography variant="caption" fontWeight={800} sx={{ fontSize: '0.72rem' }}>
                    A-
                  </Typography>
                </IconButton>
                <Typography
                  variant="caption"
                  fontWeight={700}
                  sx={{ fontSize: '0.75rem', minWidth: 26, textAlign: 'center' }}
                >
                  {fontSize}px
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => setFontSize((s) => Math.min(24, s + 1))}
                  disabled={fontSize >= 24}
                  sx={{ p: 0.25, width: 22, height: 22 }}
                >
                  <Typography variant="caption" fontWeight={800} sx={{ fontSize: '0.72rem' }}>
                    A+
                  </Typography>
                </IconButton>
              </Box>

              {/* Highlight Style selector (only when chords on) */}
              {showChords && (
                <ToggleButtonGroup
                  size="small"
                  value={highlightStyle}
                  exclusive
                  onChange={(e, val) => val && setHighlightStyle(val)}
                  sx={{ height: 30, display: { xs: 'none', sm: 'inline-flex' } }}
                >
                  <ToggleButton
                    value="pill"
                    sx={{ px: 1, fontSize: '0.72rem', textTransform: 'none', fontWeight: 600 }}
                  >
                    Pill
                  </ToggleButton>
                  <ToggleButton
                    value="glow"
                    sx={{ px: 1, fontSize: '0.72rem', textTransform: 'none', fontWeight: 600 }}
                  >
                    Glow
                  </ToggleButton>
                  <ToggleButton
                    value="bold"
                    sx={{ px: 1, fontSize: '0.72rem', textTransform: 'none', fontWeight: 600 }}
                  >
                    Bold
                  </ToggleButton>
                </ToggleButtonGroup>
              )}
            </Box>

            {/* Right: Quick Tools (Auto-Scroll, Fullscreen Music Stand, Copy, Print) */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {/* Auto Scroll Quick Toggle */}
              <Tooltip title={isScrolling ? 'Pause Auto Scroll' : 'Start Auto Scroll'}>
                <IconButton
                  size="small"
                  onClick={() => setIsScrolling(!isScrolling)}
                  color={isScrolling ? 'primary' : 'default'}
                  sx={{
                    bgcolor: isScrolling ? 'rgba(37, 99, 235, 0.12)' : 'transparent',
                    width: 30,
                    height: 30,
                  }}
                >
                  {isScrolling ? <PauseIcon sx={{ fontSize: 17 }} /> : <PlayIcon sx={{ fontSize: 17 }} />}
                </IconButton>
              </Tooltip>

              {/* Stage Fullscreen Music Stand */}
              <Tooltip title={isFullscreen ? 'Exit Stage Stand Mode' : 'Music Stand Fullscreen'}>
                <IconButton
                  size="small"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  color={isFullscreen ? 'primary' : 'default'}
                  sx={{ width: 30, height: 30 }}
                >
                  {isFullscreen ? (
                    <FullscreenExitIcon sx={{ fontSize: 18 }} />
                  ) : (
                    <FullscreenIcon sx={{ fontSize: 18 }} />
                  )}
                </IconButton>
              </Tooltip>

              {/* 2-Columns Toggle (tablet/desktop) */}
              <Tooltip title={twoColumns ? 'Switch to 1 Column' : 'Switch to 2 Columns'}>
                <IconButton
                  size="small"
                  onClick={() => setTwoColumns(!twoColumns)}
                  color={twoColumns ? 'primary' : 'default'}
                  sx={{ display: { xs: 'none', md: 'inline-flex' }, width: 30, height: 30 }}
                >
                  {twoColumns ? (
                    <TwoColIcon sx={{ fontSize: 17 }} />
                  ) : (
                    <SingleColIcon sx={{ fontSize: 17 }} />
                  )}
                </IconButton>
              </Tooltip>

              {/* Copy */}
              <Tooltip title={copied ? 'Copied!' : 'Copy Sheet'}>
                <IconButton
                  size="small"
                  onClick={handleCopy}
                  color={copied ? 'success' : 'default'}
                  sx={{ width: 30, height: 30 }}
                >
                  {copied ? <CheckIcon sx={{ fontSize: 16 }} /> : <ContentCopyIcon sx={{ fontSize: 16 }} />}
                </IconButton>
              </Tooltip>

              {/* Print */}
              <Tooltip title="Print Sheet">
                <IconButton
                  size="small"
                  onClick={handlePrint}
                  sx={{ display: { xs: 'none', sm: 'inline-flex' }, width: 30, height: 30 }}
                >
                  <PrintIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Section Quick Jump Bar */}
          {sections.length > 0 && (
            <Box sx={{ mt: 1.25, pt: 1.25, borderTop: '1px dashed', borderColor: 'divider' }}>
              <Box className="cs-quick-nav">
                <Typography
                  variant="caption"
                  fontWeight={800}
                  color="text.secondary"
                  sx={{ mr: 0.5, py: 0.3, fontSize: '0.68rem', flexShrink: 0 }}
                >
                  JUMP TO:
                </Typography>
                {sections.map((sec) => (
                  <Chip
                    key={sec.id}
                    label={sec.name}
                    size="small"
                    onClick={() => scrollToSection(sec.id)}
                    clickable
                    variant="outlined"
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.72rem',
                      height: 24,
                      cursor: 'pointer',
                      flexShrink: 0,
                      borderRadius: 1.5,
                      '&:hover': { bgcolor: 'primary.main', color: '#ffffff' },
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}
        </Paper>
      )}

      {/* ================= Rendered Sheet (Chords + Lyrics or Lyrics-Only) ================= */}
      {parsedLines.length > 0 ? (
        <Box
          className={`chord-sheet-body ${
            showChords ? 'cs-mode-chords' : 'cs-mode-lyrics-only'
          } ${twoColumns ? 'chord-sheet-columns-2' : ''}`}
          style={{ fontSize: `${fontSize}px` }}
        >
          {parsedLines.map((line, idx) => {
            // When chords are hidden, skip chord lines entirely
            if (!showChords && line.type === 'chord-line') {
              return null;
            }

            if (line.type === 'empty') {
              return <div key={idx} className="cs-line cs-line-empty" />;
            }

            if (line.type === 'section') {
              return (
                <div
                  key={idx}
                  id={line.id}
                  className={`cs-section-header cs-section-${line.category}`}
                >
                  <MusicNoteIcon sx={{ fontSize: '0.9em' }} />
                  {line.cleanName}
                </div>
              );
            }

            if (line.type === 'chord-line') {
              return (
                <div key={idx} className="cs-line cs-line-chord">
                  {line.tokens.map((token, tIdx) => {
                    if (token.type === 'space') {
                      return <span key={tIdx}>{token.text}</span>;
                    }
                    if (token.type === 'chord') {
                      return (
                        <span
                          key={tIdx}
                          className={`chord-badge-${highlightStyle}`}
                          title={`Original: ${token.original} | Transposed: ${token.text}`}
                        >
                          {token.text}
                        </span>
                      );
                    }
                    return <span key={tIdx}>{token.text}</span>;
                  })}
                </div>
              );
            }

            // Lyric line (when chords hidden, lines stack naturally with natural line spacing)
            return (
              <div key={idx} className="cs-line cs-line-lyric">
                {line.raw}
              </div>
            );
          })}
        </Box>
      ) : (
        <Box textAlign="center" py={6}>
          <Typography variant="body1" color="text.secondary">
            No song content available.
          </Typography>
        </Box>
      )}

      {/* ================= Floating Auto-Scroll Control ================= */}
      <Box className="cs-autoscroll-bar">
        <Box className="cs-autoscroll-panel">
          <IconButton
            size="small"
            onClick={() => setIsScrolling(!isScrolling)}
            sx={{ color: isScrolling ? '#38bdf8' : '#ffffff' }}
          >
            {isScrolling ? <PauseIcon /> : <PlayIcon />}
          </IconButton>

          <Typography
            variant="caption"
            fontWeight={600}
            sx={{ color: '#ffffff', minWidth: 65, fontSize: '0.75rem' }}
          >
            {isScrolling ? `Auto (${scrollSpeed}x)` : 'Auto Scroll'}
          </Typography>

          <Stack direction="row" spacing={0.5} alignItems="center">
            {[0.5, 1, 1.5, 2].map((spd) => (
              <Button
                key={spd}
                size="small"
                variant={scrollSpeed === spd ? 'contained' : 'text'}
                onClick={() => setScrollSpeed(spd)}
                sx={{
                  minWidth: 26,
                  px: 0.6,
                  py: 0.2,
                  fontSize: '0.68rem',
                  color: scrollSpeed === spd ? '#ffffff' : 'rgba(255,255,255,0.7)',
                  bgcolor: scrollSpeed === spd ? 'primary.main' : 'transparent',
                  borderRadius: 1,
                  height: 22,
                }}
              >
                {spd}x
              </Button>
            ))}
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}

export default ChordSheetViewer;
