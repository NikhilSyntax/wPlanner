import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  ButtonGroup,
  Paper,
} from '@mui/material';
import {
  ArrowLeft as ArrowLeftIcon,
  ArrowRight as ArrowRightIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Edit as EditIcon,
  MusicNote as MusicNoteIcon,
} from '@mui/icons-material';

const COMMON_CHORDS = [
  'C', 'G', 'D', 'Em', 'Am', 'F', 'A', 'E', 'Bm', 'Bb',
  'C/E', 'G/B', 'D/F#', 'Csus', 'Dsus', 'Gsus',
];

const CHORD_TOKEN_REGEX =
  /^([A-G][#b]?(?:m|min|maj|dim|aug|sus[24]?|add[29]?|[2-9]|11|13|maj7|m7|7|6|9|dim7)?(?:\/[A-G][#b]?)?)$/;

const SECTION_HEADER_REGEX =
  /^\s*(\[|\()?(Intro|Verse(?:\s*\d+)?|Chorus(?:\s*\d+)?|Pre-Chorus(?:\s*\d+)?|Bridge(?:\s*\d+)?|Outro|Ending|Tag|Interlude|Hook|Solo|Instrumental|Prelude|Postlude|Pallavi(?:\s*\d+)?|Anupallavi(?:\s*\d+)?|Charanam(?:\s*\d+)?|Refrain|Stanza(?:\s*\d+)?|Coro|Estrofa(?:\s*\d+)?|Puente)(\]|\)|\:)?\s*$/i;

function isSectionHeader(line) {
  const clean = (line || '').replace(/\[\/?tab\]/gi, '').trim();
  if (!clean) return false;
  if (SECTION_HEADER_REGEX.test(clean)) return true;
  const match = clean.match(/^\[([^\]]+)\]$/);
  if (match) {
    const inner = match[1].trim();
    if (/^(tab|\/tab|ch|\/ch)$/i.test(inner)) return false;
    if (CHORD_TOKEN_REGEX.test(inner)) return false;
    return true;
  }
  return false;
}

function isChordRow(line) {
  const clean = (line || '').replace(/\[\/?tab\]/gi, '').trim();
  if (!clean || isSectionHeader(clean)) return false;
  const tokens = clean.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  let count = 0;
  for (const t of tokens) {
    if (CHORD_TOKEN_REGEX.test(t)) count++;
  }
  return count / tokens.length >= 0.5;
}

function extractChordsFromRow(row) {
  const clean = (row || '').replace(/\[\/?tab\]/gi, '');
  const chords = [];
  const regex = /\S+/g;
  let m;
  while ((m = regex.exec(clean)) !== null) {
    if (CHORD_TOKEN_REGEX.test(m[0])) {
      chords.push({ chord: m[0], position: m.index });
    }
  }
  return chords;
}

function reconstructRowFromChords(chords) {
  const sorted = [...chords].sort((a, b) => a.position - b.position);
  let str = '';
  for (const c of sorted) {
    const pos = Math.max(0, c.position);
    if (str.length < pos) {
      str += ' '.repeat(pos - str.length);
    } else if (str.length > pos && str.length > 0) {
      str += ' '; // single space minimum separator if overlapping
    }
    str += c.chord;
  }
  return str;
}

export default function VisualChordEditor({ rawChords = '', onChange }) {
  // Dialog state for editing an individual chord
  const [activeEdit, setActiveEdit] = useState(null); // { lineIndex, chordIndex, chordName, position, maxLen }
  const [chordInput, setChordInput] = useState('');

  // Parse raw monospace text into structured editable blocks
  const parsedBlocks = useMemo(() => {
    const cleanChords = (rawChords || '').replace(/\[\/?tab\]/gi, '');
    const rawLines = cleanChords.split(/\r?\n/);
    const blocks = [];

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        blocks.push({ type: 'empty', rawIndex: i });
        continue;
      }

      if (isSectionHeader(trimmed)) {
        blocks.push({ type: 'section', name: trimmed, rawIndex: i });
        continue;
      }

      if (isChordRow(line)) {
        const nextLine = rawLines[i + 1];
        const nextTrimmed = nextLine ? nextLine.trim() : '';
        const nextIsLyric =
          nextTrimmed &&
          !isSectionHeader(nextTrimmed) &&
          !isChordRow(nextLine);

        if (nextIsLyric) {
          const chords = extractChordsFromRow(line);
          blocks.push({
            type: 'pair',
            chords,
            lyric: nextLine,
            rawIndex: i,
            pairedRawIndex: i + 1,
          });
          i++; // Skip the paired lyric line
        } else {
          // Standalone chord row
          const chords = extractChordsFromRow(line);
          blocks.push({
            type: 'pair',
            chords,
            lyric: '',
            rawIndex: i,
          });
        }
        continue;
      }

      // Plain lyric line without chords
      blocks.push({
        type: 'pair',
        chords: [],
        lyric: line,
        rawIndex: i,
      });
    }

    return blocks;
  }, [rawChords]);

  // Update a block and trigger onChange with reconstructed raw text
  const updateBlockChords = (blockIdx, newChords) => {
    const newBlocks = [...parsedBlocks];
    newBlocks[blockIdx] = {
      ...newBlocks[blockIdx],
      chords: newChords.sort((a, b) => a.position - b.position),
    };

    // Reconstruct raw monospace string
    const resultLines = [];
    for (const b of newBlocks) {
      if (b.type === 'empty') {
        resultLines.push('');
      } else if (b.type === 'section') {
        resultLines.push(b.name);
      } else if (b.type === 'pair') {
        if (b.chords.length > 0) {
          resultLines.push(reconstructRowFromChords(b.chords));
        }
        if (b.lyric || b.chords.length === 0) {
          resultLines.push(b.lyric || '');
        }
      }
    }

    if (onChange) {
      onChange(resultLines.join('\n'));
    }
  };

  const handleOpenEditChord = (blockIdx, chordIdx, chordObj, maxLen) => {
    setActiveEdit({
      blockIdx,
      chordIdx,
      chordName: chordObj.chord,
      position: chordObj.position,
      maxLen: Math.max(maxLen, 30),
    });
    setChordInput(chordObj.chord);
  };

  const handleSaveChordEdit = () => {
    if (!activeEdit) return;
    const { blockIdx, chordIdx, position } = activeEdit;
    const block = parsedBlocks[blockIdx];
    const currentChords = [...block.chords];

    const trimmedChord = chordInput.trim() || 'C';
    currentChords[chordIdx] = {
      chord: trimmedChord,
      position: Math.max(0, position),
    };

    updateBlockChords(blockIdx, currentChords);
    setActiveEdit(null);
  };

  const handleDeleteChord = () => {
    if (!activeEdit) return;
    const { blockIdx, chordIdx } = activeEdit;
    const block = parsedBlocks[blockIdx];
    const currentChords = block.chords.filter((_, idx) => idx !== chordIdx);
    updateBlockChords(blockIdx, currentChords);
    setActiveEdit(null);
  };

  const handleShiftPosition = (delta) => {
    if (!activeEdit) return;
    const newPos = Math.max(0, Math.min(activeEdit.position + delta, activeEdit.maxLen));
    setActiveEdit((prev) => ({ ...prev, position: newPos }));
  };

  const handleAddChordAt = (blockIdx, charIndex) => {
    const block = parsedBlocks[blockIdx];
    const currentChords = [...block.chords];
    const newChordObj = { chord: 'G', position: Math.max(0, charIndex) };
    const newChords = [...currentChords, newChordObj].sort((a, b) => a.position - b.position);
    const newChordIdx = newChords.findIndex((c) => c === newChordObj);

    updateBlockChords(blockIdx, newChords);

    // Open edit dialog immediately for the newly added chord
    handleOpenEditChord(blockIdx, newChordIdx, newChordObj, block.lyric?.length || 30);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        💡 Click any <strong>chord badge</strong> to edit its name, shift its position, or delete it. Click any character along a lyric line to insert a chord at that position.
      </Typography>

      <Paper
        variant="outlined"
        sx={{
          p: 2.5,
          borderRadius: 2.5,
          bgcolor: 'background.default',
          maxHeight: 480,
          overflowY: 'auto',
          overflowX: 'auto',
        }}
      >
        {parsedBlocks.map((block, bIdx) => {
          if (block.type === 'empty') {
            return <Box key={`block-${bIdx}`} sx={{ height: 16 }} />;
          }

          if (block.type === 'section') {
            return (
              <Box
                key={`block-${bIdx}`}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  mt: 2,
                  mb: 1.5,
                  pb: 0.5,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <MusicNoteIcon color="primary" sx={{ fontSize: 18 }} />
                <Typography variant="subtitle2" fontWeight={700} color="primary.main">
                  {block.name}
                </Typography>
              </Box>
            );
          }

          if (block.type === 'pair') {
            const lyricStr = block.lyric || '';
            const maxLen = Math.max(lyricStr.length, 30);

            return (
              <Box
                key={`block-${bIdx}`}
                sx={{
                  mb: 2,
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  '&:hover': { borderColor: 'primary.light' },
                }}
              >
                {/* Chord Placement Row */}
                <Box
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 1,
                    mb: 1,
                    minHeight: 28,
                  }}
                >
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mr: 1 }}>
                    Chords:
                  </Typography>

                  {block.chords.length === 0 ? (
                    <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                      No chords on this line.
                    </Typography>
                  ) : (
                    block.chords.map((c, cIdx) => (
                      <Chip
                        key={`c-${cIdx}`}
                        label={`${c.chord} (pos: ${c.position})`}
                        size="small"
                        color="primary"
                        onClick={() => handleOpenEditChord(bIdx, cIdx, c, maxLen)}
                        onDelete={() => {
                          const updated = block.chords.filter((_, idx) => idx !== cIdx);
                          updateBlockChords(bIdx, updated);
                        }}
                        sx={{
                          fontWeight: 700,
                          cursor: 'pointer',
                          '&:hover': { transform: 'scale(1.03)' },
                          transition: 'transform 0.1s',
                        }}
                      />
                    ))
                  )}

                  <Tooltip title="Add chord at end of line">
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => handleAddChordAt(bIdx, lyricStr.length)}
                      sx={{ p: 0.5 }}
                    >
                      <AddIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
                </Box>

                {/* Monospace Interactive Lyric Line */}
                <Box
                  sx={{
                    fontFamily: '"SFMono-Regular", Consolas, Menlo, monospace',
                    fontSize: '0.92rem',
                    lineHeight: 1.8,
                    display: 'flex',
                    flexWrap: 'wrap',
                    userSelect: 'none',
                  }}
                >
                  {lyricStr ? (
                    lyricStr.split('').map((char, charIdx) => (
                      <Box
                        key={`char-${charIdx}`}
                        component="span"
                        onClick={() => handleAddChordAt(bIdx, charIdx)}
                        title={`Click to anchor chord above "${char === ' ' ? 'space' : char}" (pos ${charIdx})`}
                        sx={{
                          cursor: 'pointer',
                          display: 'inline-block',
                          px: '1px',
                          borderRadius: '2px',
                          '&:hover': {
                            bgcolor: 'primary.light',
                            color: '#ffffff',
                          },
                        }}
                      >
                        {char === ' ' ? '\u00A0' : char}
                      </Box>
                    ))
                  ) : (
                    <Typography
                      variant="caption"
                      color="text.disabled"
                      onClick={() => handleAddChordAt(bIdx, 0)}
                      sx={{ cursor: 'pointer', fontStyle: 'italic' }}
                    >
                      (Instrumental / Chord-only line. Click to add chord)
                    </Typography>
                  )}
                </Box>
              </Box>
            );
          }

          return null;
        })}
      </Paper>

      {/* Edit Single Chord Popover Dialog */}
      <Dialog
        open={Boolean(activeEdit)}
        onClose={() => setActiveEdit(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle1" fontWeight={700}>
            Edit Chord
          </Typography>
          <IconButton onClick={() => setActiveEdit(null)} size="small">
            <DeleteIcon sx={{ display: 'none' }} />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 1 }}>
          <TextField
            fullWidth
            label="Chord Name"
            value={chordInput}
            onChange={(e) => setChordInput(e.target.value)}
            autoFocus
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />

          {/* Quick Chord Selection Buttons */}
          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 1, display: 'block' }}>
            Quick Chords:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2.5 }}>
            {COMMON_CHORDS.map((qc) => (
              <Chip
                key={qc}
                label={qc}
                size="small"
                onClick={() => setChordInput(qc)}
                clickable
                variant={chordInput === qc ? 'filled' : 'outlined'}
                color={chordInput === qc ? 'primary' : 'default'}
              />
            ))}
          </Box>

          {/* Position Nudge Controls */}
          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 1, display: 'block' }}>
            Anchor Position: <strong>{activeEdit?.position || 0}</strong>
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              variant="outlined"
              size="small"
              startIcon={<ArrowLeftIcon />}
              onClick={() => handleShiftPosition(-1)}
              disabled={activeEdit?.position <= 0}
              sx={{ borderRadius: 1.5, textTransform: 'none' }}
            >
              Nudge Left
            </Button>
            <Button
              variant="outlined"
              size="small"
              endIcon={<ArrowRightIcon />}
              onClick={() => handleShiftPosition(1)}
              sx={{ borderRadius: 1.5, textTransform: 'none' }}
            >
              Nudge Right
            </Button>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
          <Button
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleDeleteChord}
            sx={{ textTransform: 'none' }}
          >
            Delete
          </Button>

          <Stack direction="row" spacing={1}>
            <Button onClick={() => setActiveEdit(null)} sx={{ textTransform: 'none' }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSaveChordEdit}
              sx={{ borderRadius: 2, textTransform: 'none', px: 2.5 }}
            >
              Apply
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
