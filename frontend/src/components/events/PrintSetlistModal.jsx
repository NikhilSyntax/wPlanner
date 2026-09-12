import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  IconButton,
  FormControl,
  Select,
  MenuItem,
  ToggleButtonGroup,
  ToggleButton,
  FormControlLabel,
  Checkbox,
  Divider,
  CircularProgress,
  Paper,
  Grid,
} from '@mui/material';
import {
  Close as CloseIcon,
  Print as PrintIcon,
  ViewWeek as TwoColIcon,
  ViewAgenda as OneColIcon,
  MusicNote as MusicIcon,
  Lyrics as LyricsIcon,
  Tune as TuneIcon,
} from '@mui/icons-material';
import api from '../../services/api';
import './PrintSetlist.css';

// Musical notes for transposition
const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const NOTE_MAP = {
  ...SHARPS.reduce((acc, note, idx) => ({ ...acc, [note]: idx }), {}),
  ...FLATS.reduce((acc, note, idx) => ({ ...acc, [note]: idx }), {}),
};

const CHORD_REGEX_STR =
  '([A-G][#b]?(?:m|min|maj|dim|aug|sus[24]?|add[29]?|[2-9]|11|13|maj7|m7|7|6|9|dim7)?(?:\\/[A-G][#b]?)?)';
const CHORD_TOKEN_REGEX = new RegExp(`^${CHORD_REGEX_STR}$`);

const SECTION_REGEX =
  /^\s*(\[|\()?(Intro|Verse(?:\s*\d+)?|Chorus(?:\s*\d+)?|Pre-Chorus(?:\s*\d+)?|Bridge(?:\s*\d+)?|Outro|Ending|Tag|Interlude|Hook|Solo|Instrumental|Prelude|Postlude|Pallavi(?:\s*\d+)?|Anupallavi(?:\s*\d+)?|Charanam(?:\s*\d+)?|Refrain|Stanza(?:\s*\d+)?|Coro|Estrofa(?:\s*\d+)?|Puente)(\]|\)|:)?\s*$/i;

function transposeChord(chord, semitones) {
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
}

function getSemitoneShift(originalKey, targetKey) {
  if (!originalKey || !targetKey || originalKey === targetKey) return 0;
  const origIdx = NOTE_MAP[originalKey];
  const targetIdx = NOTE_MAP[targetKey];
  if (origIdx === undefined || targetIdx === undefined) return 0;
  let shift = targetIdx - origIdx;
  if (shift > 6) shift -= 12;
  if (shift < -6) shift += 12;
  return shift;
}

function isChordLine(line) {
  const cleanLine = (line || '').replace(/\[\/?tab\]/gi, '');
  const trimmed = cleanLine.trim();
  if (!trimmed) return false;
  if (SECTION_REGEX.test(trimmed)) return false;

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;

  let chordCount = 0;
  for (const token of tokens) {
    if (CHORD_TOKEN_REGEX.test(token)) chordCount++;
  }
  return chordCount / tokens.length >= 0.5;
}

function tokenizeChordLine(line, semitones = 0) {
  const cleanLine = (line || '').replace(/\[\/?tab\]/gi, '');
  const regex = /([^\s]+|\s+)/g;
  let match;
  const rawTokens = [];

  while ((match = regex.exec(cleanLine)) !== null) {
    const item = match[0];
    if (/^\s+$/.test(item)) {
      rawTokens.push({ type: 'space', text: item });
    } else if (CHORD_TOKEN_REGEX.test(item)) {
      const transposed = transposeChord(item, semitones);
      rawTokens.push({
        type: 'chord',
        original: item,
        text: transposed,
      });
    } else {
      rawTokens.push({ type: 'text', text: item });
    }
  }

  for (let i = 0; i < rawTokens.length; i++) {
    const token = rawTokens[i];
    if (token.type === 'chord' && semitones !== 0) {
      const diff = token.text.length - token.original.length;
      if (diff !== 0 && i + 1 < rawTokens.length && rawTokens[i + 1].type === 'space') {
        const nextSpace = rawTokens[i + 1];
        if (diff > 0 && nextSpace.text.length > diff) {
          rawTokens[i + 1] = {
            ...nextSpace,
            text: nextSpace.text.substring(diff),
          };
        } else if (diff < 0) {
          rawTokens[i + 1] = {
            ...nextSpace,
            text: ' '.repeat(Math.abs(diff)) + nextSpace.text,
          };
        }
      }
    }
  }

  return rawTokens.map((t) => t.text).join('');
}

