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
} from '@mui/icons-material';
import { fetchEvents } from '../store/slices/eventSlice';
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

  useEffect(() => {
    dispatch(fetchEvents());
    
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
  }, [dispatch]);

  if (loading && statsLoading) return <LoadingSpinner />;

  const now = new Date();
  const upcomingEvents = [...events]
    .filter((event) => new Date(event.schedule?.start) > now)
    .sort((a, b) => new Date(a.schedule?.start) - new Date(b.schedule?.start));

  const nextUpcomingEvent = upcomingEvents[0];
  const recentEvents = events.slice(0, 3);

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

      {/* KPI Stats Grid */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
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

      {/* Main Content Grid: Hero Next Service + Quick Actions */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Next Service Spotlight Hero Card */}
        <Grid item xs={12} lg={8}>
          <Card sx={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
            <Box
              sx={{
                p: { xs: 2.5, sm: 3 },
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                justifyContent: 'space-between',
              }}
            >
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="overline" color="primary.main">
                    Upcoming Spotlight
                  </Typography>
                  {nextUpcomingEvent && (
                    <Chip
                      label={nextUpcomingEvent.event?.type || 'Service'}
                      size="small"
                      sx={{
                        textTransform: 'capitalize',
                        fontWeight: 600,
                        bgcolor: 'rgba(37, 99, 235, 0.1)',
                        color: 'primary.main',
                      }}
                    />
                  )}
                </Box>

                {nextUpcomingEvent ? (
                  <>
                    <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>
                      {nextUpcomingEvent.event?.title || 'Untitled Worship Service'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                      {nextUpcomingEvent.event?.description || 'Worship planning, team assignments, and setlist.'}
                    </Typography>

                    <Grid container spacing={2} sx={{ mb: 3 }}>
                      <Grid item xs={12} sm={4}>
                        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                          <Typography variant="caption" color="text.secondary" display="block">
                            Date & Time
                          </Typography>
                          <Typography variant="body2" fontWeight={600} sx={{ mt: 0.3 }}>
                            {new Date(nextUpcomingEvent.schedule.start).toLocaleDateString(undefined, {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(nextUpcomingEvent.schedule.start).toLocaleTimeString(undefined, {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </Typography>
                        </Paper>
                      </Grid>

                      <Grid item xs={12} sm={4}>
                        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                          <Typography variant="caption" color="text.secondary" display="block">
                            Assigned Team
                          </Typography>
                          <Typography variant="body2" fontWeight={600} sx={{ mt: 0.3 }}>
                            {nextUpcomingEvent.team?.team?.name || 'Worship Team'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {nextUpcomingEvent.assignments?.length || 0} members assigned
                          </Typography>
                        </Paper>
                      </Grid>

                      <Grid item xs={12} sm={4}>
                        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                          <Typography variant="caption" color="text.secondary" display="block">
                            Setlist
                          </Typography>
                          <Typography variant="body2" fontWeight={600} sx={{ mt: 0.3 }}>
                            {nextUpcomingEvent.setlist?.length || 0} Songs Selected
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Ready for rehearsal
                          </Typography>
                        </Paper>
                      </Grid>
                    </Grid>
                  </>
                ) : (
                  <Box sx={{ py: 4, textAlign: 'center' }}>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      No upcoming services scheduled
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Create an upcoming event to schedule your worship team, select songs, and plan production.
                    </Typography>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/events/new')}>
                      Create Worship Event
                    </Button>
                  </Box>
                )}
              </Box>

              {nextUpcomingEvent && (
                <Box sx={{ display: 'flex', gap: 1.5, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Button
                    variant="contained"
                    component={Link}
                    to={`/events/${nextUpcomingEvent._id}`}
                    endIcon={<ArrowForwardIcon />}
                    sx={{ borderRadius: 2 }}
                  >
                    Open Service Plan
                  </Button>
                  <Button
                    variant="outlined"
                    component={Link}
                    to={`/events/${nextUpcomingEvent._id}/team`}
                    sx={{ borderRadius: 2 }}
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
      <Box sx={{ mb: 2 }}>
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
    </Box>
  );
}

export default Dashboard;
