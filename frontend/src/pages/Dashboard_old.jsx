import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Box,
  Button,
} from '@mui/material';
import { Event, Group, MusicNote, PlaylistPlay } from '@mui/icons-material';
import { Link } from 'react-router-dom';
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

  const upcomingEvents = events.filter(
    (event) => new Date(event.schedule.start) > new Date()
  );

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Welcome back, {user?.name || 'User'}!
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Here&apos;s what&apos;s happening with your worship planning.
        </Typography>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <Event color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Events</Typography>
              </Box>
              <Typography variant="h4">{events.length}</Typography>
              <Typography variant="body2" color="text.secondary">
                Total events
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <Group color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Teams</Typography>
              </Box>
              <Typography variant="h4">0</Typography>
              <Typography variant="body2" color="text.secondary">
                Active teams
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <MusicNote color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Songs</Typography>
              </Box>
              <Typography variant="h4">0</Typography>
              <Typography variant="body2" color="text.secondary">
                In library
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <PlaylistPlay color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Setlists</Typography>
              </Box>
              <Typography variant="h4">0</Typography>
              <Typography variant="body2" color="text.secondary">
                Created
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ mb: 4 }}>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Typography variant="h5">Upcoming Events</Typography>
          <Button variant="contained" component={Link} to="/events/new">
            Create Event
          </Button>
        </Box>

        {upcomingEvents.length === 0 ? (
          <Card>
            <CardContent>
              <Typography variant="body1" color="text.secondary" align="center">
                No upcoming events. Create your first event to get started!
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Grid container spacing={2}>
            {upcomingEvents.slice(0, 3).map((event) => (
              <Grid item xs={12} md={4} key={event._id}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {event.event.title}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                    >
                      {new Date(event.schedule.start).toLocaleDateString()} at{' '}
                      {new Date(event.schedule.start).toLocaleTimeString()}
                    </Typography>
                    <Typography variant="body2">
                      Type: {event.event.type}
                    </Typography>
                    <Box sx={{ mt: 2 }}>
                      <Button
                        size="small"
                        component={Link}
                        to={`/events/${event._id}`}
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
      </Box>

      <Box>
        <Typography variant="h5" gutterBottom>
          Quick Actions
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              variant="outlined"
              fullWidth
              component={Link}
              to="/events/new"
              startIcon={<Event />}
            >
              New Event
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              variant="outlined"
              fullWidth
              component={Link}
              to="/teams/new"
              startIcon={<Group />}
            >
              New Team
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              variant="outlined"
              fullWidth
              component={Link}
              to="/songs/new"
              startIcon={<MusicNote />}
            >
              Add Song
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              variant="outlined"
              fullWidth
              component={Link}
              to="/setlists/new"
              startIcon={<PlaylistPlay />}
            >
              New Setlist
            </Button>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
}

export default Dashboard;
