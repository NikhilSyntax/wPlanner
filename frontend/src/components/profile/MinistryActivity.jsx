import React, { useEffect, useState, useCallback } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  LinearProgress,
  Paper,
  Skeleton,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import {
  VolunteerActivism as VolunteerActivismIcon,
  EventAvailable as EventAvailableIcon,
  Upcoming as UpcomingIcon,
  History as HistoryIcon,
  PieChart as PieChartIcon,
  Groups as GroupsIcon,
  Refresh as RefreshIcon,
  MusicNote as MusicNoteIcon,
  CalendarMonth as CalendarMonthIcon,
} from '@mui/icons-material';
import api from '../../services/api';

/**
 * Format service start and end times into a friendly string:
 * e.g. "Sun, 23 Aug 2026 · 10:30 AM – 12:00 PM"
 */
function formatServiceDateTime(startTime, endTime) {
  if (!startTime) return 'Date not available';
  const start = new Date(startTime);
  if (Number.isNaN(start.getTime())) return 'Invalid date';

  const dateStr = start.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const startTimeStr = start.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (endTime) {
    const end = new Date(endTime);
    if (!Number.isNaN(end.getTime())) {
      const endTimeStr = end.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      });
      return `${dateStr} · ${startTimeStr} – ${endTimeStr}`;
    }
  }

  return `${dateStr} · ${startTimeStr}`;
}

