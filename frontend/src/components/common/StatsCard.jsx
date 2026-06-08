import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  LinearProgress,
} from '@mui/material';
import { TrendingUp, TrendingDown } from '@mui/icons-material';

function StatsCard({
  title,
  value,
  icon: Icon,
  trend,
  trendValue,
  color = 'primary',
}) {
  const getTrendColor = (trend) => {
    switch (trend) {
      case 'up':
        return 'success.main';
      case 'down':
        return 'error.main';
      default:
        return 'text.secondary';
    }
  };

  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'up':
        return TrendingUp;
      case 'down':
        return TrendingDown;
      default:
        return null;
    }
  };

  const TrendIcon = getTrendIcon(trend);

  return (
    <Card
      sx={{
        height: '100%',
        background: `linear-gradient(135deg, ${color === 'primary' ? '#667eea' : color === 'secondary' ? '#ec4899' : '#10b981'} 0%, ${color === 'primary' ? '#764ba2' : color === 'secondary' ? '#f472b6' : '#34d399'} 100%)`,
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          right: 0,
          width: 100,
          height: 100,
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '50%',
          transform: 'translate(30px, -30px)',
        },
      }}
    >
      <CardContent sx={{ p: 3, position: 'relative', zIndex: 1 }}>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="flex-start"
          mb={2}
        >
          <Box>
            <Typography
              variant="h4"
              component="div"
              sx={{ fontWeight: 700, mb: 1 }}
            >
              {value}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              {title}
            </Typography>
          </Box>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon sx={{ fontSize: 28 }} />
          </Box>
        </Box>

        {trend && trendValue && (
          <Box display="flex" alignItems="center" gap={1}>
            {TrendIcon && (
              <TrendIcon sx={{ fontSize: 16, color: getTrendColor(trend) }} />
            )}
            <Typography
              variant="caption"
              sx={{ color: getTrendColor(trend), fontWeight: 600 }}
            >
              {trendValue}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              from last month
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

export default StatsCard;
