import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  NavigateNext as NextIcon,
  NavigateBefore as PrevIcon,
  MusicNote as MusicIcon,
} from '@mui/icons-material';
import api from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import './EventSetlistSongView.css';

function EventSetlistSongView() {
  // ----- UI state -----
  const { id, songId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [setlist, setSetlist] = useState([]);
  const [song, setSong] = useState(null);
  const view = searchParams.get('view') === 'chords' ? 'chords' : 'lyrics';

  // ----- Feature state -----
  const [highlightChords, setHighlightChords] = useState(false);
  const [transpose, setTranspose] = useState(0);

  // ----- Helper: transpose a single chord -----
  const transposeChord = (chord, semitones) => {
    const SHARPS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    const FLATS  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
    const NOTE_MAP = { ...SHARPS.reduce((a,n,i)=>({...a,[n]:i}),{}), ...FLATS.reduce((a,n,i)=>({...a,[n]:i}),{}) };
    // split slash chord
    const [rootPart, bassPart] = chord.split('/');
    const match = rootPart.match(/^([A-G])([#b]?)(.*)$/);
    if (!match) return chord; // not a chord we recognize
    let [, base, accidental, suffix] = match;
    let idx = NOTE_MAP[base + accidental];
    if (idx === undefined) return chord;
    idx = (idx + semitones) % 12;
    if (idx < 0) idx += 12;
    const newRoot = SHARPS[idx];
    const newChord = newRoot + suffix + (bassPart ? `/${bassPart}` : '');
    return newChord;
  };

  // ----- Transpose / highlight processing -----
  const formattedChords = useMemo(() => {
    if (!song?.content?.chords) return '';
    const raw = song.content.chords;
    const chordRegex = /([A-G][#b]?(?:m|dim|aug|maj7|7|sus2|sus4|add9)?(?:\/[A-G][#b]?)?)/g;
    let processed = raw.replace(chordRegex, (match) => {
      if (transpose !== 0) return transposeChord(match, transpose);
      return match;
    });
    if (highlightChords) {
      processed = processed.replace(chordRegex, (match) => `<span class="chord">${match}</span>`);
    }
    return processed;
  }, [song?.content?.chords, transpose, highlightChords]);

  // ----- Transpose UI handler -----
  const handleTranspose = (step) => setTranspose((t) => {
    const newVal = t + step;
    if (newVal > 11 || newVal < -11) return 0;
    return newVal;
  });

  // ----- Data fetching (unchanged) -----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const eventRes = await api.get(`/events/${id}`);
        if (cancelled) return;
        const eventDoc = eventRes.data || {};
        const list = Array.isArray(eventDoc.setlist) ? eventDoc.setlist : [];
        setEventTitle(eventDoc?.event?.title || 'Event');
        setSetlist(list);
        const fromEvent = list.find((s) => String(s?._id) === String(songId));
        if (fromEvent && (fromEvent?.content?.lyrics || fromEvent?.content?.chords)) {
          setSong(fromEvent);
        } else {
          const songRes = await api.get(`/songs/${songId}`);
          if (!cancelled) setSong(songRes.data || null);
        }
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.message || 'Failed to load lyrics and chords');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, songId]);

  useEffect(() => {
    setTranspose(0);
    setHighlightChords(false);
  }, [songId]);

  const currentIndex = useMemo(
    () => setlist.findIndex((s) => String(s?._id) === String(songId)),
    [setlist, songId]
  );
  const nextSong = currentIndex >= 0 ? setlist[currentIndex + 1] : null;
  const prevSong = currentIndex > 0 ? setlist[currentIndex - 1] : null;

  const goNextSong = () => {
    if (!nextSong?._id) return;
    navigate(`/events/${id}/setlist/${nextSong._id}?view=${view}`);
  };

  const goPrevSong = () => {
    if (!prevSong?._id) return;
    navigate(`/events/${id}/setlist/${prevSong._id}?view=${view}`);
  };

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <Box sx={{ p: 2, maxWidth: 700, mx: 'auto' }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1000, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <IconButton onClick={() => navigate(`/events/${id}`)} aria-label="Back to event">
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Lyrics & Chords
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {eventTitle}
          </Typography>
        </Box>
      </Stack>

      <Card sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
            gap={1.5}
            sx={{ mb: 2 }}
          >
            <Stack direction="row" alignItems="center" gap={1}>
              <MusicIcon color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {song?.title || 'Song'}
              </Typography>
              {song?.key && <Chip size="small" label={`Key: ${song.key}`} color="primary" variant="outlined" />}
            </Stack>
            <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  startIcon={<PrevIcon />}
                  onClick={goPrevSong}
                  disabled={!prevSong}
                  sx={{ textTransform: 'none' }}
                >
                  {prevSong ? 'Prev Song' : 'No Prev Song'}
                </Button>
                <Button
                  variant="contained"
                  endIcon={<NextIcon />}
                  onClick={goNextSong}
                  disabled={!nextSong}
                  sx={{ textTransform: 'none' }}
                >
                  {nextSong ? 'Next Song' : 'No Next Song'}
                </Button>
              </Stack>
          </Stack>

          <Divider sx={{ mb: 2 }} />

          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <Button
              size="small"
              variant={view === 'lyrics' ? 'contained' : 'outlined'}
              onClick={() => setSearchParams({ view: 'lyrics' })}
              sx={{ textTransform: 'none' }}
            >
              Lyrics
            </Button>
            <Button
              size="small"
              variant={view === 'chords' ? 'contained' : 'outlined'}
              onClick={() => setSearchParams({ view: 'chords' })}
              sx={{ textTransform: 'none' }}
            >
              Chords
            </Button>
          </Stack>

          {view === 'lyrics' && (
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                Lyrics
              </Typography>
              <Card variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent sx={{ p: 2.5 }}>
                  {song?.content?.lyrics?.trim() ? (
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                      {song.content.lyrics}
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No Lyrics
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Box>
          )}

          {view === 'chords' && (
            <Box>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap">
                <Button
                  variant="outlined"
                  onClick={() => setHighlightChords((prev) => !prev)}
                  sx={{ textTransform: 'none' }}
                >
                  {highlightChords ? '✖ Highlight' : '🔍 Highlight'}
                </Button>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Button variant="text" onClick={() => handleTranspose(-1)}>
                    -
                  </Button>
                  <Chip
                    label={transpose >= 0 ? `+${transpose}` : `${transpose}`}
                    size="small"
                  />
                  <Button variant="text" onClick={() => handleTranspose(1)}>
                    +
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={transpose === 0}
                    onClick={() => setTranspose(0)}
                    sx={{ textTransform: 'none' }}
                  >
                    Undo
                  </Button>
                </Stack>
              </Stack>

              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                Chords
              </Typography>
              <Card variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent sx={{ p: 2.5, backgroundColor: '#f5f5f5' }}>
                  {song?.content?.chords?.trim() ? (
                    <Typography
                      variant="body1"
                      component="div"
                      sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}
                      dangerouslySetInnerHTML={{ __html: formattedChords }}
                    />
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No chords yet, Contact Admin
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

export default EventSetlistSongView;