/**
 * Splits a monospace chord line and lyric line together at word boundaries
 * so chords stay locked above words and lines NEVER overflow the column width.
 */
function splitMonospacePair(rawChord, rawLyric, maxChars, semitones) {
  const cText = rawChord || '';
  const lText = rawLyric || '';
  const totalLen = Math.max(cText.length, lText.length);

  if (totalLen <= maxChars || maxChars === Infinity) {
    return [
      {
        chord: cText ? tokenizeChordLine(cText, semitones) : '',
        lyric: lText,
      },
    ];
  }

  const chunks = [];
  let curChord = cText;
  let curLyric = lText;

  while (curChord.length > 0 || curLyric.length > 0) {
    const curLen = Math.max(curChord.length, curLyric.length);
    if (curLen <= maxChars) {
      chunks.push({
        chord: curChord ? tokenizeChordLine(curChord, semitones) : '',
        lyric: curLyric,
      });
      break;
    }

    // Find all chord positions in curChord so we never slice a chord token in half
    const chordSpans = [];
    const chordRegex = /\S+/g;
    let m;
    while ((m = chordRegex.exec(curChord)) !== null) {
      chordSpans.push({ start: m.index, end: m.index + m[0].length });
    }

    const searchLimit = Math.min(maxChars, curLen);
    const lyricWindow = curLyric.substring(0, searchLimit + 1);
    let splitPos = lyricWindow.lastIndexOf(' ');

    const minSplitThreshold = Math.max(10, Math.floor(maxChars * 0.35));
    if (splitPos < minSplitThreshold) {
      const chordWindow = curChord.substring(0, searchLimit + 1);
      const chordSpace = chordWindow.lastIndexOf(' ');
      if (chordSpace >= minSplitThreshold) {
        splitPos = chordSpace;
      } else {
        splitPos = searchLimit;
      }
    }

    // Ensure splitPos does not slice through any chord token
    for (const span of chordSpans) {
      if (span.start < splitPos && splitPos < span.end) {
        if (span.start >= minSplitThreshold) {
          splitPos = span.start;
        } else if (span.end <= searchLimit + 3) {
          splitPos = span.end;
        }
        break;
      }
    }

    if (splitPos < curLen && curLyric[splitPos] === ' ' && curChord[splitPos] === ' ') {
      splitPos = splitPos + 1;
    }

    splitPos = Math.max(1, Math.min(splitPos, curLen));

    const chunkChordText = curChord.substring(0, splitPos);
    const chunkLyricText = curLyric.substring(0, splitPos);

    chunks.push({
      chord: chunkChordText ? tokenizeChordLine(chunkChordText, semitones) : '',
      lyric: chunkLyricText,
    });

    let nextChord = curChord.substring(splitPos);
    let nextLyric = curLyric.substring(splitPos);

    // Trim equal common leading spaces so wrapped lines don't waste indent
    let leadChordSpaces = 0;
    while (leadChordSpaces < nextChord.length && nextChord[leadChordSpaces] === ' ') {
      leadChordSpaces++;
    }
    let leadLyricSpaces = 0;
    while (leadLyricSpaces < nextLyric.length && nextLyric[leadLyricSpaces] === ' ') {
      leadLyricSpaces++;
    }
    const commonIndent = Math.min(leadChordSpaces, leadLyricSpaces);
    if (commonIndent > 0) {
      nextChord = nextChord.substring(commonIndent);
      nextLyric = nextLyric.substring(commonIndent);
    }

    curChord = nextChord;
    curLyric = nextLyric;
  }

  return chunks;
}

