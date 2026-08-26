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
  InputLabel,
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
const SECTION_REGEX = /^\s*(\[|\()?(Intro|Verse(?:\s*\d+)?|Chorus(?:\s*\d+)?|Pre-Chorus(?:\s*\d+)?|Bridge(?:\s*\d+)?|Outro|Ending|Tag|Interlude|Hook|Solo|Instrumental)(\]|\)|\:)?\s*$/i;

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
        window.scrollBy({
          top: scrollSpeed * 1.5,
          left: 0,
          behavior: 'smooth',
        });
      }, 50);
    } else {
      if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
    }
    return () => {
      if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
    };
  }, [isScrolling, scrollSpeed]);

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
      className={`chord-sheet-container chord-sheet-theme-${themeMode}`}
      sx={{ width: '100%' }}
    >
      {/* ================= Musician Toolkit / Toolbar ================= */}
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 1.5, sm: 2 },
          mb: 2.5,
          borderRadius: 2.5,
          bgcolor: 'background.paper',
          boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'stretch', md: 'center' }}
          justifyContent="space-between"
          gap={2}
        >
          {/* Main Primary Controls: Hide/Show Chords Toggle & Transposition */}
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
            {/* Primary Toggle: Hide Chords / Show Chords */}
            <Button
              variant={showChords ? 'contained' : 'outlined'}
              color="primary"
              size="small"
              onClick={() => setShowChords(!showChords)}
              startIcon={showChords ? <VisibilityOffIcon /> : <VisibilityIcon />}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: 2,
                px: 1.8,
                boxShadow: showChords ? '0 2px 8px rgba(37, 99, 235, 0.25)' : 'none',
              }}
            >
              {showChords ? 'Hide Chords' : 'Show Chords'}
            </Button>

            <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />

            {/* Pitch / Transposition Controls (active when chords are on) */}
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ opacity: showChords ? 1 : 0.45, transition: 'opacity 0.2s' }}
            >
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase' }}>
                Key:
              </Typography>

              <Button
                variant="outlined"
                size="small"
                disabled={!showChords}
                onClick={() => handleTransposeStep(-1)}
                sx={{ minWidth: 34, px: 1, fontWeight: 700, borderRadius: 1.5 }}
              >
                -
              </Button>

              <Tooltip title={transpose !== 0 ? `Transposed ${transpose > 0 ? '+' : ''}${transpose} semitones` : 'Original Key'}>
                <Chip
                  icon={<MusicNoteIcon sx={{ fontSize: '16px !important' }} />}
                  label={
                    transpose === 0
                      ? `Key: ${originalKey || 'C'}`
                      : `${currentDisplayKey} (${transpose > 0 ? `+${transpose}` : transpose})`
                  }
                  color={transpose !== 0 && showChords ? 'primary' : 'default'}
                  sx={{ fontWeight: 700, fontSize: '0.85rem' }}
                />
              </Tooltip>

              <Button
                variant="outlined"
                size="small"
                disabled={!showChords}
                onClick={() => handleTransposeStep(1)}
                sx={{ minWidth: 34, px: 1, fontWeight: 700, borderRadius: 1.5 }}
              >
                +
              </Button>

              {transpose !== 0 && (
                <Button
                  variant="text"
                  size="small"
                  startIcon={<ResetIcon />}
                  disabled={!showChords}
                  onClick={() => setTranspose(0)}
                  sx={{ textTransform: 'none', fontSize: '0.8rem', color: 'text.secondary' }}
                >
                  Reset
                </Button>
              )}

              <FormControl size="small" sx={{ minWidth: 105, ml: { xs: 0, sm: 1 } }}>
                <InputLabel sx={{ fontSize: '0.8rem' }}>Target Key</InputLabel>
                <Select
                  value={currentDisplayKey}
                  disabled={!showChords}
                  label="Target Key"
                  onChange={(e) => handleTargetKeySelect(e.target.value)}
                  sx={{ height: 34, fontSize: '0.85rem' }}
                >
                  {SHARPS.map((k) => (
                    <MenuItem key={k} value={k}>
                      {k}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </Stack>

          {/* Secondary Controls: Highlight Style, Theme, Font Size, Columns */}
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
            {/* Highlight Style Toggle (active when chords are shown) */}
            {showChords && (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                  Highlight:
                </Typography>
                <ToggleButtonGroup
                  size="small"
                  value={highlightStyle}
                  exclusive
                  onChange={(e, val) => val && setHighlightStyle(val)}
                  sx={{ height: 32 }}
                >
                  <ToggleButton value="pill" sx={{ px: 1.2, textTransform: 'none', fontSize: '0.75rem', fontWeight: 600 }}>
                    Pill
                  </ToggleButton>
                  <ToggleButton value="glow" sx={{ px: 1.2, textTransform: 'none', fontSize: '0.75rem', fontWeight: 600 }}>
                    Glow
                  </ToggleButton>
                  <ToggleButton value="bold" sx={{ px: 1.2, textTransform: 'none', fontSize: '0.75rem', fontWeight: 600 }}>
                    Bold
                  </ToggleButton>
                  <ToggleButton value="off" sx={{ px: 1.2, textTransform: 'none', fontSize: '0.75rem', fontWeight: 600 }}>
                    Off
                  </ToggleButton>
                </ToggleButtonGroup>
              </Stack>
            )}

            <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />

            {/* Theme Mode Selector */}
            <ToggleButtonGroup
              size="small"
              value={themeMode}
              exclusive
              onChange={(e, val) => val && setThemeMode(val)}
              sx={{ height: 32 }}
            >
              <ToggleButton value="light" title="Studio Light">
                <LightModeIcon sx={{ fontSize: 16 }} />
              </ToggleButton>
              <ToggleButton value="dark" title="Stage Dark">
                <DarkModeIcon sx={{ fontSize: 16 }} />
              </ToggleButton>
              <ToggleButton value="sepia" title="Warm Paper">
                <ThemeIcon sx={{ fontSize: 16 }} />
              </ToggleButton>
            </ToggleButtonGroup>

            {/* Font Size Adjusters */}
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Tooltip title="Decrease Font">
                <IconButton
                  size="small"
                  onClick={() => setFontSize((s) => Math.max(12, s - 1))}
                  disabled={fontSize <= 12}
                >
                  <Typography variant="caption" fontWeight={700}>
                    A-
                  </Typography>
                </IconButton>
              </Tooltip>
              <Typography variant="caption" fontWeight={600} color="text.secondary">
                {fontSize}px
              </Typography>
              <Tooltip title="Increase Font">
                <IconButton
                  size="small"
                  onClick={() => setFontSize((s) => Math.min(24, s + 1))}
                  disabled={fontSize >= 24}
                >
                  <Typography variant="caption" fontWeight={700}>
                    A+
                  </Typography>
                </IconButton>
              </Tooltip>
            </Stack>

            {/* Layout Column Toggle */}
            <Tooltip title={twoColumns ? 'Switch to 1 Column' : 'Switch to 2 Columns'}>
              <IconButton
                size="small"
                onClick={() => setTwoColumns(!twoColumns)}
                color={twoColumns ? 'primary' : 'default'}
              >
                {twoColumns ? <TwoColIcon fontSize="small" /> : <SingleColIcon fontSize="small" />}
              </IconButton>
            </Tooltip>

            {/* Copy & Print */}
            <Tooltip title={copied ? 'Copied!' : showChords ? 'Copy Chords & Lyrics' : 'Copy Lyrics'}>
              <IconButton size="small" onClick={handleCopy} color={copied ? 'success' : 'default'}>
                {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
              </IconButton>
            </Tooltip>

            <Tooltip title="Print Sheet">
              <IconButton size="small" onClick={handlePrint}>
                <PrintIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            {/* Optional Quick Edit Lyrics & Chords */}
            {onEdit && (
              <Tooltip title="Edit Lyrics & Chords">
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<EditIcon sx={{ fontSize: 16 }} />}
                  onClick={onEdit}
                  sx={{
                    height: 32,
                    borderRadius: 1.5,
                    textTransform: 'none',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    px: 1.25,
                  }}
                >
                  Edit
                </Button>
              </Tooltip>
            )}
          </Stack>
        </Stack>

        {/* Section Quick Jump Bar */}
        {sections.length > 0 && (
          <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px dashed', borderColor: 'divider' }}>
            <Box className="cs-quick-nav">
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mr: 0.5, py: 0.4 }}>
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
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'primary.light', color: 'primary.contrastText' },
                  }}
                />
              ))}
            </Box>
          </Box>
        )}
      </Paper>

      {/* ================= Rendered Sheet (Chords + Lyrics or Lyrics-Only) ================= */}
      {parsedLines.length > 0 ? (
        <Box
          className={`chord-sheet-body ${showChords ? 'cs-mode-chords' : 'cs-mode-lyrics-only'} ${
            twoColumns ? 'chord-sheet-columns-2' : ''
          }`}
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
                <div key={idx} id={line.id} className={`cs-section-header cs-section-${line.category}`}>
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

          <Typography variant="caption" fontWeight={600} sx={{ color: '#ffffff', minWidth: 70 }}>
            {isScrolling ? `Scrolling (${scrollSpeed}x)` : 'Auto Scroll'}
          </Typography>

          <Stack direction="row" spacing={0.5} alignItems="center">
            {[0.5, 1, 1.5, 2].map((spd) => (
              <Button
                key={spd}
                size="small"
                variant={scrollSpeed === spd ? 'contained' : 'text'}
                onClick={() => setScrollSpeed(spd)}
                sx={{
                  minWidth: 28,
                  px: 0.8,
                  py: 0.2,
                  fontSize: '0.7rem',
                  color: scrollSpeed === spd ? '#ffffff' : 'rgba(255,255,255,0.7)',
                  bgcolor: scrollSpeed === spd ? 'primary.main' : 'transparent',
                  borderRadius: 1,
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
