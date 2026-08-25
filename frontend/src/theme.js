import { createTheme } from '@mui/material/styles';

// Enterprise color palette
const baseColors = {
  primary: {
    main: '#2563eb', // Royal Precision Blue
    light: '#3b82f6',
    dark: '#1d4ed8',
    contrastText: '#ffffff',
  },
  secondary: {
    main: '#f59e0b', // Warm Amber / Amazon Gold Accent
    light: '#fbbf24',
    dark: '#d97706',
    contrastText: '#0f172a',
  },
  accent: {
    main: '#06b6d4', // Cyan
    light: '#22d3ee',
    dark: '#0891b2',
  },
  success: {
    main: '#10b981', // Emerald
    light: '#34d399',
    dark: '#059669',
    contrastText: '#ffffff',
  },
  warning: {
    main: '#f59e0b',
    light: '#fbbf24',
    dark: '#d97706',
    contrastText: '#0f172a',
  },
  error: {
    main: '#ef4444',
    light: '#f87171',
    dark: '#dc2626',
    contrastText: '#ffffff',
  },
  info: {
    main: '#0ea5e9',
    light: '#38bdf8',
    dark: '#0284c7',
    contrastText: '#ffffff',
  },
};

const typography = {
  fontFamily: [
    'Inter',
    '-apple-system',
    'BlinkMacSystemFont',
    '"Segoe UI"',
    'Roboto',
    '"Helvetica Neue"',
    'Arial',
    'sans-serif',
  ].join(','),
  h1: {
    fontSize: '2.25rem',
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: '-0.03em',
  },
  h2: {
    fontSize: '1.875rem',
    fontWeight: 700,
    lineHeight: 1.25,
    letterSpacing: '-0.025em',
  },
  h3: {
    fontSize: '1.5rem',
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: '-0.02em',
  },
  h4: {
    fontSize: '1.25rem',
    fontWeight: 600,
    lineHeight: 1.35,
    letterSpacing: '-0.015em',
  },
  h5: {
    fontSize: '1.125rem',
    fontWeight: 600,
    lineHeight: 1.4,
    letterSpacing: '-0.01em',
  },
  h6: {
    fontSize: '1rem',
    fontWeight: 600,
    lineHeight: 1.4,
    letterSpacing: '-0.005em',
  },
  subtitle1: {
    fontSize: '1rem',
    fontWeight: 500,
    lineHeight: 1.5,
  },
  subtitle2: {
    fontSize: '0.875rem',
    fontWeight: 600,
    lineHeight: 1.5,
    letterSpacing: '0.01em',
  },
  body1: {
    fontSize: '0.9375rem',
    lineHeight: 1.6,
  },
  body2: {
    fontSize: '0.84375rem',
    lineHeight: 1.55,
  },
  button: {
    textTransform: 'none',
    fontWeight: 600,
    letterSpacing: '0.01em',
  },
  caption: {
    fontSize: '0.75rem',
    lineHeight: 1.4,
    letterSpacing: '0.02em',
  },
  overline: {
    fontSize: '0.6875rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
};

const commonComponentOverrides = (isDark) => ({
  MuiButton: {
    defaultProps: {
      disableElevation: true,
    },
    styleOverrides: {
      root: {
        borderRadius: 8,
        padding: '8px 18px',
        fontSize: '0.875rem',
        fontWeight: 600,
        transition: 'all 0.15s ease-in-out',
        '&:hover': {
          transform: 'translateY(-1px)',
        },
        '&:active': {
          transform: 'translateY(0)',
        },
      },
      containedPrimary: {
        background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
        boxShadow: isDark
          ? '0 2px 8px rgba(37, 99, 235, 0.4)'
          : '0 2px 6px rgba(37, 99, 235, 0.25)',
        '&:hover': {
          background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)',
          boxShadow: isDark
            ? '0 4px 14px rgba(37, 99, 235, 0.6)'
            : '0 4px 12px rgba(37, 99, 235, 0.35)',
        },
      },
      containedSecondary: {
        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        color: '#ffffff',
        '&:hover': {
          background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
        },
      },
      outlined: {
        borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : '#e2e8f0',
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.6)',
        '&:hover': {
          borderColor: isDark ? 'rgba(255, 255, 255, 0.3)' : '#cbd5e1',
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f8fafc',
        },
      },
    },
  },
  MuiCard: {
    styleOverrides: {
      root: {
        borderRadius: 14,
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
        backgroundColor: isDark ? '#131b2e' : '#ffffff',
        boxShadow: isDark
          ? '0 4px 20px -2px rgba(0, 0, 0, 0.5)'
          : '0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.05)',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : '#cbd5e1',
          boxShadow: isDark
            ? '0 8px 30px -4px rgba(0, 0, 0, 0.6)'
            : '0 8px 24px -4px rgba(15, 23, 42, 0.08), 0 2px 6px -2px rgba(15, 23, 42, 0.04)',
        },
      },
    },
  },
  MuiPaper: {
    styleOverrides: {
      root: {
        backgroundImage: 'none',
      },
      rounded: {
        borderRadius: 12,
      },
      elevation1: {
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
        boxShadow: isDark
          ? '0 4px 16px rgba(0, 0, 0, 0.4)'
          : '0 1px 3px rgba(15, 23, 42, 0.06)',
      },
    },
  },
  MuiChip: {
    styleOverrides: {
      root: {
        borderRadius: 6,
        fontWeight: 600,
        fontSize: '0.75rem',
        letterSpacing: '0.02em',
      },
    },
  },
  MuiTableCell: {
    styleOverrides: {
      root: {
        borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#f1f5f9',
        padding: '12px 16px',
        fontSize: '0.875rem',
      },
      head: {
        fontWeight: 700,
        fontSize: '0.75rem',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: isDark ? '#94a3b8' : '#64748b',
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc',
        borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0'}`,
      },
    },
  },
  MuiTableRow: {
    styleOverrides: {
      root: {
        transition: 'background-color 0.15s ease',
        '&:hover': {
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03) !important' : '#f8fafc !important',
        },
      },
    },
  },
  MuiOutlinedInput: {
    styleOverrides: {
      root: {
        borderRadius: 8,
        transition: 'all 0.15s ease-in-out',
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : '#e2e8f0',
        },
        '&:hover .MuiOutlinedInput-notchedOutline': {
          borderColor: isDark ? 'rgba(255, 255, 255, 0.28)' : '#cbd5e1',
        },
        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
          borderColor: '#2563eb',
          borderWidth: 2,
          boxShadow: isDark
            ? '0 0 0 4px rgba(37, 99, 235, 0.25)'
            : '0 0 0 4px rgba(37, 99, 235, 0.12)',
        },
      },
      input: {
        padding: '10.5px 14px',
        fontSize: '0.875rem',
      },
    },
  },
  MuiDialog: {
    styleOverrides: {
      paper: {
        borderRadius: 16,
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : '#e2e8f0'}`,
        boxShadow: isDark
          ? '0 24px 48px -12px rgba(0, 0, 0, 0.8)'
          : '0 24px 48px -12px rgba(15, 23, 42, 0.18)',
      },
    },
  },
});

export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    ...baseColors,
    background: {
      default: '#f8fafc', // Clean crisp slate
      paper: '#ffffff',
    },
    text: {
      primary: '#0f172a',
      secondary: '#475569',
      disabled: '#94a3b8',
    },
    divider: '#e2e8f0',
    action: {
      hover: '#f1f5f9',
      selected: '#e2e8f0',
    },
  },
  typography,
  shape: {
    borderRadius: 8,
  },
  components: {
    ...commonComponentOverrides(false),
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(16px)',
          color: '#0f172a',
          boxShadow: 'none',
          borderBottom: '1px solid #e2e8f0',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: '#090d16',
          color: '#f8fafc',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        },
      },
    },
  },
});

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    ...baseColors,
    background: {
      default: '#080c14', // Deep obsidian
      paper: '#0f1626',   // Surface
    },
    text: {
      primary: '#f8fafc',
      secondary: '#94a3b8',
      disabled: '#64748b',
    },
    divider: 'rgba(255, 255, 255, 0.08)',
    action: {
      hover: 'rgba(255, 255, 255, 0.04)',
      selected: 'rgba(255, 255, 255, 0.08)',
    },
  },
  typography,
  shape: {
    borderRadius: 8,
  },
  components: {
    ...commonComponentOverrides(true),
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(15, 22, 38, 0.85)',
          backdropFilter: 'blur(16px)',
          color: '#f8fafc',
          boxShadow: 'none',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: '#070a10',
          color: '#f8fafc',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        },
      },
    },
  },
});