function parseSongSections(content = '', semitones = 0, maxChars = 38) {
  if (!content) return [];
  const cleanContent = content.replace(/\[\/?tab\]/gi, '');
  const rawLines = cleanContent.split(/\r?\n/);

  const sections = [];
  let currentSection = {
    name: '',
    category: 'default',
    pairs: [],
  };

  let i = 0;
  while (i < rawLines.length) {
    const line = rawLines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    const sectionMatch = trimmed.match(SECTION_REGEX);
    if (sectionMatch) {
      if (currentSection.pairs.length > 0 || currentSection.name) {
        sections.push(currentSection);
      }
      const cleanName = sectionMatch[2] || trimmed;
      const lower = cleanName.toLowerCase();
      let category = 'default';
      if (lower.includes('chorus') || lower.includes('refrain')) category = 'chorus';
      else if (lower.includes('bridge') || lower.includes('puente')) category = 'bridge';
      else if (lower.includes('verse') || lower.includes('stanza')) category = 'verse';

      currentSection = {
        name: cleanName,
        category,
        pairs: [],
      };
      i++;
      continue;
    }

    if (isChordLine(line)) {
      const nextLine = i + 1 < rawLines.length ? rawLines[i + 1] : '';
      const nextTrimmed = nextLine.trim();

      if (nextLine && nextTrimmed && !SECTION_REGEX.test(nextTrimmed) && !isChordLine(nextLine)) {
        const chunks = splitMonospacePair(line, nextLine, maxChars, semitones);
        currentSection.pairs.push(...chunks);
        i += 2;
      } else {
        const chunks = splitMonospacePair(line, '', maxChars, semitones);
        currentSection.pairs.push(...chunks);
        i++;
      }
    } else {
      const chunks = splitMonospacePair('', line, maxChars, semitones);
      currentSection.pairs.push(...chunks);
      i++;
    }
  }

  if (currentSection.pairs.length > 0 || currentSection.name) {
    sections.push(currentSection);
  }

  return sections;
}

