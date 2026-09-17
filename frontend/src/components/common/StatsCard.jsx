import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
} from '@mui/material';
import { TrendingUp, TrendingDown } from '@mui/icons-material';

function StatsCard({
  title,
  value,
  icon: Icon,
  trend,
  trendValue,
  subtitle,
}) {
  const getTrendColor = (t) => {
    switch (t) {
      case 'up':
        return 'success.main';
      case 'down':
        return 'error.main';
      default:
        return 'text.secondary';
    }
  };

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : null;

  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        transition: 'border-color 120ms ease',
        '&:hover': {
          borderColor: 'text.secondary',
        },
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              fontSize: '0.72rem',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'text.secondary',
            }}
          >
            {title}
          </Typography>
          {Icon && (
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: 1.5,
                bgcolor: 'action.hover',
                color: 'text.secondary',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon sx={{ fontSize: 16 }} />
            </Box>
          )}
        </Box>

        <Typography
          variant="h4"
          component="div"
          sx={{
            fontWeight: 700,
            letterSpacing: '-0.025em',
            fontSize: '1.75rem',
            lineHeight: 1.2,
            mb: 0.5,
            color: 'text.primary',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </Typography>

        {(trend && trendValue) || subtitle ? (
          <Box display="flex" alignItems="center" gap={0.75} mt={0.5}>
            {TrendIcon && (
              <TrendIcon sx={{ fontSize: 14, color: getTrendColor(trend) }} />
            )}
            {trendValue && (
              <Typography
                variant="caption"
                sx={{
                  color: getTrendColor(trend),
                  fontWeight: 600,
                  fontSize: '0.72rem',
                }}
              >
                {trendValue}
              </Typography>
            )}
            {subtitle && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: '0.72rem' }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default StatsCard;
