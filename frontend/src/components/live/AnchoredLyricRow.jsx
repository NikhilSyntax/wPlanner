import React from 'react';
import { Box, Typography } from '@mui/material';

/**
 * Builds segments from a line's text and anchored chord positions.
 * Each segment has a chord (optional) and the text that follows until the next chord.
 */
function buildLineSegments(text = '', chords = []) {
  if (!Array.isArray(chords) || chords.length === 0) {
    return [{ chord: null, text: text || '' }];
  }

  // Sort chords by ascending character position
  const sortedChords = [...chords].sort((a, b) => a.position - b.position);
  const segments = [];

  let currentIndex = 0;

  // If there is text before the first chord
  if (sortedChords[0].position > 0) {
    segments.push({
      chord: null,
      text: text.substring(0, Math.min(sortedChords[0].position, text.length)),
    });
    currentIndex = sortedChords[0].position;
  }

  for (let i = 0; i < sortedChords.length; i++) {
    const currentChord = sortedChords[i];
    const nextChord = sortedChords[i + 1];
    const nextPos = nextChord ? nextChord.position : text.length;

    const startPos = Math.min(currentChord.position, text.length);
    const endPos = Math.min(nextPos, text.length);

    const segmentText = text.substring(startPos, endPos);

    segments.push({
      chord: currentChord.chord,
      text: segmentText,
    });

    currentIndex = endPos;
  }

  // Any remaining text after the last chord
  if (currentIndex < text.length) {
    segments.push({
      chord: null,
      text: text.substring(currentIndex),
    });
  }

  return segments;
}

/**
 * AnchoredLyricRow - Renders a single lyric line with chords structurally anchored
 * directly to their exact character position.
 */
export default function AnchoredLyricRow({
  line = { text: '', chords: [] },
  showChords = true,
  fontSize = '2.4rem',
  chordColor = '#38bdf8',
  textColor = '#ffffff',
  align = 'left',
  isPureChordsOnly = false,
}) {
  const rawText = line?.text || '';
  const chords = line?.chords || [];
  const segments = buildLineSegments(rawText, chords);

  // If there is no lyric text at all (e.g. [Intro] or Instrumental chords)
  if (!rawText.trim() && chords.length > 0) {
    if (!showChords) return null;
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
          flexWrap: 'wrap',
          gap: { xs: 2, sm: 3, md: 4 },
          my: 1.5,
          width: '100%',
        }}
      >
        {chords.map((c, idx) => (
          <Typography
            key={idx}
            component="span"
            sx={{
              fontFamily: '"Outfit", "Inter", -apple-system, sans-serif',
              fontWeight: 800,
              fontSize: `calc(${fontSize} * 0.9)`,
              color: chordColor,
              letterSpacing: '0.05em',
            }}
          >
            {c.chord}
          </Typography>
        ))}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
        flexWrap: 'wrap',
        textAlign: align,
        lineHeight: 1.2,
        my: { xs: 1, sm: 1.5 },
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        width: '100%',
      }}
    >
      {segments.map((seg, idx) => {
        const hasChord = Boolean(seg.chord) && showChords && !isPureChordsOnly;

        return (
          <Box
            key={idx}
            component="span"
            sx={{
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              verticalAlign: 'bottom',
              mx: 0,
            }}
          >
            {/* Chord Header positioned directly over starting character (Enlarged) */}
            {showChords && (
              <Box
                component="span"
                sx={{
                  fontFamily: '"Outfit", "Inter", -apple-system, sans-serif',
                  fontWeight: 900,
                  fontSize: `calc(${fontSize} * 0.75)`,
                  color: chordColor,
                  minHeight: '1.25em',
                  lineHeight: 1.1,
                  letterSpacing: '0.04em',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                  pr: 0.5,
                  textShadow: '0 1px 4px rgba(0,0,0,0.5)',
                }}
              >
                {hasChord ? seg.chord : '\u00A0'}
              </Box>
            )}

            {/* Lyric Text Characters */}
            <Typography
              component="span"
              sx={{
                fontFamily: '"Outfit", "Inter", -apple-system, sans-serif',
                fontWeight: 600,
                fontSize,
                color: textColor,
                lineHeight: 1.15,
                letterSpacing: '-0.01em',
                whiteSpace: 'pre',
              }}
            >
              {seg.text || (hasChord ? '\u00A0\u00A0' : '')}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
