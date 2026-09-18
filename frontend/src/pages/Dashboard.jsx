import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Avatar,
  Chip,
  IconButton,
  Divider,
  Paper,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import { Link, useNavigate } from 'react-router-dom';
import {
  Add as AddIcon,
  Schedule as ScheduleIcon,
  MusicNote as MusicNoteIcon,
  Group as GroupIcon,
  Event as EventIcon,
  ArrowForward as ArrowForwardIcon,
  PlayArrow as PlayArrowIcon,
  CheckCircle as CheckCircleIcon,
  AccessTime as AccessTimeIcon,
  QueueMusic as QueueMusicIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Cancel as CancelIcon,
  AssignmentInd as AssignmentIndIcon,
  VolunteerActivism as VolunteerActivismIcon,
  Chat as ChatIcon,
} from '@mui/icons-material';
import { fetchEvents } from '../store/slices/eventSlice';
import { addNotification } from '../store/slices/uiSlice';
import { resolveMediaUrl } from '../utils/mediaUrl';
import LoadingSpinner from '../components/common/LoadingSpinner';
import api from '../services/api';

function Dashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { events, loading } = useSelector((state) => state.events);
  const { user } = useSelector((state) => state.auth);

  const [songsCount, setSongsCount] = useState(0);
  const [membersCount, setMembersCount] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);
  const [respondingSpotlight, setRespondingSpotlight] = useState(false);

  const handleSpotlightAssignmentRespond = async (eventId, actionOrStatus) => {
    try {
      setRespondingSpotlight(true);
      const targetStatus =
        actionOrStatus === 'accept' || actionOrStatus === 'accepted'
          ? 'accepted'
          : 'declined';
      await api.post(`/events/${eventId}/assignments/respond`, {
        status: targetStatus,
      });

      // Synchronize NotificationBell in real-time
      window.dispatchEvent(
        new CustomEvent('wplanner:assignment_updated', {
          detail: {
            eventId,
            status: targetStatus,
          },
        })
      );

      await dispatch(fetchEvents());
      dispatch(
        addNotification({
          type: targetStatus === 'accepted' ? 'success' : 'info',
          message:
            targetStatus === 'accepted'
              ? 'You accepted your assignment for this service! 🎉'
              : 'You declined this assignment.',
        })
      );
    } catch (err) {
      console.error('[Dashboard] Error responding to assignment:', err);
      dispatch(
        addNotification({
          type: 'error',
          message:
            err?.response?.data?.message || 'Failed to update assignment response',
        })
      );
    } finally {
      setRespondingSpotlight(false);
    }
  };

  const handleSpotlightSetlistClick = () => {
    if (!nextUpcomingEvent?._id) return;
    const firstSong = nextUpcomingEvent?.setlist?.[0];
    const firstSongId =
      firstSong?._id ||
      (typeof firstSong === 'string' ? firstSong : firstSong?.song?._id || firstSong?.song);

    if (firstSongId) {
      let savedMode = 'chords';
      try {
        savedMode = localStorage.getItem('wplanner_setlist_view_mode') || 'chords';
      } catch (e) {}
      navigate(`/events/${nextUpcomingEvent._id}/setlist/${firstSongId}?view=${savedMode}`);
    } else {
      navigate(`/events/${nextUpcomingEvent._id}`);
    }
  };

  useEffect(() => {
    dispatch(fetchEvents());

    const handleAssignmentUpdate = () => {
      dispatch(fetchEvents());
    };

    window.addEventListener('wplanner:assignment_updated', handleAssignmentUpdate);

    // Fetch live counts for songs and church members
    Promise.all([
      api.get('/songs').catch(() => ({ data: [] })),
      api.get('/church/members').catch(() => ({ data: { members: [] } })),
    ]).then(([songsRes, membersRes]) => {
      const s = Array.isArray(songsRes.data) ? songsRes.data : songsRes.data?.songs || [];
      const m = Array.isArray(membersRes.data) ? membersRes.data : membersRes.data?.members || [];
      setSongsCount(s.length);
      setMembersCount(m.length);
      setStatsLoading(false);
    });

    return () => {
      window.removeEventListener('wplanner:assignment_updated', handleAssignmentUpdate);
    };
  }, [dispatch]);

  if (loading && statsLoading) return <LoadingSpinner />;

  const now = new Date();
  const upcomingEvents = [...events]
    .filter((event) => {
      const status = (event.event?.status || event.status || 'draft').toLowerCase();
      // Must be CONFIRMED ('published' or 'confirmed'), NEVER 'completed', 'draft', or 'cancelled'
      const isConfirmed = status === 'published' || status === 'confirmed';
      const isCompleted = status === 'completed';
      const isFutureOrOngoing = new Date(event.schedule?.end || event.schedule?.start) > now;

      return isConfirmed && !isCompleted && isFutureOrOngoing;
    })
    .sort((a, b) => new Date(a.schedule?.start) - new Date(b.schedule?.start));

  const nextUpcomingEvent = upcomingEvents[0];
  const recentEvents = [...events]
    .sort(
      (a, b) =>
        new Date(b.schedule?.start || b.createdAt || 0) -
        new Date(a.schedule?.start || a.createdAt || 0)
    )
    .slice(0, 3);

  // Determine if the currently logged in user is part of the next upcoming event team / roster (admins cannot be team members)
  const isAdmin = Boolean(
    user?.isAdmin ||
    user?.role === 'Admin' ||
    user?.role === 'admin' ||
    user?.roles?.some((r) => String(r).toLowerCase().trim() === 'admin')
  );
  const currentUserId = user?.id || user?._id;
  const userAssignment = !isAdmin
    ? nextUpcomingEvent?.assignments?.find((a) => {
        const aId = a.userId?._id ? String(a.userId._id) : String(a.userId || '');
        return aId && currentUserId && aId === String(currentUserId);
      })
    : null;
  const isOptInPending = !isAdmin && userAssignment?.status === 'opt_in_pending';
  const isUserInTeamMembers =
    !isAdmin &&
    Array.isArray(nextUpcomingEvent?.team?.members) &&
    nextUpcomingEvent.team.members.some((m) => {
      const mId = m.userId?._id ? String(m.userId._id) : String(m.userId || '');
      return mId && currentUserId && mId === String(currentUserId);
    });
  const isUserInTeam = !isAdmin && !isOptInPending && Boolean(userAssignment || isUserInTeamMembers);

  // Time to next event calculation
  let timeUntilNext = 'No upcoming events';
  if (nextUpcomingEvent) {
    const diffMs = new Date(nextUpcomingEvent.schedule.start) - now;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (diffDays > 0) {
      timeUntilNext = `In ${diffDays}d ${diffHours}h`;
    } else if (diffHours > 0) {
      timeUntilNext = `In ${diffHours} hours`;
    } else {
      timeUntilNext = 'Starting soon';
    }
  }

  const todayStr = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const NoirIndexTag = ({ number }) => (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 1.25,
        py: 0.35,
        bgcolor: '#ff4d28',
        color: '#ffffff',
        borderRadius: '8px',
        fontSize: '0.75rem',
        fontWeight: 800,
        letterSpacing: '0.04em',
        boxShadow: '0 2px 10px rgba(255, 77, 40, 0.35)',
      }}
    >
      {number}
    </Box>
  );

  const NoirArrow = () => (
    <Box
      className="noir-arrow"
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
        borderRadius: '50%',
        bgcolor: (th) =>
          th.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
        color: 'text.secondary',
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="7" y1="17" x2="17" y2="7"></line>
        <polyline points="7 7 17 7 17 17"></polyline>
      </svg>
    </Box>
  );

  const noirCardSx = {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    borderRadius: '14px',
    border: '1px solid',
    borderColor: (th) =>
      th.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
    bgcolor: (th) => (th.palette.mode === 'dark' ? '#0e0e0e' : '#ffffff'),
    boxShadow: (th) =>
      th.palette.mode === 'dark'
        ? '0 4px 24px rgba(0, 0, 0, 0.7)'
        : '0 2px 12px rgba(0, 0, 0, 0.06)',
    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
    p: { xs: 2.5, sm: 3 },
    position: 'relative',
    overflow: 'hidden',
    '&:hover': {
      borderColor: 'rgba(255, 77, 40, 0.45)',
      boxShadow: (th) =>
        th.palette.mode === 'dark'
          ? '0 12px 36px rgba(0, 0, 0, 0.9), 0 0 24px rgba(255, 77, 40, 0.12)'
          : '0 8px 24px rgba(0, 0, 0, 0.12)',
      transform: 'translateY(-2px)',
      '& .noir-arrow': {
        transform: 'translate(2px, -2px)',
        color: '#ff4d28',
        bgcolor: 'rgba(255, 77, 40, 0.14)',
        borderColor: 'rgba(255, 77, 40, 0.4)',
      },
    },
  };

  return (
    <Box sx={{ pb: 4 }}>
      {/* Top Header Section */}
      <Box
        sx={{
          mb: 3.5,
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', md: 'flex-end' },
          gap: 2,
        }}
      >
        <Box>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              py: 0.4,
              borderRadius: '9999px',
              border: '1px solid',
              borderColor: (th) =>
                th.palette.mode === 'dark'
                  ? 'rgba(255, 77, 40, 0.3)'
                  : 'rgba(255, 77, 40, 0.25)',
              bgcolor: (th) =>
                th.palette.mode === 'dark'
                  ? 'rgba(255, 77, 40, 0.08)'
                  : 'rgba(255, 77, 40, 0.06)',
              mb: 1.2,
            }}
          >
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                bgcolor: '#ff4d28',
                boxShadow: '0 0 8px #ff4d28',
              }}
            />
            <Typography
              variant="caption"
              sx={{
                fontWeight: 800,
                letterSpacing: '0.06em',
                color: '#ff4d28',
                fontSize: '0.72rem',
              }}
            >
              Currently Serving the King of Kings
            </Typography>
          </Box>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.5, mb: 0.5, fontSize: '0.875rem' }}
          >
            Welcome back,
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Typography
              variant="h4"
              fontWeight={800}
              sx={{
                letterSpacing: '-0.02em',
                fontSize: { xs: '1.5rem', sm: '1.875rem' },
              }}
            >
              {user?.name || 'User'}
            </Typography>
            <Chip
              label={
                user?.isAdmin ? 'Admin' : user?.isSubAdmin ? 'Sub-Admin' : user?.role || 'Member'
              }
              size="small"
              sx={{
                fontWeight: 700,
                fontSize: '0.6875rem',
                height: 22,
                borderRadius: '6px',
                bgcolor: (th) =>
                  th.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                color: 'text.primary',
                border: '1px solid',
                borderColor: 'divider',
              }}
            />
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Chip
            icon={<AccessTimeIcon sx={{ fontSize: '13px !important' }} />}
            label={todayStr}
            variant="outlined"
            sx={{
              fontWeight: 600,
              fontSize: '0.75rem',
              height: 32,
              borderRadius: '8px',
              bgcolor: (th) => (th.palette.mode === 'dark' ? '#0e0e0e' : '#ffffff'),
              borderColor: 'divider',
            }}
          />
          <Button
            variant="contained"
            size="medium"
            startIcon={<AddIcon sx={{ fontSize: 18 }} />}
            onClick={() => navigate('/events/new')}
            sx={{
              borderRadius: '8px',
              px: 2.2,
              py: 0.8,
              fontWeight: 700,
              fontSize: '0.8125rem',
              textTransform: 'none',
              letterSpacing: '0.01em',
            }}
          >
            New Event
          </Button>
        </Box>
      </Box>

      {/* Upcoming Service Spotlight */}
      <Box sx={{ mb: 4 }}>
        <Card elevation={0} sx={noirCardSx}>
          <Box>
            {/* Header: Badge + Title + Action */}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2.5,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <Chip
                  label="NEXT SERVICE"
                  size="small"
                  sx={{
                    fontWeight: 800,
                    fontSize: '0.6875rem',
                    height: 22,
                    bgcolor: '#ff4d28',
                    color: '#ffffff',
                    borderRadius: '6px',
                    letterSpacing: '0.04em',
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'text.secondary',
                    fontSize: '0.75rem',
                  }}
                >
                  UPCOMING SERVICE SPOTLIGHT
                </Typography>
              </Box>
              {nextUpcomingEvent?._id && (
                <Chip
                  icon={<AccessTimeIcon sx={{ fontSize: '13px !important', color: '#ff4d28 !important' }} />}
                  label={`Starts in ${timeUntilNext}`}
                  size="small"
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    height: 24,
                    bgcolor: (th) =>
                      th.palette.mode === 'dark'
                        ? 'rgba(255, 77, 40, 0.12)'
                        : 'rgba(255, 77, 40, 0.08)',
                    color: '#ff4d28',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 77, 40, 0.25)',
                  }}
                />
              )}
            </Box>

            {nextUpcomingEvent ? (
              <Grid container spacing={3} alignItems="center">
                <Grid item xs={12} md={7}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                    <Typography
                      variant="h5"
                      fontWeight={800}
                      sx={{
                        fontSize: { xs: '1.3rem', sm: '1.5rem' },
                        lineHeight: 1.25,
                      }}
                    >
                      {nextUpcomingEvent.event?.title || 'Untitled Worship Service'}
                    </Typography>
                    <Chip
                      label={nextUpcomingEvent.event?.type || 'Service'}
                      size="small"
                      sx={{
                        textTransform: 'capitalize',
                        fontWeight: 700,
                        fontSize: '0.6875rem',
                        height: 20,
                        bgcolor: (th) =>
                          th.palette.mode === 'dark'
                            ? 'rgba(255, 77, 40, 0.15)'
                            : 'rgba(255, 77, 40, 0.1)',
                        color: '#ff4d28',
                        borderRadius: '4px',
                      }}
                    />
                  </Box>

                  {nextUpcomingEvent.event?.description && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 2, fontSize: '0.8125rem' }}
                    >
                      {nextUpcomingEvent.event?.description}
                    </Typography>
                  )}

                  {/* Key Info Strip */}
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      borderRadius: '10px',
                      mb: isUserInTeam || (!isAdmin && !userAssignment) ? 2 : 0,
                      bgcolor: (th) =>
                        th.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: 'divider',
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 1.5,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ScheduleIcon sx={{ fontSize: 18, color: '#ff4d28' }} />
                      <Box>
                        <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.8125rem', lineHeight: 1.2 }}>
                          {new Date(nextUpcomingEvent.schedule.start).toLocaleDateString(undefined, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                          {' • '}
                          {new Date(nextUpcomingEvent.schedule.start).toLocaleTimeString(undefined, {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                          Scheduled Start Time
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <QueueMusicIcon sx={{ fontSize: 16, color: '#ff4d28' }} />
                        <Typography variant="caption" fontWeight={700}>
                          {nextUpcomingEvent.setlist?.length || 0} Songs
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <GroupIcon sx={{ fontSize: 16, color: '#ff4d28' }} />
                        <Typography variant="caption" fontWeight={700}>
                          {(nextUpcomingEvent.assignments || []).length} Scheduled
                        </Typography>
                      </Box>
                    </Box>
                  </Paper>

                  {/* Assignment RSVP Section */}
                  {isUserInTeam && (
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: '10px',
                        border: '1px solid',
                        borderColor:
                          userAssignment?.status === 'accepted'
                            ? 'rgba(16, 185, 129, 0.35)'
                            : userAssignment?.status === 'declined'
                            ? 'rgba(239, 68, 68, 0.35)'
                            : 'rgba(255, 77, 40, 0.35)',
                        bgcolor: (th) =>
                          userAssignment?.status === 'accepted'
                            ? th.palette.mode === 'dark'
                              ? 'rgba(16, 185, 129, 0.08)'
                              : '#f0fdf4'
                            : userAssignment?.status === 'declined'
                            ? th.palette.mode === 'dark'
                              ? 'rgba(239, 68, 68, 0.08)'
                              : '#fef2f2'
                            : th.palette.mode === 'dark'
                            ? 'rgba(255, 77, 40, 0.08)'
                            : '#fff7f5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1.5,
                        flexWrap: 'wrap',
                      }}
                    >
                      {userAssignment?.status === 'accepted' ? (
                        <>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CheckCircleIcon sx={{ color: '#10b981', fontSize: 18 }} />
                            <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.8125rem' }}>
                              Role Confirmed: <strong>{userAssignment?.role || 'Team Member'}</strong>
                            </Typography>
                          </Box>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            startIcon={<CloseIcon sx={{ fontSize: 12 }} />}
                            onClick={() =>
                              handleSpotlightAssignmentRespond(nextUpcomingEvent._id, 'declined')
                            }
                            disabled={respondingSpotlight}
                            sx={{
                              textTransform: 'none',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              py: 0.3,
                              px: 1.2,
                              borderRadius: '6px',
                            }}
                          >
                            Decline (✕)
                          </Button>
                        </>
                      ) : userAssignment?.status === 'declined' ? (
                        <>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CancelIcon sx={{ color: '#ef4444', fontSize: 18 }} />
                            <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.8125rem' }}>
                              Declined assignment ({userAssignment?.role || 'Team Member'})
                            </Typography>
                          </Box>
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            startIcon={<CheckIcon sx={{ fontSize: 12 }} />}
                            onClick={() =>
                              handleSpotlightAssignmentRespond(nextUpcomingEvent._id, 'accepted')
                            }
                            disabled={respondingSpotlight}
                            sx={{
                              textTransform: 'none',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              py: 0.3,
                              px: 1.4,
                              borderRadius: '6px',
                            }}
                          >
                            Accept (✓)
                          </Button>
                        </>
                      ) : (
                        <>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <AssignmentIndIcon sx={{ color: '#ff4d28', fontSize: 18 }} />
                            <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.8125rem' }}>
                              Scheduled as <strong>{userAssignment?.role || 'Team Member'}</strong>:
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Button
                              variant="contained"
                              color="success"
                              size="small"
                              startIcon={
                                respondingSpotlight ? (
                                  <CircularProgress size={12} color="inherit" />
                                ) : (
                                  <CheckIcon sx={{ fontSize: 13 }} />
                                )
                              }
                              onClick={() =>
                                handleSpotlightAssignmentRespond(nextUpcomingEvent._id, 'accepted')
                              }
                              disabled={respondingSpotlight}
                              sx={{
                                fontWeight: 700,
                                textTransform: 'none',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                py: 0.3,
                                px: 1.4,
                              }}
                            >
                              Accept (✓)
                            </Button>
                            <Button
                              variant="outlined"
                              color="error"
                              size="small"
                              startIcon={<CloseIcon sx={{ fontSize: 13 }} />}
                              onClick={() =>
                                handleSpotlightAssignmentRespond(nextUpcomingEvent._id, 'declined')
                              }
                              disabled={respondingSpotlight}
                              sx={{
                                fontWeight: 700,
                                textTransform: 'none',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                py: 0.3,
                                px: 1.2,
                              }}
                            >
                              Decline (✕)
                            </Button>
                          </Box>
                        </>
                      )}
                    </Box>
                  )}

                  {!isAdmin && !userAssignment && (
                    <Box
                      sx={{
                        p: 1.25,
                        px: 1.5,
                        borderRadius: '10px',
                        bgcolor: (th) =>
                          th.palette.mode === 'dark'
                            ? 'rgba(255, 77, 40, 0.06)'
                            : 'rgba(255, 77, 40, 0.04)',
                        border: '1px solid',
                        borderColor: 'rgba(255, 77, 40, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1.5,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <VolunteerActivismIcon sx={{ fontSize: 16, color: '#ff4d28' }} />
                        <Typography variant="caption" fontWeight={600} color="text.secondary">
                          Available to serve? Volunteer for this worship team.
                        </Typography>
                      </Box>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => navigate(`/events/${nextUpcomingEvent._id}`)}
                        sx={{
                          textTransform: 'none',
                          fontWeight: 700,
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          py: 0.3,
                          px: 1.2,
                          borderColor: 'rgba(255, 77, 40, 0.4)',
                          color: '#ff4d28',
                        }}
                      >
                        Volunteer
                      </Button>
                    </Box>
                  )}
                </Grid>

                <Grid item xs={12} md={5}>
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: '12px',
                      bgcolor: (th) =>
                        th.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
                      border: '1px solid',
                      borderColor: 'divider',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1.5,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 800,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: 'text.secondary',
                        fontSize: '0.7rem',
                      }}
                    >
                      Quick Service Actions
                    </Typography>

                    <Button
                      variant="contained"
                      size="medium"
                      component={Link}
                      to={`/events/${nextUpcomingEvent._id}`}
                      endIcon={<ArrowForwardIcon sx={{ fontSize: 15 }} />}
                      sx={{
                        borderRadius: '8px',
                        textTransform: 'none',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        py: 0.9,
                        bgcolor: '#ff4d28',
                        '&:hover': { bgcolor: '#e63e18' },
                      }}
                    >
                      Open Service Plan
                    </Button>

                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={handleSpotlightSetlistClick}
                        startIcon={<PlayArrowIcon sx={{ fontSize: 16, color: '#ff4d28' }} />}
                        sx={{
                          borderRadius: '8px',
                          textTransform: 'none',
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          py: 0.75,
                          justifyContent: 'center',
                        }}
                      >
                        Setlist Charts
                      </Button>

                      <Button
                        variant="outlined"
                        size="small"
                        component={Link}
                        to={`/events/${nextUpcomingEvent._id}/chat`}
                        startIcon={<ChatIcon sx={{ fontSize: 16, color: '#ff4d28' }} />}
                        sx={{
                          borderRadius: '8px',
                          textTransform: 'none',
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          py: 0.75,
                          justifyContent: 'center',
                        }}
                      >
                        Service Chat!
                      </Button>
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            ) : (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <Typography variant="body1" color="text.secondary" gutterBottom>
                  No upcoming services scheduled
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 2.5, display: 'block' }}>
                  Create an upcoming event to schedule your worship team, setlist songs, and presentation cues.
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => navigate('/events/new')}
                  sx={{ borderRadius: '8px', fontWeight: 700, textTransform: 'none', px: 2.5, py: 0.8 }}
                >
                  Create Worship Event
                </Button>
              </Box>
            )}
          </Box>
        </Card>
      </Box>

      {/* Recent Schedules Section */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              variant="h6"
              fontWeight={800}
              sx={{ letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '1rem' }}
            >
              Recent Schedules
            </Typography>
            <Chip
              label={`${events.length} Total`}
              size="small"
              sx={{
                fontWeight: 700,
                fontSize: '0.6875rem',
                height: 20,
                bgcolor: (th) =>
                  th.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                color: 'text.secondary',
              }}
            />
          </Box>
          <Button
            component={Link}
            to="/events"
            endIcon={<ArrowForwardIcon sx={{ fontSize: 15 }} />}
            sx={{
              fontWeight: 700,
              fontSize: '0.8125rem',
              textTransform: 'none',
              color: '#ff4d28',
              '&:hover': { bgcolor: 'rgba(255, 77, 40, 0.08)' },
            }}
          >
            View All Events
          </Button>
        </Box>

        {recentEvents.length === 0 ? (
          <Card
            elevation={0}
            sx={{
              borderRadius: '14px',
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: (th) => (th.palette.mode === 'dark' ? '#0e0e0e' : '#ffffff'),
            }}
          >
            <CardContent sx={{ py: 6, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary" gutterBottom>
                No events recorded in your church database yet.
              </Typography>
              <Button
                variant="contained"
                component={Link}
                to="/events/new"
                sx={{
                  mt: 1,
                  borderRadius: '8px',
                  textTransform: 'none',
                  fontWeight: 700,
                }}
              >
                Create First Event
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Grid container spacing={2.5}>
            {recentEvents.map((event) => {
              const eventDate = new Date(event.schedule?.start);
              return (
                <Grid item xs={12} md={4} key={event._id}>
                  <Card
                    elevation={0}
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      borderRadius: '14px',
                      border: '1px solid',
                      borderColor: (th) =>
                        th.palette.mode === 'dark'
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'rgba(0, 0, 0, 0.08)',
                      bgcolor: (th) => (th.palette.mode === 'dark' ? '#0e0e0e' : '#ffffff'),
                      transition: 'all 0.2s ease',
                      p: 2.5,
                      '&:hover': {
                        borderColor: 'rgba(255, 77, 40, 0.4)',
                        transform: 'translateY(-2px)',
                        boxShadow: (th) =>
                          th.palette.mode === 'dark'
                            ? '0 8px 24px rgba(0, 0, 0, 0.8)'
                            : '0 4px 16px rgba(0, 0, 0, 0.08)',
                      },
                    }}
                  >
                    <Box>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          mb: 1.5,
                          gap: 1,
                        }}
                      >
                        <Typography variant="subtitle1" fontWeight={700} noWrap sx={{ maxWidth: '72%' }}>
                          {event.event?.title || 'Untitled Event'}
                        </Typography>
                        <Chip
                          label={event.event?.status || 'draft'}
                          size="small"
                          sx={{
                            textTransform: 'capitalize',
                            fontWeight: 700,
                            fontSize: '0.6875rem',
                            borderRadius: '6px',
                            bgcolor:
                              event.event?.status === 'completed'
                                ? 'rgba(16, 185, 129, 0.12)'
                                : 'rgba(255, 77, 40, 0.12)',
                            color:
                              event.event?.status === 'completed' ? '#10b981' : '#ff4d28',
                          }}
                        />
                      </Box>

                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mb: 2,
                          minHeight: 38,
                          fontSize: '0.8125rem',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {event.event?.description || 'No description provided.'}
                      </Typography>
                    </Box>

                    <Box>
                      <Divider sx={{ mb: 1.5 }} />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {eventDate.toLocaleDateString(undefined, {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </Typography>
                          <Typography variant="caption" fontWeight={700}>
                            {eventDate.toLocaleTimeString(undefined, {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </Typography>
                        </Box>

                        <Button
                          size="small"
                          variant="outlined"
                          component={Link}
                          to={`/events/${event._id}`}
                          sx={{
                            borderRadius: '8px',
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            py: 0.4,
                            px: 1.5,
                          }}
                        >
                          Details
                        </Button>
                      </Box>
                    </Box>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Box>

      {/* KPI Stats Grid */}
      <Box>
        <Typography
          variant="h6"
          fontWeight={800}
          sx={{
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            fontSize: '1rem',
            mb: 2,
          }}
        >
          Capacity & Metrics
        </Typography>

        <Grid container spacing={2}>
          {/* Metric 1: Total Events */}
          <Grid item xs={12} sm={6} md={3}>
            <Card
              elevation={0}
              sx={{
                height: '100%',
                borderRadius: '14px',
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: (th) => (th.palette.mode === 'dark' ? '#0e0e0e' : '#ffffff'),
                p: 2.25,
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: 'rgba(255, 77, 40, 0.4)',
                },
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    fontWeight={700}
                    textTransform="uppercase"
                    letterSpacing="0.06em"
                    sx={{ fontSize: '0.6875rem' }}
                  >
                    Scheduled Events
                  </Typography>
                  <Typography
                    variant="h4"
                    fontWeight={800}
                    sx={{ mt: 0.25, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {events.length}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '8px',
                    bgcolor: (th) =>
                      th.palette.mode === 'dark' ? 'rgba(255, 77, 40, 0.12)' : 'rgba(255, 77, 40, 0.08)',
                    color: '#ff4d28',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <EventIcon sx={{ fontSize: 16 }} />
                </Box>
              </Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.72rem' }}
              >
                <CheckCircleIcon sx={{ fontSize: 13, color: '#10b981' }} />
                {upcomingEvents.length} upcoming active
              </Typography>
            </Card>
          </Grid>

          {/* Metric 2: Song Bank Catalog */}
          <Grid item xs={12} sm={6} md={3}>
            <Card
              elevation={0}
              sx={{
                height: '100%',
                borderRadius: '14px',
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: (th) => (th.palette.mode === 'dark' ? '#0e0e0e' : '#ffffff'),
                p: 2.25,
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: 'rgba(255, 77, 40, 0.4)',
                },
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    fontWeight={700}
                    textTransform="uppercase"
                    letterSpacing="0.06em"
                    sx={{ fontSize: '0.6875rem' }}
                  >
                    Master Song Bank
                  </Typography>
                  <Typography
                    variant="h4"
                    fontWeight={800}
                    sx={{ mt: 0.25, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {songsCount}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '8px',
                    bgcolor: (th) =>
                      th.palette.mode === 'dark' ? 'rgba(255, 77, 40, 0.12)' : 'rgba(255, 77, 40, 0.08)',
                    color: '#ff4d28',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MusicNoteIcon sx={{ fontSize: 16 }} />
                </Box>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                Transpositions & chord charts
              </Typography>
            </Card>
          </Grid>

          {/* Metric 3: Ministry Roster */}
          <Grid item xs={12} sm={6} md={3}>
            <Card
              elevation={0}
              sx={{
                height: '100%',
                borderRadius: '14px',
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: (th) => (th.palette.mode === 'dark' ? '#0e0e0e' : '#ffffff'),
                p: 2.25,
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: 'rgba(255, 77, 40, 0.4)',
                },
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    fontWeight={700}
                    textTransform="uppercase"
                    letterSpacing="0.06em"
                    sx={{ fontSize: '0.6875rem' }}
                  >
                    Church Roster
                  </Typography>
                  <Typography
                    variant="h4"
                    fontWeight={800}
                    sx={{ mt: 0.25, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {membersCount || 1}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '8px',
                    bgcolor: (th) =>
                      th.palette.mode === 'dark' ? 'rgba(255, 77, 40, 0.12)' : 'rgba(255, 77, 40, 0.08)',
                    color: '#ff4d28',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <GroupIcon sx={{ fontSize: 16 }} />
                </Box>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                Approved ministry members
              </Typography>
            </Card>
          </Grid>

          {/* Metric 4: Next Countdown */}
          <Grid item xs={12} sm={6} md={3}>
            <Card
              elevation={0}
              sx={{
                height: '100%',
                borderRadius: '14px',
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: (th) => (th.palette.mode === 'dark' ? '#0e0e0e' : '#ffffff'),
                p: 2.25,
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: 'rgba(255, 77, 40, 0.4)',
                },
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    fontWeight={700}
                    textTransform="uppercase"
                    letterSpacing="0.06em"
                    sx={{ fontSize: '0.6875rem' }}
                  >
                    Next Service
                  </Typography>
                  <Typography
                    variant="h4"
                    fontWeight={800}
                    sx={{
                      mt: 0.25,
                      letterSpacing: '-0.02em',
                      color: nextUpcomingEvent ? '#ff4d28' : 'text.secondary',
                    }}
                  >
                    {timeUntilNext}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '8px',
                    bgcolor: (th) =>
                      th.palette.mode === 'dark' ? 'rgba(255, 77, 40, 0.12)' : 'rgba(255, 77, 40, 0.08)',
                    color: '#ff4d28',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ScheduleIcon sx={{ fontSize: 16 }} />
                </Box>
              </Box>
              <Typography
                variant="caption"
                color="text.secondary"
                noWrap
                sx={{ display: 'block', fontSize: '0.72rem' }}
              >
                {nextUpcomingEvent?.event?.title || 'No events on calendar'}
              </Typography>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}

export default Dashboard;