function MinistryActivity({ userId }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const fetchStats = useCallback(
    async (pageToLoad = 1, append = false) => {
      try {
        if (pageToLoad === 1 && !append) {
          setLoading(true);
          setError('');
        } else {
          setLoadingMore(true);
        }

        const endpoint = userId ? `/users/${userId}/statistics` : '/users/me/statistics';
        const response = await api.get(endpoint, {
          params: { page: pageToLoad, limit: 10 },
        });

        const data = response.data || {};
        const incomingHistory = data.servingHistory || [];

        if (append) {
          setHistory((prev) => [...prev, ...incomingHistory]);
        } else {
          setHistory(incomingHistory);
          setStats(data);
        }

        setPage(pageToLoad);
        setHasMore(data.pagination?.hasMore || false);
      } catch (err) {
        console.error('[MinistryActivity] Error loading stats:', err);
        setError(
          err?.response?.data?.message || 'Unable to load ministry activity. Please try again.'
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    fetchStats(1, false);
  }, [fetchStats]);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchStats(page + 1, true);
    }
  };

  if (loading) {
    return (
      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
          Ministry Activity
        </Typography>
        <Grid container spacing={2.5}>
          <Grid item xs={12} sm={6}>
            <Skeleton
              variant="rounded"
              height={180}
              sx={{ borderRadius: 3 }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Skeleton
              variant="rounded"
              height={180}
              sx={{ borderRadius: 3 }}
            />
          </Grid>
          <Grid item xs={12} md={7}>
            <Skeleton
              variant="rounded"
              height={320}
              sx={{ borderRadius: 3 }}
            />
          </Grid>
          <Grid item xs={12} md={5}>
            <Skeleton
              variant="rounded"
              height={320}
              sx={{ borderRadius: 3 }}
            />
          </Grid>
        </Grid>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
          Ministry Activity
        </Typography>
        <Alert
          severity="error"
          sx={{ borderRadius: 2 }}
          action={
            <Button
              color="inherit"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={() => fetchStats(1, false)}
            >
              Try Again
            </Button>
          }
        >
          {error}
        </Alert>
      </Box>
    );
  }

  const servedCount = stats?.served ?? 0;
  const upcomingCount = stats?.upcomingAssignments ?? 0;
  const positionBreakdown = stats?.positionBreakdown || [];
  const teamBreakdown = stats?.teamBreakdown || [];

  // Maximum count among positions for relative progress bar scaling
  const maxPositionCount = positionBreakdown.reduce((max, p) => Math.max(max, p.count || 0), 1);
  const maxTeamCount = teamBreakdown.reduce((max, t) => Math.max(max, t.count || 0), 1);

  return (
    <Box sx={{ mt: 3 }} data-testid="ministry-activity-section">
      <Box sx={{ mb: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} sx={{ letterSpacing: '-0.02em' }}>
            Ministry Activity
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Your personal ministry participation, accepted service commitments, and verified history.
          </Typography>
        </Box>
        <Button
          size="small"
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => fetchStats(1, false)}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
        >
          Refresh
        </Button>
      </Box>

      {/* Top Level Metric Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {/* PRIMARY STATISTIC: "Served [X] Times" */}
        <Grid item xs={12} sm={6}>
          <Card
            elevation={0}
            sx={{
              borderRadius: 3,
              position: 'relative',
              overflow: 'hidden',
              background: isDark
                ? 'linear-gradient(135deg, rgba(37, 99, 235, 0.22) 0%, rgba(29, 78, 216, 0.08) 100%)'
                : 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
              border: '1px solid',
              borderColor: isDark ? 'rgba(59, 130, 246, 0.35)' : 'rgba(191, 219, 254, 0.9)',
              boxShadow: isDark
                ? '0 4px 20px rgba(37, 99, 235, 0.12)'
                : '0 4px 16px rgba(37, 99, 235, 0.08)',
              p: 1,
            }}
          >
            <CardContent sx={{ p: { xs: 2.5, sm: 3 }, textAlign: 'center' }}>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.75,
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 20,
                  bgcolor: isDark ? 'rgba(37, 99, 235, 0.25)' : '#ffffff',
                  color: isDark ? '#93c5fd' : '#1d4ed8',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                  mb: 1.5,
                }}
              >
                <VolunteerActivismIcon sx={{ fontSize: 18 }} />
                <Typography
                  variant="caption"
                  fontWeight={800}
                  sx={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}
                >
                  Served
                </Typography>
              </Box>

              <Typography
                variant="h2"
                component="div"
                fontWeight={800}
                sx={{
                  color: isDark ? '#60a5fa' : '#1d4ed8',
                  lineHeight: 1,
                  my: 1,
                  fontSize: { xs: '3rem', sm: '3.75rem' },
                  letterSpacing: '-0.03em',
                }}
              >
                {servedCount}
              </Typography>

              <Typography
                variant="h6"
                fontWeight={700}
                sx={{
                  color: isDark ? '#93c5fd' : '#2563eb',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  fontSize: '0.9rem',
                }}
              >
                Times
              </Typography>

              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 1.5, opacity: 0.85 }}
              >
                Completed & accepted church service assignments
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* SECONDARY STATISTIC: "Upcoming [Y] Assignments" */}
        <Grid item xs={12} sm={6}>
          <Card
            elevation={0}
            sx={{
              borderRadius: 3,
              position: 'relative',
              overflow: 'hidden',
              background: isDark
                ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.18) 0%, rgba(217, 119, 6, 0.05) 100%)'
                : 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
              border: '1px solid',
              borderColor: isDark ? 'rgba(245, 158, 11, 0.35)' : 'rgba(253, 230, 138, 0.9)',
              boxShadow: isDark
                ? '0 4px 20px rgba(245, 158, 11, 0.12)'
                : '0 4px 16px rgba(245, 158, 11, 0.08)',
              p: 1,
            }}
          >
            <CardContent sx={{ p: { xs: 2.5, sm: 3 }, textAlign: 'center' }}>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.75,
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 20,
                  bgcolor: isDark ? 'rgba(245, 158, 11, 0.25)' : '#ffffff',
                  color: isDark ? '#fcd34d' : '#b45309',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                  mb: 1.5,
                }}
              >
                <UpcomingIcon sx={{ fontSize: 18 }} />
                <Typography
                  variant="caption"
                  fontWeight={800}
                  sx={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}
                >
                  Upcoming
                </Typography>
              </Box>

              <Typography
                variant="h2"
                component="div"
                fontWeight={800}
                sx={{
                  color: isDark ? '#fbbf24' : '#d97706',
                  lineHeight: 1,
                  my: 1,
                  fontSize: { xs: '3rem', sm: '3.75rem' },
                  letterSpacing: '-0.03em',
                }}
              >
                {upcomingCount}
              </Typography>

              <Typography
                variant="h6"
                fontWeight={700}
                sx={{
                  color: isDark ? '#fde68a' : '#b45309',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  fontSize: '0.9rem',
                }}
              >
                Assignments
              </Typography>

              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 1.5, opacity: 0.85 }}
              >
                Accepted future services on your schedule
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Content Grid: Serving History on Left, Breakdowns on Right */}
      <Grid container spacing={3}>
        {/* SERVING HISTORY SECTION */}
        <Grid item xs={12} md={7}>
          <Card sx={{ borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ p: { xs: 2.5, sm: 3 }, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <HistoryIcon color="primary" />
                  <Typography variant="h6" fontWeight={700}>
                    Serving History
                  </Typography>
                </Box>
                {servedCount > 0 && (
                  <Chip
                    size="small"
                    color="primary"
                    variant="outlined"
                    label={`${servedCount} Total`}
                    sx={{ fontWeight: 700 }}
                  />
                )}
              </Box>

              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2.5 }}>
                Chronological list of all completed church services and events you served in.
              </Typography>

              {history.length === 0 ? (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 4,
                    textAlign: 'center',
                    borderRadius: 2.5,
                    bgcolor: isDark ? 'background.default' : '#f8fafc',
                    my: 'auto',
                  }}
                >
                  <EventAvailableIcon sx={{ fontSize: 44, color: 'text.secondary', opacity: 0.5, mb: 1.5 }} />
                  <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                    No serving history yet.
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Your completed services will appear here.
                  </Typography>
                </Paper>
              ) : (
                <Stack spacing={2} sx={{ flexGrow: 1 }}>
                  {history.map((item, index) => (
                    <Paper
                      key={`${item.eventId}-${index}`}
                      variant="outlined"
                      sx={{
                        p: 2,
                        borderRadius: 2.5,
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          borderColor: 'primary.main',
                          boxShadow: isDark
                            ? '0 4px 12px rgba(0,0,0,0.3)'
                            : '0 4px 12px rgba(37, 99, 235, 0.08)',
                        },
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1.5, mb: 1 }}>
                        <Typography variant="subtitle1" fontWeight={700} sx={{ wordBreak: 'break-word' }}>
                          {item.title || item.eventName || 'Church Service'}
                        </Typography>
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5, color: 'text.secondary' }}>
                        <CalendarMonthIcon sx={{ fontSize: 16 }} />
                        <Typography variant="caption" fontWeight={500}>
                          {formatServiceDateTime(item.startTime, item.endTime)}
                        </Typography>
                      </Box>

                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ gap: 0.75 }}>
                        {item.team && (
                          <Chip
                            size="small"
                            icon={<GroupsIcon sx={{ fontSize: '14px !important' }} />}
                            label={item.team}
                            sx={{ fontWeight: 600, fontSize: '0.75rem' }}
                          />
                        )}
                        <Chip
                          size="small"
                          color="primary"
                          icon={<MusicNoteIcon sx={{ fontSize: '14px !important' }} />}
                          label={item.position || 'Volunteer'}
                          sx={{ fontWeight: 700, fontSize: '0.75rem' }}
                        />
                      </Stack>
                    </Paper>
                  ))}

                  {hasMore && (
                    <Box sx={{ textAlign: 'center', pt: 2 }}>
                      <Button
                        variant="outlined"
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                        sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, px: 3 }}
                      >
                        {loadingMore ? <CircularProgress size={20} /> : 'Load More'}
                      </Button>
                    </Box>
                  )}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* BREAKDOWNS SECTION */}
        <Grid item xs={12} md={5}>
          <Stack spacing={3}>
            {/* SERVING BREAKDOWN BY POSITION */}
            <Card sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <PieChartIcon color="primary" />
                  <Typography variant="h6" fontWeight={700}>
                    Serving Breakdown
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2.5 }}>
                  Completed services organized by assigned ministry position/role.
                </Typography>

                {positionBreakdown.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                    No completed position data recorded yet.
                  </Typography>
                ) : (
                  <Stack spacing={2}>
                    {positionBreakdown.map((item) => {
                      const percentage = Math.round((item.count / maxPositionCount) * 100);
                      return (
                        <Box key={item.position}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                            <Typography variant="body2" fontWeight={600}>
                              {item.position}
                            </Typography>
                            <Typography variant="body2" fontWeight={700} color="primary.main">
                              {item.count} {item.count === 1 ? 'Time' : 'Times'}
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={percentage}
                            sx={{
                              height: 6,
                              borderRadius: 3,
                              bgcolor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 3,
                                background: 'linear-gradient(90deg, #2563eb 0%, #3b82f6 100%)',
                              },
                            }}
                          />
                        </Box>
                      );
                    })}
                  </Stack>
                )}
              </CardContent>
            </Card>

            {/* TEAMS SERVED BREAKDOWN */}
            {teamBreakdown.length > 0 && (
              <Card sx={{ borderRadius: 3 }}>
                <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <GroupsIcon color="primary" />
                    <Typography variant="h6" fontWeight={700}>
                      Teams Served
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2.5 }}>
                    Distribution of completed services across church ministry teams.
                  </Typography>

                  <Stack spacing={2}>
                    {teamBreakdown.map((item) => {
                      const percentage = Math.round((item.count / maxTeamCount) * 100);
                      return (
                        <Box key={item.team}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                            <Typography variant="body2" fontWeight={600}>
                              {item.team}
                            </Typography>
                            <Typography variant="body2" fontWeight={700} color="secondary.main">
                              {item.count} {item.count === 1 ? 'Time' : 'Times'}
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={percentage}
                            color="secondary"
                            sx={{
                              height: 6,
                              borderRadius: 3,
                              bgcolor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 3,
                                background: 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)',
                              },
                            }}
                          />
                        </Box>
                      );
                    })}
                  </Stack>
                </CardContent>
              </Card>
            )}
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}

export default MinistryActivity;
