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
  Launch as LaunchIcon,
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
      navigate(`/events/${nextUpcomingEvent._id}/setlist/${firstSongId}?view=lyrics`);
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
  const recentEvents = events.slice(0, 3);

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

  return (
    <Box className="fade-in">
      {/* Top Banner / Welcome Section */}
      <Box
        sx={{
          mb: 4,
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', md: 'center' },
          gap: 2,
          p: { xs: 2.5, sm: 3 },
          borderRadius: 3,
          background: (theme) =>
            theme.palette.mode === 'dark'
              ? 'linear-gradient(135deg, rgba(37, 99, 235, 0.12) 0%, rgba(15, 23, 42, 0.6) 100%)'
              : 'linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
          <Avatar
            sx={{
              width: 56,
              height: 56,
              fontSize: '1.5rem',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
            }}
            src={resolveMediaUrl(user?.profilePhotoUrl)}
            alt={user?.name}
          >
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </Avatar>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="h4" fontWeight={700} sx={{ letterSpacing: '-0.02em' }}>
                Welcome, {user?.name || 'User'}
              </Typography>
              <Chip
                label={user?.isAdmin ? 'Church Admin' : user?.isSubAdmin ? 'Sub-Admin' : user?.role || 'Member'}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ fontWeight: 600, fontSize: '0.75rem', height: 22 }}
              />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Here is your worship planning overview and upcoming service schedules.
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Chip
            icon={<AccessTimeIcon sx={{ fontSize: '15px !important' }} />}
            label={todayStr}
            variant="outlined"
            sx={{
              fontWeight: 600,
              fontSize: '0.8125rem',
              bgcolor: 'background.paper',
            }}
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/events/new')}
            sx={{ borderRadius: 2 }}
          >
            New Event
          </Button>
        </Box>
      </Box>

      {/* Main Content Grid: Hero Next Service + Quick Actions */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Next Service Spotlight Hero Card */}
        <Grid item xs={12} lg={8}>
          <Card
            sx={{
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 3,
              border: isUserInTeam ? '1.5px solid #10b981' : '1px solid',
              borderColor: isUserInTeam ? '#10b981' : 'divider',
              boxShadow: isUserInTeam
                ? '0 4px 20px rgba(16, 185, 129, 0.15)'
                : '0 2px 10px rgba(0,0,0,0.04)',
              background: isUserInTeam
                ? (theme) =>
                    theme.palette.mode === 'dark'
                      ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(15, 23, 42, 0.9) 100%)'
                      : 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)'
                : undefined,
            }}
          >
            <Box
              sx={{
                p: { xs: 2, sm: 2.5 },
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Box>
                {/* Header line: Spotlight Tag + Service Type + You're in the Team Badge */}
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 1.25,
                    gap: 1,
                    flexWrap: 'wrap',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 800,
                        color: isUserInTeam ? '#059669' : 'primary.main',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        fontSize: '0.72rem',
                      }}
                    >
                      Upcoming Spotlight
                    </Typography>
                    {nextUpcomingEvent && (
                      <Chip
                        label={nextUpcomingEvent.event?.type || 'Service'}
                        size="small"
                        sx={{
                          textTransform: 'capitalize',
                          fontWeight: 600,
                          fontSize: '0.7rem',
                          height: 20,
                          bgcolor: isUserInTeam ? 'rgba(16, 185, 129, 0.15)' : 'rgba(37, 99, 235, 0.1)',
                          color: isUserInTeam ? '#059669' : 'primary.main',
                        }}
                      />
                    )}
                  </Box>

                  {isUserInTeam ? (
                    userAssignment?.status === 'accepted' ? (
                      <Chip
                        icon={<CheckCircleIcon sx={{ fontSize: '13px !important', color: '#ffffff !important' }} />}
                        label={`✓ Role Accepted${userAssignment.role ? `: ${userAssignment.role}` : ''}`}
                        size="small"
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.72rem',
                          bgcolor: '#10b981',
                          color: '#ffffff',
                          boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)',
                          height: 24,
                          '& .MuiChip-icon': { ml: 0.5 },
                        }}
                      />
                    ) : userAssignment?.status === 'declined' ? (
                      <Chip
                        icon={<CancelIcon sx={{ fontSize: '13px !important', color: '#ffffff !important' }} />}
                        label={`✕ Role Declined${userAssignment.role ? `: ${userAssignment.role}` : ''}`}
                        size="small"
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.72rem',
                          bgcolor: '#ef4444',
                          color: '#ffffff',
                          boxShadow: '0 2px 6px rgba(239, 68, 68, 0.3)',
                          height: 24,
                          '& .MuiChip-icon': { ml: 0.5 },
                        }}
                      />
                    ) : (
                      <Chip
                        icon={<CheckCircleIcon sx={{ fontSize: '13px !important', color: '#ffffff !important' }} />}
                        label="You're in the Team!"
                        size="small"
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.72rem',
                          bgcolor: '#2563eb',
                          color: '#ffffff',
                          boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)',
                          height: 24,
                          '& .MuiChip-icon': { ml: 0.5 },
                        }}
                      />
                    )
                  ) : isOptInPending ? (
                    <Chip
                      icon={<VolunteerActivismIcon sx={{ fontSize: '13px !important', color: '#9333ea !important' }} />}
                      label={`Offer Pending: ${userAssignment?.role || 'Volunteer'}`}
                      size="small"
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.72rem',
                        bgcolor: 'rgba(147, 51, 234, 0.12)',
                        color: '#9333ea',
                        border: '1px solid rgba(147, 51, 234, 0.3)',
                        height: 24,
                        '& .MuiChip-icon': { ml: 0.5 },
                      }}
                    />
                  ) : null}
                </Box>

                {nextUpcomingEvent ? (
                  <>
                    <Typography
                      variant="h6"
                      fontWeight={700}
                      sx={{
                        fontSize: { xs: '1.15rem', sm: '1.25rem' },
                        lineHeight: 1.25,
                        mb: 0.25,
                      }}
                    >
                      {nextUpcomingEvent.event?.title || 'Untitled Worship Service'}
                    </Typography>
                    {nextUpcomingEvent.event?.description && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        noWrap
                        sx={{ display: 'block', mb: 1.5, fontSize: '0.78rem' }}
                      >
                        {nextUpcomingEvent.event?.description}
                      </Typography>
                    )}

                    {/* Compact 3-Column Stats Grid */}
                    <Grid container spacing={1.5} sx={{ my: 0.5, alignItems: 'stretch' }}>
                      <Grid item xs={12} sm={4} sx={{ display: 'flex' }}>
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 1.25,
                            px: 1.5,
                            borderRadius: 2,
                            width: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            minHeight: 76,
                            borderColor: isUserInTeam ? 'rgba(16, 185, 129, 0.25)' : 'divider',
                            bgcolor: isUserInTeam ? 'rgba(255,255,255,0.7)' : 'background.paper',
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mb: 0.5 }}>
                            <ScheduleIcon sx={{ fontSize: 14, color: isUserInTeam ? '#059669' : 'text.secondary' }} />
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', fontWeight: 600 }}>
                              Date & Time
                            </Typography>
                          </Box>
                          <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.8125rem', lineHeight: 1.2 }}>
                            {new Date(nextUpcomingEvent.schedule.start).toLocaleDateString(undefined, {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}
                            <Box component="span" sx={{ fontWeight: 500, color: 'text.secondary', ml: 0.6 }}>
                              {new Date(nextUpcomingEvent.schedule.start).toLocaleTimeString(undefined, {
                                hour: 'numeric',
                                minute: '2-digit',
                              })}
                            </Box>
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.72rem', mt: 0.2 }}>
                            {timeUntilNext}
                          </Typography>
                        </Paper>
                      </Grid>

                      <Grid item xs={12} sm={4} sx={{ display: 'flex' }}>
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 1.25,
                            px: 1.5,
                            borderRadius: 2,
                            width: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            minHeight: 76,
                            borderColor: isUserInTeam ? 'rgba(16, 185, 129, 0.25)' : 'divider',
                            bgcolor: isUserInTeam ? 'rgba(255,255,255,0.7)' : 'background.paper',
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mb: 0.5 }}>
                            <GroupIcon sx={{ fontSize: 14, color: isUserInTeam ? '#059669' : 'text.secondary' }} />
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', fontWeight: 600 }}>
                              Assigned Team
                            </Typography>
                          </Box>
                          <Typography variant="body2" fontWeight={700} noWrap sx={{ fontSize: '0.8125rem', lineHeight: 1.2 }}>
                            {nextUpcomingEvent.team?.team?.name || 'Worship Team'}
                          </Typography>
                          <Typography
                            variant="caption"
                            noWrap
                            display="block"
                            sx={{
                              color: isUserInTeam ? '#059669' : isOptInPending ? '#9333ea' : 'text.secondary',
                              fontWeight: isUserInTeam || isOptInPending ? 700 : 500,
                              fontSize: '0.72rem',
                              mt: 0.2,
                            }}
                          >
                            {isUserInTeam && userAssignment?.role
                              ? `Your Role: ${userAssignment.role}`
                              : isOptInPending
                              ? `Offered: ${userAssignment?.role || 'Volunteer'} (Pending)`
                              : isUserInTeam
                              ? `Assigned in Roster`
                              : `${(nextUpcomingEvent.assignments || []).filter((a) => !a.userId?.isAdmin && a.userId?.role !== 'Admin').length} members assigned`}
                          </Typography>
                        </Paper>
                      </Grid>

                      <Grid item xs={12} sm={4} sx={{ display: 'flex' }}>
                        <Tooltip
                          title={
                            nextUpcomingEvent.setlist?.length > 0
                              ? "Click to open chords & lyrics for this setlist"
                              : "Click to open service plan"
                          }
                          arrow
                        >
                          <Paper
                            variant="outlined"
                            onClick={handleSpotlightSetlistClick}
                            sx={{
                              p: 1.25,
                              px: 1.5,
                              borderRadius: 2,
                              width: '100%',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              minHeight: 76,
                              borderColor: isUserInTeam ? 'rgba(16, 185, 129, 0.25)' : 'divider',
                              bgcolor: isUserInTeam ? 'rgba(255,255,255,0.7)' : 'background.paper',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              '&:hover': {
                                bgcolor: isUserInTeam ? 'rgba(16, 185, 129, 0.08)' : 'rgba(37, 99, 235, 0.05)',
                                borderColor: isUserInTeam ? '#10b981' : 'primary.main',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                transform: 'translateY(-2px)',
                              },
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                                <QueueMusicIcon sx={{ fontSize: 14, color: isUserInTeam ? '#059669' : 'text.secondary' }} />
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', fontWeight: 600 }}>
                                  Setlist
                                </Typography>
                              </Box>
                              <LaunchIcon sx={{ fontSize: 12, color: 'text.disabled', opacity: 0.8 }} />
                            </Box>
                            <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.8125rem', lineHeight: 1.2 }}>
                              {nextUpcomingEvent.setlist?.length || 0} Songs Selected
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              display="block"
                              sx={{
                                fontSize: '0.72rem',
                                mt: 0.2,
                                color: nextUpcomingEvent.setlist?.length > 0 ? (isUserInTeam ? '#059669' : 'primary.main') : 'text.secondary',
                                fontWeight: nextUpcomingEvent.setlist?.length > 0 ? 600 : 400,
                              }}
                            >
                              {nextUpcomingEvent.setlist?.length > 0 ? 'Click to view lyrics & chords →' : 'Ready for rehearsal'}
                            </Typography>
                          </Paper>
                        </Tooltip>
                      </Grid>
                    </Grid>

                    {/* Assignment Action Banner for Confirmed/Assigned Team Members */}
                    {isUserInTeam && (
                      <Paper
                        variant="outlined"
                        sx={{
                          p: 1.25,
                          px: 1.75,
                          mb: 1.5,
                          borderRadius: 2,
                          borderColor:
                            userAssignment?.status === 'accepted'
                              ? 'rgba(16, 185, 129, 0.35)'
                              : userAssignment?.status === 'declined'
                              ? 'rgba(239, 68, 68, 0.35)'
                              : 'rgba(37, 99, 235, 0.35)',
                          bgcolor: (theme) =>
                            userAssignment?.status === 'accepted'
                              ? theme.palette.mode === 'dark'
                                ? 'rgba(16, 185, 129, 0.12)'
                                : '#f0fdf4'
                              : userAssignment?.status === 'declined'
                              ? theme.palette.mode === 'dark'
                                ? 'rgba(239, 68, 68, 0.12)'
                                : '#fef2f2'
                              : theme.palette.mode === 'dark'
                              ? 'rgba(37, 99, 235, 0.12)'
                              : '#eff6ff',
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
                              <CheckCircleIcon sx={{ color: '#10b981', fontSize: 20 }} />
                              <Typography
                                variant="body2"
                                fontWeight={600}
                                sx={{
                                  color: (theme) =>
                                    theme.palette.mode === 'dark' ? '#34d399' : '#065f46',
                                }}
                              >
                                You accepted your role as <strong>{userAssignment?.role || 'Team Member'}</strong> for this service.
                              </Typography>
                            </Box>
                            <Tooltip title="Decline assignment if unavailable (Cross)">
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                startIcon={<CloseIcon sx={{ fontSize: 13 }} />}
                                onClick={() =>
                                  handleSpotlightAssignmentRespond(nextUpcomingEvent._id, 'declined')
                                }
                                disabled={respondingSpotlight}
                                sx={{
                                  textTransform: 'none',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  py: 0.3,
                                  px: 1.2,
                                  borderRadius: 1.5,
                                }}
                              >
                                Decline (✕)
                              </Button>
                            </Tooltip>
                          </>
                        ) : userAssignment?.status === 'declined' ? (
                          <>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <CancelIcon sx={{ color: '#ef4444', fontSize: 20 }} />
                              <Typography
                                variant="body2"
                                fontWeight={600}
                                sx={{
                                  color: (theme) =>
                                    theme.palette.mode === 'dark' ? '#f87171' : '#991b1b',
                                }}
                              >
                                You have declined this assignment ({userAssignment?.role || 'Team Member'}).
                              </Typography>
                            </Box>
                            <Tooltip title="Accept assignment (Tick)">
                              <Button
                                size="small"
                                variant="contained"
                                color="success"
                                startIcon={<CheckIcon sx={{ fontSize: 13 }} />}
                                onClick={() =>
                                  handleSpotlightAssignmentRespond(nextUpcomingEvent._id, 'accepted')
                                }
                                disabled={respondingSpotlight}
                                sx={{
                                  textTransform: 'none',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  py: 0.3,
                                  px: 1.4,
                                  borderRadius: 1.5,
                                  boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)',
                                }}
                              >
                                Accept (✓)
                              </Button>
                            </Tooltip>
                          </>
                        ) : (
                          <>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <AssignmentIndIcon color="primary" sx={{ fontSize: 20 }} />
                              <Typography variant="body2" fontWeight={600} color="text.primary">
                                You are scheduled as <strong>{userAssignment?.role || 'Team Member'}</strong>. Please respond:
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Tooltip title="Accept Assignment (Tick)">
                                <Button
                                  variant="contained"
                                  color="success"
                                  size="small"
                                  startIcon={
                                    respondingSpotlight ? (
                                      <CircularProgress size={13} color="inherit" />
                                    ) : (
                                      <CheckIcon sx={{ fontSize: 15 }} />
                                    )
                                  }
                                  onClick={() =>
                                    handleSpotlightAssignmentRespond(nextUpcomingEvent._id, 'accepted')
                                  }
                                  disabled={respondingSpotlight}
                                  sx={{
                                    fontWeight: 700,
                                    textTransform: 'none',
                                    borderRadius: 1.5,
                                    fontSize: '0.78rem',
                                    py: 0.4,
                                    px: 1.5,
                                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)',
                                  }}
                                >
                                  Accept (✓)
                                </Button>
                              </Tooltip>
                              <Tooltip title="Decline Assignment (Cross)">
                                <Button
                                  variant="outlined"
                                  color="error"
                                  size="small"
                                  startIcon={<CloseIcon sx={{ fontSize: 15 }} />}
                                  onClick={() =>
                                    handleSpotlightAssignmentRespond(nextUpcomingEvent._id, 'declined')
                                  }
                                  disabled={respondingSpotlight}
                                  sx={{
                                    fontWeight: 700,
                                    textTransform: 'none',
                                    borderRadius: 1.5,
                                    fontSize: '0.78rem',
                                    py: 0.4,
                                    px: 1.5,
                                  }}
                                >
                                  Decline (✕)
                                </Button>
                              </Tooltip>
                            </Box>
                          </>
                        )}
                      </Paper>
                    )}

                    {/* Opt-In Pending Confirmation Banner */}
                    {isOptInPending && (
                      <Paper
                        variant="outlined"
                        sx={{
                          p: 1.25,
                          px: 1.75,
                          mb: 1.5,
                          borderRadius: 2,
                          borderColor: 'rgba(147, 51, 234, 0.35)',
                          bgcolor: (theme) =>
                            theme.palette.mode === 'dark' ? 'rgba(147, 51, 234, 0.12)' : '#faf5ff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 1.5,
                          flexWrap: 'wrap',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <VolunteerActivismIcon color="secondary" sx={{ fontSize: 20 }} />
                          <Typography variant="body2" fontWeight={600} color="text.primary">
                            You offered to serve as <strong>{userAssignment?.role || 'Volunteer'}</strong>. (Awaiting leader confirmation)
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          variant="outlined"
                          color="secondary"
                          onClick={() => navigate(`/events/${nextUpcomingEvent._id}`)}
                          sx={{ textTransform: 'none', borderRadius: 1.5, fontSize: '0.75rem', fontWeight: 600 }}
                        >
                          View Event
                        </Button>
                      </Paper>
                    )}

                    {!isAdmin && !userAssignment && (
                      <Paper
                        variant="outlined"
                        sx={{
                          mt: 2,
                          p: 1.5,
                          borderRadius: 2,
                          bgcolor: (theme) =>
                            theme.palette.mode === 'dark'
                              ? 'rgba(147, 51, 234, 0.08)'
                              : '#faf5ff',
                          borderColor: 'secondary.main',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 1.5,
                          flexWrap: 'wrap',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <VolunteerActivismIcon color="secondary" sx={{ fontSize: 20 }} />
                          <Typography variant="body2" color="text.primary">
                            Not scheduled for this service? You can offer to serve!
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          variant="contained"
                          color="secondary"
                          startIcon={<VolunteerActivismIcon sx={{ fontSize: 15 }} />}
                          onClick={() => navigate(`/events/${nextUpcomingEvent._id}`)}
                          sx={{
                            textTransform: 'none',
                            fontWeight: 700,
                            borderRadius: 1.5,
                            fontSize: '0.78rem',
                          }}
                        >
                          Volunteer to Serve
                        </Button>
                      </Paper>
                    )}
                  </>
                ) : (
                  <Box sx={{ py: 3, textAlign: 'center' }}>
                    <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                      No upcoming services scheduled
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
                      Create an upcoming event to schedule your worship team and songs.
                    </Typography>
                    <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => navigate('/events/new')}>
                      Create Worship Event
                    </Button>
                  </Box>
                )}
              </Box>

              {nextUpcomingEvent && (
                <Box
                  sx={{
                    display: 'flex',
                    gap: 1.5,
                    pt: 2,
                    mt: 2,
                    borderTop: '1px solid',
                    borderColor: isUserInTeam ? 'rgba(16, 185, 129, 0.2)' : 'divider',
                    flexWrap: 'wrap',
                  }}
                >
                  <Button
                    variant="contained"
                    size="small"
                    component={Link}
                    to={`/events/${nextUpcomingEvent._id}`}
                    endIcon={<ArrowForwardIcon sx={{ fontSize: 15 }} />}
                    sx={{
                      borderRadius: 1.5,
                      textTransform: 'none',
                      fontWeight: 600,
                      fontSize: '0.8125rem',
                      py: 0.65,
                      px: 2,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Open Service Plan
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    component={Link}
                    to={`/events/${nextUpcomingEvent._id}/team`}
                    sx={{
                      borderRadius: 1.5,
                      textTransform: 'none',
                      fontWeight: 600,
                      fontSize: '0.8125rem',
                      py: 0.65,
                      px: 2,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Manage Roster
                  </Button>
                </Box>
              )}
            </Box>
          </Card>
        </Grid>

        {/* Quick Launch Panel */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2.5 }}>
                Quick Actions
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Button
                  variant="outlined"
                  fullWidth
                  component={Link}
                  to="/events/new"
                  startIcon={<EventIcon color="primary" />}
                  sx={{
                    justifyContent: 'flex-start',
                    py: 1.3,
                    px: 2,
                    textAlign: 'left',
                    borderRadius: 2,
                  }}
                >
                  <Box sx={{ textAlign: 'left' }}>
                    <Typography variant="body2" fontWeight={600} color="text.primary">
                      Schedule New Event
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Create Sunday service or rehearsal
                    </Typography>
                  </Box>
                </Button>

                <Button
                  variant="outlined"
                  fullWidth
                  component={Link}
                  to="/songs/new"
                  startIcon={<QueueMusicIcon sx={{ color: '#f59e0b' }} />}
                  sx={{
                    justifyContent: 'flex-start',
                    py: 1.3,
                    px: 2,
                    textAlign: 'left',
                    borderRadius: 2,
                  }}
                >
                  <Box sx={{ textAlign: 'left' }}>
                    <Typography variant="body2" fontWeight={600} color="text.primary">
                      Add Song to Bank
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Chords, lyrics & audio keys
                    </Typography>
                  </Box>
                </Button>

                <Button
                  variant="outlined"
                  fullWidth
                  component={Link}
                  to="/teams"
                  startIcon={<GroupIcon sx={{ color: '#10b981' }} />}
                  sx={{
                    justifyContent: 'flex-start',
                    py: 1.3,
                    px: 2,
                    textAlign: 'left',
                    borderRadius: 2,
                  }}
                >
                  <Box sx={{ textAlign: 'left' }}>
                    <Typography variant="body2" fontWeight={600} color="text.primary">
                      Manage Church Roster
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Permissions & ministry roles
                    </Typography>
                  </Box>
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recent Events Section */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
          <Typography variant="h5" fontWeight={700}>
            Recent Schedules
          </Typography>
          <Button
            component={Link}
            to="/events"
            endIcon={<ArrowForwardIcon />}
            sx={{ fontWeight: 600 }}
          >
            View All Events
          </Button>
        </Box>

        {recentEvents.length === 0 ? (
          <Card>
            <CardContent sx={{ py: 6, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary" gutterBottom>
                No events recorded in your church database yet.
              </Typography>
              <Button variant="contained" component={Link} to="/events/new" sx={{ mt: 1 }}>
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
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <CardContent sx={{ p: 2.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                        <Typography variant="h6" fontWeight={700} noWrap sx={{ maxWidth: '70%' }}>
                          {event.event?.title || 'Untitled Event'}
                        </Typography>
                        <Chip
                          label={event.event?.status || 'draft'}
                          size="small"
                          sx={{
                            textTransform: 'capitalize',
                            fontWeight: 700,
                            fontSize: '0.6875rem',
                            bgcolor: event.event?.status === 'completed' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(37, 99, 235, 0.1)',
                            color: event.event?.status === 'completed' ? 'success.main' : 'primary.main',
                          }}
                        />
                      </Box>

                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, minHeight: 38 }}>
                        {event.event?.description || 'No description provided.'}
                      </Typography>

                      <Divider sx={{ my: 1.5 }} />

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {eventDate.toLocaleDateString(undefined, {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </Typography>
                          <Typography variant="caption" fontWeight={600}>
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
                          sx={{ borderRadius: 2 }}
                        >
                          Details
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Box>

      {/* KPI Stats Grid - At the Total Bottom */}
      <Grid container spacing={2.5} sx={{ mb: 2 }}>
        {/* Metric 1: Total Events */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing="0.05em">
                    Scheduled Events
                  </Typography>
                  <Typography variant="h3" fontWeight={700} sx={{ mt: 0.5 }}>
                    {events.length}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    p: 1.2,
                    borderRadius: 2,
                    bgcolor: 'rgba(37, 99, 235, 0.1)',
                    color: 'primary.main',
                  }}
                >
                  <EventIcon sx={{ fontSize: 24 }} />
                </Box>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />
                {upcomingEvents.length} upcoming scheduled
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Metric 2: Song Bank Catalog */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing="0.05em">
                    Song Bank
                  </Typography>
                  <Typography variant="h3" fontWeight={700} sx={{ mt: 0.5 }}>
                    {songsCount}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    p: 1.2,
                    borderRadius: 2,
                    bgcolor: 'rgba(245, 158, 11, 0.1)',
                    color: '#f59e0b',
                  }}
                >
                  <MusicNoteIcon sx={{ fontSize: 24 }} />
                </Box>
              </Box>
              <Typography variant="caption" color="text.secondary">
                Ready for setlists & transpositions
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Metric 3: Ministry Roster */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing="0.05em">
                    Church Roster
                  </Typography>
                  <Typography variant="h3" fontWeight={700} sx={{ mt: 0.5 }}>
                    {membersCount || 1}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    p: 1.2,
                    borderRadius: 2,
                    bgcolor: 'rgba(16, 185, 129, 0.1)',
                    color: 'success.main',
                  }}
                >
                  <GroupIcon sx={{ fontSize: 24 }} />
                </Box>
              </Box>
              <Typography variant="caption" color="text.secondary">
                Approved ministry team members
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Metric 4: Next Countdown */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', borderColor: nextUpcomingEvent ? 'primary.light' : undefined }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing="0.05em">
                    Next Service
                  </Typography>
                  <Typography variant="h5" fontWeight={700} sx={{ mt: 1, color: nextUpcomingEvent ? 'primary.main' : 'text.secondary' }}>
                    {timeUntilNext}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    p: 1.2,
                    borderRadius: 2,
                    bgcolor: 'rgba(6, 182, 212, 0.1)',
                    color: '#06b6d4',
                  }}
                >
                  <ScheduleIcon sx={{ fontSize: 24 }} />
                </Box>
              </Box>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                {nextUpcomingEvent?.event?.title || 'No events on calendar'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Dashboard;
