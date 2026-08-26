import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useLayoutEffect,
} from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { isEventLocked, EVENT_LOCKED_MESSAGE } from '../utils/eventLock';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  Check as CheckIcon,
  ChevronRight as ChevronRightIcon,
  PersonRemove as PersonRemoveIcon,
  Chat as ChatIcon,
} from '@mui/icons-material';
import LoadingSpinner from '../components/common/LoadingSpinner';
import api from '../services/api';
import { fetchEvents } from '../store/slices/eventSlice';

function EventTeamBuild() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  const [eventTitle, setEventTitle] = useState('');
  const [eventData, setEventData] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [churchMembers, setChurchMembers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setPageError('');
        setPageLoading(true);
        const [evRes, memRes] = await Promise.all([
          api.get(`/events/${id}`),
          api.get('/church/members'),
        ]);
        if (cancelled) return;
        setEventData(evRes.data);
        setEventTitle(evRes.data?.event?.title || 'Event');
        setChurchMembers(memRes.data || []);
        // Initialize selected team members from event assignments if present
        const assignments =
          evRes.data?.assignments ||
          evRes.data?.schedule?.assignments ||
          evRes.data?.team?.assignments ||
          evRes.data?.assignments;
        if (assignments && Array.isArray(assignments)) {
          setSelected(
            assignments.map((a) => {
              const user = a.userId || a.user || a.member || {};
              const idVal =
                user?._id?.toString?.() || String(user) || String(a.userId);
              return {
                _id: idVal,
                name: user?.name || user?.email || a.name || 'Unknown',
                role: a.role || 'Member',
              };
            })
          );
        }
      } catch (err) {
        if (!cancelled) {
          setPageError(
            err?.response?.data?.message ||
              'Could not load this event or roster'
          );
        }
      } finally {
        if (!cancelled) setPageLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Layout helpers for the selected list container
  const listItemHeight = 56; // px approximate per ListItem
  const headerAreaHeight = 72; // header + caption area height approximation
  const maxVisibleItems = 4;
  const selectedCount = selected.length;
  const shouldScrollSelected = selectedCount > maxVisibleItems;
  const computedListHeight =
    selectedCount > 0 ? selectedCount * listItemHeight : listItemHeight * 2;

  // refs and measured heights for dynamic sizing
  const rosterHeaderRef = useRef(null);
  const rosterFirstItemRef = useRef(null);
  const selectedHeaderRef = useRef(null);
  const selectedFirstItemRef = useRef(null);

  const [rosterHeight, setRosterHeight] = useState(null);
  const [rosterIsScrollable, setRosterIsScrollable] = useState(false);
  const [selectedHeight, setSelectedHeight] = useState(null);
  const [selectedIsScrollable, setSelectedIsScrollable] = useState(false);

  const rosterAvailable = useMemo(() => {
    const approved = churchMembers.filter(
      (m) => !m.approvalStatus || m.approvalStatus === 'approved'
    );
    const selectedIds = new Set(selected.map((s) => s._id));
    return approved.filter((m) => {
      const mid = m._id?.toString?.() || String(m._id);
      return !selectedIds.has(mid);
    });
  }, [churchMembers, selected]);
  // Compute dynamic heights for roster and selected lists (measured in layout effect)
  useLayoutEffect(() => {
    // fallback sizes
    let headerH = headerAreaHeight;
    let itemH = listItemHeight;
    if (rosterHeaderRef.current && rosterHeaderRef.current.offsetHeight) {
      headerH = rosterHeaderRef.current.offsetHeight;
    }
    if (rosterFirstItemRef.current && rosterFirstItemRef.current.offsetHeight) {
      itemH = rosterFirstItemRef.current.offsetHeight;
    }

    const rosterCount = rosterAvailable.length;
    const rosterVisibleCount = rosterCount > 0 ? rosterCount : 2;
    const desiredRosterHeight = headerH + rosterVisibleCount * itemH;

    // cap to 60vh or 560px whichever is smaller to avoid growing off-screen
    const capPx = Math.min(window.innerHeight * 0.6, 560);
    if (desiredRosterHeight > capPx) {
      setRosterHeight(`${capPx}px`);
      setRosterIsScrollable(true);
    } else {
      setRosterHeight(`${desiredRosterHeight}px`);
      setRosterIsScrollable(false);
    }

    // selected
    headerH = headerAreaHeight;
    itemH = listItemHeight;
    if (selectedHeaderRef.current && selectedHeaderRef.current.offsetHeight) {
      headerH = selectedHeaderRef.current.offsetHeight;
    }
    if (
      selectedFirstItemRef.current &&
      selectedFirstItemRef.current.offsetHeight
    ) {
      itemH = selectedFirstItemRef.current.offsetHeight;
    }
    const selectedVisibleCount = selected.length > 0 ? selected.length : 2;
    const desiredSelectedHeight = headerH + selectedVisibleCount * itemH;
    if (desiredSelectedHeight > capPx) {
      setSelectedHeight(`${capPx}px`);
      setSelectedIsScrollable(true);
    } else {
      setSelectedHeight(`${desiredSelectedHeight}px`);
      setSelectedIsScrollable(false);
    }
  }, [rosterAvailable.length, selected.length]);

  const addMember = (m) => {
    const mid = m._id?.toString?.() || String(m._id);
    setSelected((prev) => [
      ...prev,
      {
        _id: mid,
        name: m.name || 'Unknown',
        role: m.role || 'Member',
      },
    ]);
  };

  const removeMember = (memberId) => {
    setSelected((prev) => prev.filter((p) => p._id !== memberId));
  };

  const handleConfirm = async () => {
    if (isEventLocked(eventData, user)) return;
    try {
      setSaveError('');
      setSaving(true);
      const members = selected.map((s) => ({
        userId: s._id,
        role: s.role,
      }));
      await api.post(`/events/${id}/event-team`, { members });
      await dispatch(fetchEvents());
      navigate(`/events/${id}`, { replace: true });
    } catch (err) {
      setSaveError(
        err?.response?.data?.message || 'Could not save the event team'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    navigate(`/events/${id}`, { replace: true });
  };

  if (pageLoading) return <LoadingSpinner size={48} />;

  if (pageError) {
    return (
      <Box sx={{ p: 2, maxWidth: 560, mx: 'auto' }}>
        <Alert severity="error">{pageError}</Alert>
        <Button sx={{ mt: 2 }} component={RouterLink} to="/events">
          Back to events
        </Button>
      </Box>
    );
  }

  const isLocked = isEventLocked(eventData, user);
  const canEdit = !isLocked;

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', p: { xs: 2, sm: 3 } }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <IconButton
          component={RouterLink}
          to={`/events/${id}/edit`}
          size="small"
          aria-label="Back to edit event"
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="body2" color="text.secondary">
          <RouterLink to={`/events/${id}/edit`} style={{ color: 'inherit' }}>
            Edit event details
          </RouterLink>
        </Typography>
      </Stack>

      <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2} mb={0.5}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 800, mb: 0.5 }}>
            {canEdit ? 'Build event team' : 'Event team'}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            {canEdit
              ? `${eventTitle} — pick people from the church roster (left). They appear on the event team (right). Confirm when you are ready.`
              : `${eventTitle} — team roster for this completed event.`}
          </Typography>
        </Box>

        <Button
          variant="outlined"
          color="primary"
          startIcon={<ChatIcon />}
          onClick={() => navigate(`/events/${id}/chat`)}
          sx={{ borderRadius: 2, textTransform: 'none', px: 2, py: 0.8, fontWeight: 700 }}
        >
          Roster Chat
        </Button>
      </Box>

      {isLocked && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {EVENT_LOCKED_MESSAGE}
        </Alert>
      )}

      {saveError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSaveError('')}>
          {saveError}
        </Alert>
      )}

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={3}
        alignItems="stretch"
      >
        <Card
          sx={{
            flex: 1,
            minHeight: 360,
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <CardContent
            sx={{
              p: 0,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Box
              ref={rosterHeaderRef}
              sx={{ px: 2, py: 1.5, bgcolor: 'action.hover' }}
            >
              <Typography variant="subtitle1" fontWeight={700}>
                Church roster
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Approved members — add to this event
              </Typography>
            </Box>
            <Divider />
            <Box
              sx={{
                flex: 1,
                overflow: rosterIsScrollable ? 'auto' : 'hidden',
                height: { md: rosterHeight || 'auto' },
              }}
            >
              {rosterAvailable.length === 0 ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ p: 2 }}
                >
                  {churchMembers.length === 0
                    ? 'No roster members loaded.'
                    : 'Everyone on the roster is already on the event team.'}
                </Typography>
              ) : (
                <List dense disablePadding>
                  {rosterAvailable.map((m, idx) => {
                    const mid = m._id?.toString?.() || String(m._id);
                    return (
                      <ListItem
                        key={mid}
                        ref={idx === 0 ? rosterFirstItemRef : null}
                        secondaryAction={
                          canEdit ? (
                            <IconButton
                              edge="end"
                              aria-label={`Add ${m.name}`}
                              onClick={() => addMember(m)}
                              color="primary"
                            >
                              <AddIcon />
                            </IconButton>
                          ) : null
                        }
                        sx={{
                          pr: 7,
                          borderBottom: '1px solid',
                          borderColor: 'divider',
                        }}
                      >
                        <ListItemText
                          primary={m.name || 'Unknown'}
                          secondary={m.role || 'Member'}
                          primaryTypographyProps={{ fontWeight: 600 }}
                        />
                      </ListItem>
                    );
                  })}
                </List>
              )}
            </Box>
          </CardContent>
        </Card>

        <Box
          sx={{
            display: { xs: 'none', md: 'flex' },
            alignItems: 'center',
            justifyContent: 'center',
            color: 'text.disabled',
          }}
        >
          <ChevronRightIcon fontSize="large" />
        </Box>

        <Card
          sx={{
            flex: 1,
            minHeight: 360,
            borderRadius: 3,
            border: '2px solid',
            borderColor: 'primary.main',
            boxShadow: (theme) =>
              theme.palette.mode === 'light'
                ? '0 0 0 1px rgba(99, 102, 241, 0.25)'
                : undefined,
          }}
        >
          <CardContent
            sx={{
              p: 0,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Box
              ref={selectedHeaderRef}
              sx={{
                px: 2,
                py: 1.5,
                background: (theme) =>
                  theme.palette.mode === 'light'
                    ? 'linear-gradient(90deg, rgba(99,102,241,0.12), transparent)'
                    : 'action.selected',
              }}
            >
              <Typography variant="subtitle1" fontWeight={700} color="primary">
                Event team
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {selected.length} person{selected.length === 1 ? '' : 's'}{' '}
                selected
              </Typography>
            </Box>
            <Divider />
            <Box
              sx={{
                flex: 1,
                overflow: selectedIsScrollable ? 'auto' : 'hidden',
                height: { md: selectedHeight || 'auto' },
              }}
            >
              {selected.length === 0 ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ p: 2 }}
                >
                  Use + on the left to add people. This list is who you are
                  assigning to this event.
                </Typography>
              ) : (
                <List dense disablePadding>
                  {selected.map((s, idx) => (
                    <ListItem
                      key={s._id}
                      ref={idx === 0 ? selectedFirstItemRef : null}
                      secondaryAction={
                        canEdit ? (
                          <IconButton
                            edge="end"
                            aria-label={`Remove ${s.name}`}
                            onClick={() => removeMember(s._id)}
                            color="error"
                          >
                            <PersonRemoveIcon />
                          </IconButton>
                        ) : null
                      }
                      sx={{
                        pr: 7,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <ListItemText
                        primary={s.name}
                        secondary={`Role: ${s.role}`}
                        primaryTypographyProps={{ fontWeight: 600 }}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          </CardContent>
        </Card>
      </Stack>

      <Card sx={{ borderRadius: 3, mt: 3 }}>
        <CardContent
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 2,
            justifyContent: 'flex-end',
            alignItems: { xs: 'stretch', sm: 'center' },
          }}
        >
          <Button
            variant="text"
            onClick={handleSkip}
            disabled={saving}
            sx={{ textTransform: 'none', order: { xs: 3, sm: 0 } }}
          >
            Skip for now
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button
            variant="outlined"
            component={RouterLink}
            to="/events"
            disabled={saving}
            sx={{ textTransform: 'none' }}
          >
            Events list
          </Button>
          {canEdit && (
            <Button
              variant="contained"
              startIcon={<CheckIcon />}
              onClick={handleConfirm}
              disabled={saving}
              sx={{ textTransform: 'none', minWidth: 200 }}
            >
              {saving ? 'Saving…' : 'Confirm event team'}
            </Button>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

export default EventTeamBuild;
