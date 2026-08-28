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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
  Alert,
  InputLabel,
  Grid,
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
  Add as AddIcon,
  Translate as TranslateIcon,
  DeleteOutline as DeleteOutlineIcon,
  Close as CloseIcon,
  Save as SaveIcon,
  VerticalSplit as SplitViewIcon,
} from '@mui/icons-material';
import api from '../../services/api';
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

const LANGUAGE_PRESETS = [
  'Telugu',
  'Spanish',
  'Tamil',
  'Hindi',
  'Korean',
  'Tagalog',
  'Portuguese',
  'French',
  'German',
  'Chinese',
  'Malayalam',
  'Kannada',
  'Marathi',
  'Bengali',
  'Japanese',
  'Indonesian',
  'Russian',
  'Custom',
];

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
  return chordCount / tokens.length >= 0.5;
};

/**
 * Parse raw text into line tokens and section headers
 */
const parseContentLines = (content = '', transpose = 0) => {
  if (!content) return { parsedLines: [], sections: [] };

  const lines = content.split(/\r?\n/);
  const resultLines = [];
  const extractedSections = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      resultLines.push({ type: 'empty', raw: line, index });
      return;
    }

    const sectionMatch = trimmed.match(SECTION_REGEX);
    if (sectionMatch) {
      const cleanName = sectionMatch[2] || trimmed;
      const sectionId = `sec-${index}`;
      extractedSections.push({ name: cleanName, id: sectionId, lineIndex: index });

      let category = 'default';
      const lower = cleanName.toLowerCase();
      if (lower.includes('chorus')) category = 'chorus';
      else if (lower.includes('bridge')) category = 'bridge';
      else if (lower.includes('verse')) category = 'verse';
      else if (lower.includes('intro') || lower.includes('outro') || lower.includes('tag')) category = 'intro';

      resultLines.push({
        type: 'section',
        raw: line,
        cleanName,
        category,
        id: sectionId,
        index,
      });
      return;
    }

    if (isChordLine(line)) {
      const tokens = [];
      const regex = /([^\s]+|\s+)/g;
      let match;
      let lastIdx = 0;

      while ((match = regex.exec(line)) !== null) {
        const item = match[0];
        if (/^\s+$/.test(item)) {
          tokens.push({ type: 'space', text: item });
        } else if (CHORD_TOKEN_REGEX.test(item)) {
          const transposed = transposeChord(item, transpose);
          tokens.push({
            type: 'chord',
            original: item,
            text: transposed,
          });
        } else {
          tokens.push({ type: 'text', text: item });
        }
        lastIdx = regex.lastIndex;
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

    resultLines.push({
      type: 'lyric-line',
      raw: line,
      index,
    });
  });

  return { parsedLines: resultLines, sections: extractedSections };
};

