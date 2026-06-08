import React, { useEffect } from 'react';
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
} from '@mui/material';
import { Link } from 'react-router-dom';
import {
  Add as AddIcon,
  TrendingUp as TrendingUpIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { fetchEvents } from '../store/slices/eventSlice';
import LoadingSpinner from '../components/common/LoadingSpinner';

function Dashboard() {
  const dispatch = useDispatch();
  const { events, loading } = useSelector((state) => state.events);
  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    dispatch(fetchEvents());
  }, [dispatch]);

  if (loading) return <LoadingSpinner />;

  const now = new Date();
  const nextUpcomingEvent = [...events]
    .filter((event) => new Date(event.schedule.start) > now)
    .sort(
      (a, b) =>
        new Date(a.schedule.start) - new Date(b.schedule.start)
    )[0];

  const recentEvents = events.slice(0, 3);

  return (
    <Box>
      {/* Welcome Section */}
      <Box sx={{ mb: 4 }}>
        <Box display="flex" alignItems="center" gap={3} mb={2}>
          <Avatar
            sx={{
              width: 64,
              height: 64,
              bgcolor: 'primary.main',
              fontSize: '2rem',
            }}
          >
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </Avatar>
          <Box>
            <Typography
              variant="h3"
              component="h1"
              gutterBottom
              sx={{ fontWeight: 700 }}
            >
              Welcome back, {user?.name || 'User'}! 👋
            </Typography>
            <Typography variant="h6" color="text.secondary">
              Here&apos;s what&apos;s happening with your worship planning
              today.
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Next upcoming event — compact tile */}
      <Card
        variant="outlined"
        sx={{
          mb: 4,
          maxWidth: 400,
          borderRadius: 2,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          boxShadow: (theme) =>
            theme.palette.mode === 'light'
              ? '0 1px 2px rgba(15, 23, 42, 0.06)'
              : undefined,
        }}
      >
        <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
          <Box display="flex" alignItems="flex-start" gap={1.5}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'action.hover',
                color: 'primary.main',
                flexShrink: 0,
              }}
            >
              <ScheduleIcon sx={{ fontSize: 20 }} />
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                fontWeight={600}
                letterSpacing="0.04em"
                textTransform="uppercase"
                display="block"
                sx={{ mb: 0.5 }}
              >
                Upcoming event
              </Typography>
              {nextUpcomingEvent ? (
                <>
                  <Typography
                    variant="body2"
                    fontWeight={600}
                    noWrap
                    title={nextUpcomingEvent.event?.title}
                    sx={{ mb: 0.5 }}
                  >
                    {nextUpcomingEvent.event?.title || 'Untitled'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ lineHeight: 1.4 }}>
                    {new Date(nextUpcomingEvent.schedule.start).toLocaleDateString(
                      undefined,
                      {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      }
                    )}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {new Date(nextUpcomingEvent.schedule.start).toLocaleTimeString(
                      undefined,
                      { hour: 'numeric', minute: '2-digit' }
                    )}
                  </Typography>
                  <Button
                    size="small"
                    component={Link}
                    to={`/events/${nextUpcomingEvent._id}`}
                    sx={{ mt: 0.75, p: 0, minWidth: 0, textTransform: 'none' }}
                  >
                    View details
                  </Button>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No scheduled events ahead.{' '}
                  <Button
                    size="small"
                    component={Link}
                    to="/events"
                    sx={{ p: 0, minWidth: 0, textTransform: 'none', verticalAlign: 'baseline' }}
                  >
                    Create one
                  </Button>
                </Typography>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card sx={{ mb: 4, borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
            Quick Actions
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                variant="contained"
                fullWidth
                component={Link}
                to="/events"
                startIcon={<AddIcon />}
                sx={{
                  py: 2,
                  borderRadius: 2,
                  textTransform: 'none',
                  fontSize: '1rem',
                }}
              >
                New Event
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                variant="outlined"
                fullWidth
                component={Link}
                to="/teams"
                startIcon={<AddIcon />}
                sx={{
                  py: 2,
                  borderRadius: 2,
                  textTransform: 'none',
                  fontSize: '1rem',
                }}
              >
                New Team
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                variant="outlined"
                fullWidth
                component={Link}
                to="/songs"
                startIcon={<AddIcon />}
                sx={{
                  py: 2,
                  borderRadius: 2,
                  textTransform: 'none',
                  fontSize: '1rem',
                }}
              >
                Add Song
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Recent Events */}
      <Card sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            mb={3}
          >
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              Recent Events
            </Typography>
            <Button
              variant="text"
              component={Link}
              to="/events"
              endIcon={<TrendingUpIcon />}
              sx={{ textTransform: 'none' }}
            >
              View All
            </Button>
          </Box>

          {recentEvents.length === 0 ? (
            <Box textAlign="center" py={6}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No events yet
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>
                Create your first worship event to get started.
              </Typography>
              <Button
                variant="contained"
                component={Link}
                to="/events"
                startIcon={<AddIcon />}
              >
                Create Event
              </Button>
            </Box>
          ) : (
            <Grid container spacing={2}>
              {recentEvents.map((event) => (
                <Grid item xs={12} md={4} key={event._id}>
                  <Card
                    sx={{
                      borderRadius: 2,
                      transition: 'transform 0.2s ease-in-out',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                      },
                    }}
                  >
                    <CardContent sx={{ p: 2 }}>
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="flex-start"
                        mb={2}
                      >
                        <Typography
                          variant="h6"
                          sx={{ fontWeight: 600, mb: 1 }}
                        >
                          {event.event.title}
                        </Typography>
                        <Chip
                          label={event.event.type}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      </Box>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        gutterBottom
                      >
                        {new Date(event.schedule.start).toLocaleDateString(
                          'en-US',
                          {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          }
                        )}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {new Date(event.schedule.start).toLocaleTimeString(
                          'en-US',
                          {
                            hour: '2-digit',
                            minute: '2-digit',
                          }
                        )}
                      </Typography>
                      <Box sx={{ mt: 2 }}>
                        <Button
                          size="small"
                          component={Link}
                          to={`/events/${event._id}`}
                          sx={{ textTransform: 'none' }}
                        >
                          View Details
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

export default Dashboard;