function PrintSetlistModal({ open, onClose, event, setlist = [], bankSongs = [] }) {
  const [loading, setLoading] = useState(false);
  const [fullSongs, setFullSongs] = useState([]);
  const [selectedSongIds, setSelectedSongIds] = useState([]);
  const [songKeys, setSongKeys] = useState({});

  // Print customization options
  const [viewMode, setViewMode] = useState('chords'); // 'chords' | 'lyrics'
  const [layoutColumns, setLayoutColumns] = useState(2); // 2 | 1 (2 = split view)
  const [pageBreakPerSong, setPageBreakPerSong] = useState(true);
  const [fontSize, setFontSize] = useState('medium'); // 'small' | 'medium' | 'large' | 'xlarge'

  const bankSongsRef = useRef(bankSongs);
  useEffect(() => {
    bankSongsRef.current = bankSongs;
  }, [bankSongs]);

  // Compute a stable setlist key signature to prevent infinite re-renders
  const setlistSignature = useMemo(() => {
    if (!open || !Array.isArray(setlist)) return '';
    return setlist
      .map((s) => (s && typeof s === 'object' ? `${s._id || ''}_${s.key || s.selectedKey || ''}` : String(s)))
      .join('|');
  }, [open, setlist]);

  // Load complete song data when modal opens or setlist signature changes
  useEffect(() => {
    if (!open) {
      setFullSongs([]);
      setSelectedSongIds([]);
      setLoading(false);
      return;
    }

    if (!setlist || setlist.length === 0) {
      setFullSongs([]);
      setSelectedSongIds([]);
      setLoading(false);
      return;
    }

    let isMounted = true;
    async function loadSetlistData() {
      setLoading(true);
      try {
        const bankMap = {};
        (bankSongsRef.current || []).forEach((s) => {
          if (s?._id) bankMap[s._id] = s;
        });

        const enriched = await Promise.all(
          setlist.map(async (item) => {
            const songId = item?._id || item;
            const bankSong = bankMap[songId] || {};

            if (item?.content?.chords || item?.content?.lyrics) {
              return {
                ...bankSong,
                ...item,
                _id: songId,
                title: item.title || bankSong.title || 'Untitled Song',
                artist: item.artist || bankSong.artist || '',
                key: item.selectedKey || item.key || bankSong.key || 'C',
                originalKey: bankSong.key || item.key || 'C',
                timeSignature: item.timeSignature || bankSong.timeSignature || '',
                bpm: item.bpm || bankSong.bpm || '',
                content: item.content || bankSong.content || {},
              };
            }

            try {
              const res = await api.get(`/songs/${songId}`);
              const fetched = res.data || {};
              return {
                ...bankSong,
                ...fetched,
                _id: songId,
                title: item?.title || fetched.title || bankSong.title || 'Untitled Song',
                artist: item?.artist || fetched.artist || bankSong.artist || '',
                key: item?.selectedKey || item?.key || fetched.key || bankSong.key || 'C',
                originalKey: fetched.key || item?.key || bankSong.key || 'C',
                timeSignature: item?.timeSignature || fetched.timeSignature || bankSong.timeSignature || '',
                bpm: item?.bpm || fetched.bpm || bankSong.bpm || '',
                content: fetched.content || bankSong.content || {},
              };
            } catch (err) {
              return {
                ...bankSong,
                ...(typeof item === 'object' ? item : {}),
                _id: songId,
                title: item?.title || bankSong.title || 'Untitled Song',
                artist: item?.artist || bankSong.artist || '',
                key: item?.selectedKey || item?.key || bankSong.key || 'C',
                originalKey: bankSong.key || item?.key || 'C',
                timeSignature: item?.timeSignature || bankSong.timeSignature || '',
                bpm: item?.bpm || bankSong.bpm || '',
                content: item?.content || bankSong.content || {},
              };
            }
          })
        );

        if (isMounted) {
          setFullSongs(enriched);
          setSelectedSongIds(enriched.map((s) => s._id));

          const initialKeys = {};
          enriched.forEach((s) => {
            let prefKey = s.key || s.originalKey || 'C';
            try {
              const saved = localStorage.getItem(`wplanner_user_key_pref_${s._id}`);
              if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed?.preferredKey) prefKey = parsed.preferredKey;
              }
            } catch (e) {
              // Ignore preference parse error
            }
            initialKeys[s._id] = prefKey;
          });
          setSongKeys(initialKeys);
        }
      } catch (err) {
        console.error('Error preparing setlist for print:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadSetlistData();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, setlistSignature]);

  const handleKeyChange = (songId, newKey) => {
    setSongKeys((prev) => ({
      ...prev,
      [songId]: newKey,
    }));
  };

  const handleToggleSong = (songId) => {
    setSelectedSongIds((prev) =>
      prev.includes(songId) ? prev.filter((id) => id !== songId) : [...prev, songId]
    );
  };

  const handleSelectAll = () => {
    if (selectedSongIds.length === fullSongs.length) {
      setSelectedSongIds([]);
    } else {
      setSelectedSongIds(fullSongs.map((s) => s._id));
    }
  };

  const handleTriggerPrint = () => {
    window.print();
  };

  const songsToPrint = useMemo(() => {
    return fullSongs.filter((s) => selectedSongIds.includes(s._id));
  }, [fullSongs, selectedSongIds]);

  // Maximum characters per line based on columns and font size to prevent overlapping
  const maxLineChars = useMemo(() => {
    if (layoutColumns === 2) {
      if (fontSize === 'small') return 44;
      if (fontSize === 'medium') return 38;
      if (fontSize === 'large') return 34;
      return 28;
    }
    if (fontSize === 'small') return 90;
    if (fontSize === 'medium') return 80;
    if (fontSize === 'large') return 70;
    return 60;
  }, [layoutColumns, fontSize]);

  const formattedEventDate = useMemo(() => {
    if (!event?.date) return '';
    try {
      const d = new Date(event.date);
      return d.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (e) {
      return event.date;
    }
  }, [event?.date]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      scroll="paper"
      PaperProps={{
        sx: {
          borderRadius: 3,
          maxHeight: '92vh',
        },
      }}
    >
      <DialogTitle
        className="print-no-print"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box display="flex" alignItems="center" gap={1.5}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              bgcolor: 'primary.main',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PrintIcon fontSize="small" />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.2 }}>
              Print Set List
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Generate 2-column split view chord charts and lyrics PDF for &ldquo;{event?.title || 'Event'}&rdquo;
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: { xs: 2, sm: 3 } }}>
        {loading ? (
          <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" py={8} gap={2}>
            <CircularProgress size={36} />
            <Typography variant="body2" color="text.secondary">
              Preparing setlist chord sheets and lyrics...
            </Typography>
          </Box>
        ) : fullSongs.length === 0 ? (
          <Box py={6} textAlign="center">
            <MusicIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1.5 }} />
            <Typography variant="subtitle1" fontWeight={600}>
              No songs in this setlist
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Add songs to your event setlist first to print or export to PDF.
            </Typography>
          </Box>
        ) : (
          <Box>
            {/* Print Options Toolbar */}
            <Paper
              variant="outlined"
              className="print-options-panel print-no-print"
              sx={{
                p: 2,
                borderRadius: 2.5,
                mb: 2.5,
                bgcolor: 'background.paper',
              }}
            >
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                <TuneIcon fontSize="small" color="primary" /> Print & Layout Options
              </Typography>

              <Grid container spacing={2} alignItems="center">
                {/* View Mode: Chords & Lyrics vs Lyrics Only */}
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="caption" fontWeight={600} color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                    Content Mode
                  </Typography>
                  <ToggleButtonGroup
                    value={viewMode}
                    exclusive
                    onChange={(e, val) => val && setViewMode(val)}
                    size="small"
                    fullWidth
                  >
                    <ToggleButton value="chords" sx={{ textTransform: 'none', fontWeight: 600, gap: 0.5, py: 0.6 }}>
                      <MusicIcon fontSize="small" /> Chords & Lyrics
                    </ToggleButton>
                    <ToggleButton value="lyrics" sx={{ textTransform: 'none', fontWeight: 600, gap: 0.5, py: 0.6 }}>
                      <LyricsIcon fontSize="small" /> Lyrics Only
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Grid>

                {/* Columns Layout: 2-Column Split View vs 1 Column */}
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="caption" fontWeight={600} color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                    Page Columns (Split View)
                  </Typography>
                  <ToggleButtonGroup
                    value={layoutColumns}
                    exclusive
                    onChange={(e, val) => val && setLayoutColumns(val)}
                    size="small"
                    fullWidth
                  >
                    <ToggleButton value={2} sx={{ textTransform: 'none', fontWeight: 600, gap: 0.5, py: 0.6 }}>
                      <TwoColIcon fontSize="small" /> 2 Columns (Split)
                    </ToggleButton>
                    <ToggleButton value={1} sx={{ textTransform: 'none', fontWeight: 600, gap: 0.5, py: 0.6 }}>
                      <OneColIcon fontSize="small" /> 1 Column
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Grid>

                {/* Font Size Preset */}
                <Grid item xs={6} sm={6} md={3}>
                  <Typography variant="caption" fontWeight={600} color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                    Print Font Size
                  </Typography>
                  <FormControl size="small" fullWidth>
                    <Select
                      value={fontSize}
                      onChange={(e) => setFontSize(e.target.value)}
                      sx={{ borderRadius: 1.5 }}
                    >
                      <MenuItem value="small">Small (Compact - 9.5pt)</MenuItem>
                      <MenuItem value="medium">Medium (Standard - 11pt)</MenuItem>
                      <MenuItem value="large">Large (Readable - 12.5pt)</MenuItem>
                      <MenuItem value="xlarge">Extra Large (14pt)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {/* Page Breaks */}
                <Grid item xs={6} sm={6} md={3}>
                  <Typography variant="caption" fontWeight={600} color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                    Page Breaks
                  </Typography>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={pageBreakPerSong}
                        onChange={(e) => setPageBreakPerSong(e.target.checked)}
                        size="small"
                        color="primary"
                      />
                    }
                    label={<Typography variant="body2" fontWeight={500}>New page per song</Typography>}
                    sx={{ m: 0 }}
                  />
                </Grid>
              </Grid>

              {/* Song Selection & Key Customization Row */}
              <Divider sx={{ my: 1.5 }} />
              <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Button size="small" onClick={handleSelectAll} sx={{ textTransform: 'none', fontWeight: 600 }}>
                    {selectedSongIds.length === fullSongs.length ? 'Deselect All' : 'Select All Songs'}
                  </Button>
                  <Typography variant="caption" color="text.secondary">
                    ({songsToPrint.length} of {fullSongs.length} songs selected)
                  </Typography>
                </Box>
              </Box>

              {/* Per-Song Keys Bar */}
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1.5 }}>
                {fullSongs.map((s, idx) => {
                  const isSelected = selectedSongIds.includes(s._id);
                  const currentKey = songKeys[s._id] || s.key || 'C';
                  return (
                    <Box
                      key={s._id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.75,
                        p: 0.6,
                        px: 1,
                        borderRadius: 1.5,
                        border: '1px solid',
                        borderColor: isSelected ? 'primary.light' : 'divider',
                        bgcolor: isSelected ? 'rgba(37, 99, 235, 0.04)' : 'transparent',
                      }}
                    >
                      <Checkbox
                        size="small"
                        checked={isSelected}
                        onChange={() => handleToggleSong(s._id)}
                        sx={{ p: 0.2 }}
                      />
                      <Typography variant="caption" fontWeight={700} noWrap sx={{ maxWidth: 120 }}>
                        {idx + 1}. {s.title}
                      </Typography>
                      {viewMode === 'chords' && (
                        <Select
                          size="small"
                          value={currentKey}
                          onChange={(e) => handleKeyChange(s._id, e.target.value)}
                          sx={{
                            height: 24,
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            bgcolor: 'background.paper',
                            '& .MuiSelect-select': { py: 0.2, px: 0.8 },
                          }}
                        >
                          {SHARPS.map((k) => (
                            <MenuItem key={k} value={k} sx={{ fontSize: '0.8rem', py: 0.5 }}>
                              {k}
                            </MenuItem>
                          ))}
                        </Select>
                      )}
                    </Box>
                  );
                })}
              </Box>
            </Paper>

            {/* Print Preview Canvas */}
            <Typography variant="subtitle2" fontWeight={700} color="text.secondary" className="print-no-print" sx={{ mb: 1 }}>
              Print & PDF Preview ({layoutColumns === 2 ? 'Split View - 2 Columns' : 'Single Column'}):
            </Typography>

            <Box className="print-setlist-preview-container">
              {/* PRINT ROOT ELEMENT THAT IS TARGETED IN @media print */}
              <div id="print-setlist-root" className={`print-font-${fontSize} ${viewMode === 'lyrics' ? 'print-mode-lyrics' : 'print-mode-chords'}`}>
                <div className="print-setlist-sheet">
                  {/* Event Header Banner */}
                  <div className="print-event-header">
                    <div>
                      <h1 className="print-event-title">{event?.title || 'Worship Setlist'}</h1>
                      <div className="print-event-meta">
                        {formattedEventDate && <span>{formattedEventDate}</span>}
                        {event?.time && <span> • {event.time}</span>}
                        {event?.churchName && <span> • {event.churchName}</span>}
                      </div>
                    </div>
                    <div className="print-event-meta" style={{ textAlign: 'right' }}>
                      <strong>{songsToPrint.length} Songs in Setlist</strong>
                      <div>wPlanner Sheet Music</div>
                    </div>
                  </div>

                  {/* Songs List */}
                  {songsToPrint.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" py={4} textAlign="center">
                      No songs selected. Please select at least one song to print.
                    </Typography>
                  ) : (
                    songsToPrint.map((song, songIndex) => {
                      const targetKey = songKeys[song._id] || song.key || song.originalKey || 'C';
                      const origKey = song.originalKey || song.key || 'C';
                      const semitones = getSemitoneShift(origKey, targetKey);
                      const contentText = song.content?.chords || song.content?.lyrics || '';
                      const sections = parseSongSections(contentText, semitones, maxLineChars);
                      const isLastSong = songIndex === songsToPrint.length - 1;

                      return (
                        <div
                          key={song._id}
                          className={`print-song-card ${pageBreakPerSong && !isLastSong ? 'page-break-after' : ''}`}
                        >
                          {/* Song Header */}
                          <div className="print-song-header">
                            <div className="print-song-title-group">
                              <span className="print-song-number">{songIndex + 1}.</span>
                              <div>
                                <span className="print-song-title">{song.title}</span>
                                {song.artist && <span className="print-song-artist"> — {song.artist}</span>}
                              </div>
                            </div>
                            <div className="print-song-badges">
                              <span className="print-badge print-badge-key">
                                Key: {targetKey} {semitones !== 0 ? `(${semitones > 0 ? `+${semitones}` : semitones})` : ''}
                              </span>
                              {song.timeSignature && (
                                <span className="print-badge">{song.timeSignature}</span>
                              )}
                              {song.bpm && (
                                <span className="print-badge">{song.bpm} BPM</span>
                              )}
                            </div>
                          </div>

                          {/* Song Body in Split View (2 Columns) */}
                          <div className={layoutColumns === 2 ? 'print-song-body-2col' : 'print-song-body-1col'}>
                            {sections.length === 0 ? (
                              <div style={{ color: '#64748b', fontStyle: 'italic', padding: '1rem' }}>
                                No chord/lyric sheet content available for this song.
                              </div>
                            ) : (
                              sections.map((sec, secIdx) => (
                                <div key={secIdx} className="print-section-block">
                                  {sec.name && (
                                    <div className={`print-section-header ${sec.category}`}>
                                      {sec.name}
                                    </div>
                                  )}
                                  {sec.pairs.map((pair, pIdx) => (
                                    <div key={pIdx} className="print-paired-line">
                                      {viewMode === 'chords' && pair.chord && (
                                        <div className="print-chord-line">{pair.chord}</div>
                                      )}
                                      {pair.lyric && (
                                        <div className="print-lyric-line">{pair.lyric}</div>
                                      )}
                                      {!pair.chord && !pair.lyric && (
                                        <div style={{ height: '0.6em' }} />
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions
        className="print-no-print"
        sx={{
          p: 2,
          px: 3,
          borderTop: '1px solid',
          borderColor: 'divider',
          justifyContent: 'space-between',
        }}
      >
        <Button onClick={onClose} color="inherit" sx={{ textTransform: 'none', fontWeight: 600 }}>
          Close
        </Button>
        <Button
          variant="contained"
          color="primary"
          startIcon={<PrintIcon />}
          onClick={handleTriggerPrint}
          disabled={loading || songsToPrint.length === 0}
          sx={{
            borderRadius: 2,
            px: 3,
            py: 1,
            fontWeight: 700,
            textTransform: 'none',
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
          }}
        >
          Print / Save as PDF
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default PrintSetlistModal;