function ChordSheetViewer({
  songId,
  song,
  onSaveSong,
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
  const [showChords, setShowChords] = useState(initialShowChords);

  useEffect(() => {
    setShowChords(initialShowChords);
  }, [initialShowChords]);

  const [transpose, setTranspose] = useState(initialTranspose);
  const [themeMode, setThemeMode] = useState('light');
  const [highlightStyle, setHighlightStyle] = useState('pill');
  const [fontSize, setFontSize] = useState(15);
  const [twoColumns, setTwoColumns] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(1);
  const scrollIntervalRef = useRef(null);
  const viewerContainerRef = useRef(null);

  const [copied, setCopied] = useState(false);

  // Regional Language State
  const [selectedLanguage, setSelectedLanguage] = useState('original');
  const [selectedSplitLanguage, setSelectedSplitLanguage] = useState('');
  const [addLangDialogOpen, setAddLangDialogOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('Telugu');
  const [customLangName, setCustomLangName] = useState('');
  const [langLyrics, setLangLyrics] = useState('');
  const [savingLang, setSavingLang] = useState(false);
  const [langError, setLangError] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  const regionalList = useMemo(() => {
    return Array.isArray(song?.regionalLyrics) ? song.regionalLyrics : [];
  }, [song?.regionalLyrics]);

  // Set default split language if available
  useEffect(() => {
    if (regionalList.length > 0 && !selectedSplitLanguage) {
      setSelectedSplitLanguage(regionalList[0].language);
    }
  }, [regionalList, selectedSplitLanguage]);

  // Compute active raw content based on selected language
  const activeRawContent = useMemo(() => {
    if (selectedLanguage === 'original' || selectedLanguage === 'split') {
      return rawContent;
    }
    const found = regionalList.find(
      (r) => r.language?.toLowerCase() === selectedLanguage.toLowerCase()
    );
    if (found && (found.content?.chords || found.content?.lyrics)) {
      return found.content.chords || found.content.lyrics || '';
    }
    return rawContent;
  }, [selectedLanguage, regionalList, rawContent]);

  // Regional raw content for Split View (Right Column)
  const regionalRawContent = useMemo(() => {
    const targetLang = selectedSplitLanguage || regionalList[0]?.language;
    if (!targetLang) return '';
    const found = regionalList.find(
      (r) => r.language?.toLowerCase() === targetLang.toLowerCase()
    );
    return found?.content?.chords || found?.content?.lyrics || '';
  }, [selectedSplitLanguage, regionalList]);

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

  const handleTransposeStep = (delta) => {
    setTranspose((prev) => {
      const next = prev + delta;
      if (next > 11 || next < -11) return 0;
      return next;
    });
  };

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

  // Parse lines for primary view
  const { parsedLines, sections } = useMemo(() => {
    return parseContentLines(activeRawContent, transpose);
  }, [activeRawContent, transpose]);

  // Parse lines for Split View Left (English) & Right (Regional)
  const leftSplitData = useMemo(() => {
    return parseContentLines(rawContent, transpose);
  }, [rawContent, transpose]);

  const rightSplitData = useMemo(() => {
    return parseContentLines(regionalRawContent, transpose);
  }, [regionalRawContent, transpose]);

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

  const handleOpenAddLangModal = (existingLang = null) => {
    if (existingLang) {
      const found = regionalList.find(
        (r) => r.language?.toLowerCase() === existingLang.toLowerCase()
      );
      setSelectedPreset(
        LANGUAGE_PRESETS.includes(existingLang) ? existingLang : 'Custom'
      );
      setCustomLangName(!LANGUAGE_PRESETS.includes(existingLang) ? existingLang : '');
      setLangLyrics(found?.content?.lyrics || found?.content?.chords || '');
    } else {
      setSelectedPreset('Telugu');
      setCustomLangName('');
      setLangLyrics('');
    }
    setLangError('');
    setAddLangDialogOpen(true);
  };

  const handleSaveRegionalLanguage = async () => {
    const langName =
      selectedPreset === 'Custom' ? customLangName.trim() : selectedPreset;
    if (!langName) {
      setLangError('Please specify the language name.');
      return;
    }
    if (!langLyrics.trim()) {
      setLangError('Please enter the regional language lyrics or chords.');
      return;
    }

    try {
      setSavingLang(true);
      setLangError('');

      const existing = [...regionalList];
      const idx = existing.findIndex(
        (r) => r.language?.toLowerCase() === langName.toLowerCase()
      );

      const entry = {
        language: langName,
        name: langName,
        content: {
          lyrics: langLyrics,
          chords: langLyrics,
        },
      };

      if (idx >= 0) {
        existing[idx] = entry;
      } else {
        existing.push(entry);
      }

      if (songId) {
        const res = await api.put(`/songs/${songId}`, {
          regionalLyrics: existing,
        });
        if (onSaveSong) {
          onSaveSong(res.data);
        }
      }

      setSelectedLanguage(langName);
      setSelectedSplitLanguage(langName);
      setToastMessage(`Regional language "${langName}" saved successfully!`);
      setAddLangDialogOpen(false);
    } catch (err) {
      console.error('Error saving regional language:', err);
      setLangError(
        err?.response?.data?.message || 'Failed to save regional lyrics.'
      );
    } finally {
      setSavingLang(false);
    }
  };

  const handleDeleteRegionalLanguage = async (langToDelete) => {
    if (!window.confirm(`Are you sure you want to remove "${langToDelete}" lyrics?`)) {
      return;
    }
    try {
      const updated = regionalList.filter(
        (r) => r.language?.toLowerCase() !== langToDelete.toLowerCase()
      );
      if (songId) {
        const res = await api.put(`/songs/${songId}`, {
          regionalLyrics: updated,
        });
        if (onSaveSong) {
          onSaveSong(res.data);
        }
      }
      if (selectedLanguage.toLowerCase() === langToDelete.toLowerCase()) {
        setSelectedLanguage('original');
      }
      setToastMessage(`Removed "${langToDelete}" lyrics.`);
    } catch (err) {
      console.error('Failed to delete regional language:', err);
    }
  };

  const handleInsertSectionTag = (tag) => {
    setLangLyrics((prev) => {
      const current = prev || '';
      const prefix = current.length > 0 && !current.endsWith('\n') ? '\n\n' : '';
      return `${current}${prefix}${tag}\n`;
    });
  };

  const renderSheetLines = (lines) => {
    return lines.map((line, idx) => {
      if (!showChords && line.type === 'chord-line') return null;
      if (line.type === 'empty') return <div key={idx} className="cs-line cs-line-empty" />;
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
              if (token.type === 'space') return <span key={tIdx}>{token.text}</span>;
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
      return (
        <div key={idx} className="cs-line cs-line-lyric">
          {line.raw}
        </div>
      );
    });
  };

  const isSplitMode = selectedLanguage === 'split';

  return (
    <Box
      ref={viewerContainerRef}
      className={`chord-sheet-container theme-${themeMode} ${
        isFullscreen ? 'fullscreen-mode' : ''
      }`}
    >
      <Snackbar
        open={Boolean(toastMessage)}
        autoHideDuration={3000}
        onClose={() => setToastMessage('')}
        message={toastMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

      {/* ================= Fullscreen Floating Toolbar ================= */}
      {isFullscreen && (
        <Paper elevation={4} className="cs-fullscreen-bar">
          <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
            <Typography variant="subtitle2" fontWeight={800} noWrap sx={{ maxWidth: 220 }}>
              {title || 'Chord Sheet'}{' '}
              {isSplitMode
                ? `(Split: English + ${selectedSplitLanguage})`
                : selectedLanguage !== 'original'
                ? `(${selectedLanguage})`
                : ''}
            </Typography>
            <Chip
              size="small"
              label={`Key: ${currentDisplayKey || 'C'}`}
              color="primary"
              sx={{ fontWeight: 700, height: 22 }}
            />
            {showChords && (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleTransposeStep(-1)}
                  sx={{ minWidth: 26, height: 24, p: 0, fontWeight: 700 }}
                >
                  -
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleTransposeStep(1)}
                  sx={{ minWidth: 26, height: 24, p: 0, fontWeight: 700 }}
                >
                  +
                </Button>
              </Stack>
            )}
          </Box>

          <Box display="flex" alignItems="center" gap={1}>
            <IconButton
              size="small"
              onClick={() => setShowChords(!showChords)}
              sx={{ color: showChords ? '#38bdf8' : 'inherit' }}
              title={showChords ? 'Hide Chords (Lyrics Only)' : 'Show Chords'}
            >
              {showChords ? <QueueMusicIcon fontSize="small" /> : <LyricsIcon fontSize="small" />}
            </IconButton>

            <Button
              size="small"
              variant="contained"
              color="primary"
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
            {/* Left: Mode Switcher & Language Tabs */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              {/* Mode Switcher Pill */}
              <ToggleButtonGroup
                size="small"
                value={showChords ? 'chords' : 'lyrics'}
                exclusive
                onChange={(e, val) => {
                  if (val) setShowChords(val === 'chords');
                }}
                sx={{
                  height: 32,
                  '& .MuiToggleButton-root': {
                    px: { xs: 1.2, sm: 1.5 },
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

              <Divider orientation="vertical" flexItem sx={{ height: 22, my: 'auto' }} />

              {/* Regional Language Tabs */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, flexWrap: 'wrap' }}>
                <Chip
                  label="Original"
                  size="small"
                  clickable
                  color={selectedLanguage === 'original' ? 'primary' : 'default'}
                  variant={selectedLanguage === 'original' ? 'filled' : 'outlined'}
                  onClick={() => setSelectedLanguage('original')}
                  sx={{ fontWeight: 700, fontSize: '0.72rem', height: 26 }}
                />

                {regionalList.map((r) => {
                  const isSelected =
                    selectedLanguage.toLowerCase() === r.language?.toLowerCase();
                  return (
                    <Chip
                      key={r.language}
                      label={r.language}
                      size="small"
                      clickable
                      color={isSelected ? 'primary' : 'default'}
                      variant={isSelected ? 'filled' : 'outlined'}
                      onClick={() => setSelectedLanguage(r.language)}
                      onDelete={
                        songId
                          ? () => handleDeleteRegionalLanguage(r.language)
                          : undefined
                      }
                      deleteIcon={
                        <DeleteOutlineIcon style={{ fontSize: 14 }} />
                      }
                      sx={{ fontWeight: 700, fontSize: '0.72rem', height: 26 }}
                    />
                  );
                })}

                {/* Split View Button (English on left, Regional on right) */}
                {regionalList.length > 0 && (
                  <Chip
                    icon={<SplitViewIcon style={{ fontSize: 14 }} />}
                    label="Split View"
                    size="small"
                    clickable
                    color={isSplitMode ? 'primary' : 'default'}
                    variant={isSplitMode ? 'filled' : 'outlined'}
                    onClick={() => setSelectedLanguage('split')}
                    sx={{ fontWeight: 800, fontSize: '0.72rem', height: 26 }}
                  />
                )}

                {/* + Add Language Button */}
                <Button
                  size="small"
                  variant="outlined"
                  color="primary"
                  startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                  onClick={() => handleOpenAddLangModal()}
                  sx={{
                    textTransform: 'none',
                    borderRadius: 1.75,
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    height: 26,
                    px: 1,
                  }}
                >
                  + Add Language
                </Button>
              </Box>
            </Box>

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
                <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.75rem', px: 0.5 }}>
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

              {/* Chord Badge Highlight Styling */}
              {showChords && (
                <FormControl size="small" sx={{ minWidth: 90 }}>
                  <Select
                    value={highlightStyle}
                    onChange={(e) => setHighlightStyle(e.target.value)}
                    sx={{
                      height: 30,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      borderRadius: 1.5,
                    }}
                  >
                    <MenuItem value="pill">Pill Chords</MenuItem>
                    <MenuItem value="glow">Cyan Glow</MenuItem>
                    <MenuItem value="bold">Bold Text</MenuItem>
                    <MenuItem value="off">Plain</MenuItem>
                  </Select>
                </FormControl>
              )}

              {/* Split Language Switcher when in Split Mode */}
              {isSplitMode && regionalList.length > 1 && (
                <FormControl size="small" sx={{ minWidth: 100 }}>
                  <Select
                    value={selectedSplitLanguage}
                    onChange={(e) => setSelectedSplitLanguage(e.target.value)}
                    sx={{ height: 30, fontSize: '0.75rem', fontWeight: 700, borderRadius: 1.5 }}
                  >
                    {regionalList.map((r) => (
                      <MenuItem key={r.language} value={r.language} sx={{ fontSize: '0.78rem' }}>
                        Right: {r.language}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {/* Two Column Layout Toggle (Only in single language view) */}
              {!isSplitMode && (
                <IconButton
                  size="small"
                  onClick={() => setTwoColumns(!twoColumns)}
                  color={twoColumns ? 'primary' : 'default'}
                  sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, height: 30, width: 30 }}
                  title={twoColumns ? 'Switch to 1 Column' : 'Switch to 2 Columns'}
                >
                  {twoColumns ? <TwoColIcon sx={{ fontSize: 16 }} /> : <SingleColIcon sx={{ fontSize: 16 }} />}
                </IconButton>
              )}
            </Box>

            {/* Right: Copy, Print, Fullscreen, and Edit Buttons */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Tooltip title={copied ? 'Copied to Clipboard!' : 'Copy Formatted Text'}>
                <IconButton
                  size="small"
                  onClick={handleCopy}
                  sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, height: 30, width: 30 }}
                >
                  {copied ? <CheckIcon sx={{ fontSize: 15, color: 'success.main' }} /> : <ContentCopyIcon sx={{ fontSize: 15 }} />}
                </IconButton>
              </Tooltip>

              <Tooltip title="Print / Save PDF">
                <IconButton
                  size="small"
                  onClick={handlePrint}
                  sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, height: 30, width: 30 }}
                >
                  <PrintIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>

              <Tooltip title="Fullscreen Stage Mode">
                <IconButton
                  size="small"
                  onClick={() => setIsFullscreen(true)}
                  sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, height: 30, width: 30 }}
                >
                  <FullscreenIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>

              {onEdit && (
                <Button
                  size="small"
                  variant="outlined"
                  color="inherit"
                  startIcon={<EditIcon sx={{ fontSize: 14 }} />}
                  onClick={onEdit}
                  sx={{
                    height: 30,
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    borderRadius: 1.5,
                    px: 1.25,
                  }}
                >
                  Edit Sheet
                </Button>
              )}
            </Box>
          </Box>

          {/* Tier 3: Interactive Section Jump Chips */}
          {sections.length > 0 && !isSplitMode && (
            <Box sx={{ pt: 1.25, borderTop: '1px solid', borderColor: 'divider', mt: 1.25 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  overflowX: 'auto',
                  pb: 0.25,
                }}
              >
                <Typography
                  variant="caption"
                  fontWeight={800}
                  color="text.secondary"
                  sx={{ fontSize: '0.68rem', textTransform: 'uppercase', flexShrink: 0 }}
                >
                  Sections:
                </Typography>
                {sections.map((sec) => (
                  <Chip
                    key={sec.id}
                    label={sec.name}
                    size="small"
                    clickable
                    onClick={() => scrollToSection(sec.id)}
                    sx={{
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

      {/* ================= Rendered Sheet (Single Language or Split View) ================= */}
      {isSplitMode ? (
        // ================= SPLIT VIEW (English on Left, Regional Language on Right) =================
        <Paper
          variant="outlined"
          sx={{
            p: { xs: 1.5, sm: 2.5 },
            borderRadius: 2.5,
            bgcolor: 'background.paper',
          }}
        >
          <Grid container spacing={3}>
            {/* Left Column: English (Original) */}
            <Grid item xs={12} md={6}>
              <Box sx={{ pb: 1, mb: 1.5, borderBottom: '2px solid', borderColor: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle2" fontWeight={800} color="primary.main">
                  ENGLISH (ORIGINAL)
                </Typography>
              </Box>
              <Box
                className={`chord-sheet-body ${
                  showChords ? 'cs-mode-chords' : 'cs-mode-lyrics-only'
                }`}
                style={{ fontSize: `${fontSize}px` }}
              >
                {leftSplitData.parsedLines.length > 0 ? (
                  renderSheetLines(leftSplitData.parsedLines)
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    No English lyrics available.
                  </Typography>
                )}
              </Box>
            </Grid>

            {/* Right Column: Regional Language (e.g. Telugu) */}
            <Grid item xs={12} md={6} sx={{ borderLeft: { md: '1px solid' }, borderColor: { md: 'divider' } }}>
              <Box sx={{ pb: 1, mb: 1.5, borderBottom: '2px solid', borderColor: '#38bdf8', display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#0284c7' }}>
                  {(selectedSplitLanguage || 'Regional Language').toUpperCase()}
                </Typography>
              </Box>
              <Box
                className={`chord-sheet-body ${
                  showChords ? 'cs-mode-chords' : 'cs-mode-lyrics-only'
                }`}
                style={{ fontSize: `${fontSize}px` }}
              >
                {rightSplitData.parsedLines.length > 0 ? (
                  renderSheetLines(rightSplitData.parsedLines)
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    No regional lyrics added yet. Click "+ Add Language" above.
                  </Typography>
                )}
              </Box>
            </Grid>
          </Grid>
        </Paper>
      ) : parsedLines.length > 0 ? (
        // ================= STANDARD VIEW =================
        <Box
          className={`chord-sheet-body ${
            showChords ? 'cs-mode-chords' : 'cs-mode-lyrics-only'
          } ${twoColumns ? 'chord-sheet-columns-2' : ''}`}
          style={{ fontSize: `${fontSize}px` }}
        >
          {renderSheetLines(parsedLines)}
        </Box>
      ) : (
        <Box textAlign="center" py={6}>
          <Typography variant="body1" color="text.secondary">
            No song content available.
          </Typography>
        </Box>
      )}

      {/* ================= Add / Edit Language Dialog ================= */}
      <Dialog
        open={addLangDialogOpen}
        onClose={() => !savingLang && setAddLangDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box display="flex" alignItems="center" gap={1}>
            <TranslateIcon color="primary" />
            <Typography variant="h6" fontWeight={700}>
              Add Language Lyrics
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setAddLangDialogOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          {langError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {langError}
            </Alert>
          )}

          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <FormControl fullWidth size="small">
              <InputLabel id="preset-lang-label">Select Language</InputLabel>
              <Select
                labelId="preset-lang-label"
                value={selectedPreset}
                label="Select Language"
                onChange={(e) => setSelectedPreset(e.target.value)}
              >
                {LANGUAGE_PRESETS.map((lang) => (
                  <MenuItem key={lang} value={lang}>
                    {lang}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {selectedPreset === 'Custom' && (
              <TextField
                size="small"
                label="Custom Language Name"
                placeholder="e.g. Swahili, Greek, etc."
                value={customLangName}
                onChange={(e) => setCustomLangName(e.target.value)}
                fullWidth
                required
              />
            )}

            {/* Quick Section Tag Inserters */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                Quick Insert Section Tags:
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                {['[Verse 1]', '[Chorus]', '[Verse 2]', '[Bridge]', '[Outro]'].map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    onClick={() => handleInsertSectionTag(tag)}
                    sx={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.72rem' }}
                  />
                ))}
              </Stack>
            </Box>

            <TextField
              label="Language Lyrics & Chords"
              placeholder={`[Verse 1]\nEnter lyrics in the selected language...\n\n[Chorus]\nEnter chorus in the selected language...`}
              multiline
              rows={12}
              value={langLyrics}
              onChange={(e) => setLangLyrics(e.target.value)}
              fullWidth
              variant="outlined"
              inputProps={{
                style: {
                  fontFamily: '"Fira Code", monospace, sans-serif',
                  fontSize: '0.85rem',
                },
              }}
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={() => setAddLangDialogOpen(false)}
            disabled={savingLang}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<SaveIcon />}
            onClick={handleSaveRegionalLanguage}
            disabled={savingLang}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
          >
            {savingLang ? 'Saving...' : 'Save Language Lyrics'}
          </Button>
        </DialogActions>
      </Dialog>

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
