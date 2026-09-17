import { createTheme } from '@mui/material/styles';

// Disciplined neutral foundation with precision accent
const baseColors = {
  primary: {
    main: '#ff4d28', // Sunset Tangerine Coral (Noir)
    light: '#ff6f4f',
    dark: '#e63e18',
    contrastText: '#ffffff',
  },
  secondary: {
    main: '#52525b', // Neutral Zinc
    light: '#71717a',
    dark: '#3f3f46',
    contrastText: '#ffffff',
  },
  success: {
    main: '#10b981', // Emerald
    light: '#34d399',
    dark: '#059669',
    contrastText: '#ffffff',
  },
  warning: {
    main: '#f59e0b', // Amber
    light: '#fbbf24',
    dark: '#d97706',
    contrastText: '#0f172a',
  },
  error: {
    main: '#ef4444', // Crimson
    light: '#f87171',
    dark: '#dc2626',
    contrastText: '#ffffff',
  },
  info: {
    main: '#0284c7', // Slate Blue
    light: '#38bdf8',
    dark: '#0369a1',
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
    fontSize: '2rem',
    fontWeight: 700,
    lineHeight: 1.25,
    letterSpacing: '-0.025em',
  },
  h2: {
    fontSize: '1.625rem',
    fontWeight: 700,
    lineHeight: 1.3,
    letterSpacing: '-0.02em',
  },
  h3: {
    fontSize: '1.375rem',
    fontWeight: 600,
    lineHeight: 1.35,
    letterSpacing: '-0.015em',
  },
  h4: {
    fontSize: '1.125rem',
    fontWeight: 600,
    lineHeight: 1.4,
    letterSpacing: '-0.01em',
  },
  h5: {
    fontSize: '1rem',
    fontWeight: 600,
    lineHeight: 1.45,
    letterSpacing: '-0.005em',
  },
  h6: {
    fontSize: '0.875rem',
    fontWeight: 600,
    lineHeight: 1.5,
  },
  subtitle1: {
    fontSize: '0.9375rem',
    fontWeight: 500,
    lineHeight: 1.5,
  },
  subtitle2: {
    fontSize: '0.8125rem',
    fontWeight: 600,
    lineHeight: 1.5,
    letterSpacing: '0.005em',
  },
  body1: {
    fontSize: '0.875rem',
    lineHeight: 1.55,
  },
  body2: {
    fontSize: '0.8125rem',
    lineHeight: 1.5,
  },
  button: {
    textTransform: 'none',
    fontWeight: 600,
    fontSize: '0.8125rem',
    letterSpacing: '0.005em',
  },
  caption: {
    fontSize: '0.75rem',
    lineHeight: 1.4,
    letterSpacing: '0.01em',
  },
  overline: {
    fontSize: '0.6875rem',
    fontWeight: 700,
    letterSpacing: '0.06em',
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
        borderRadius: 6,
        padding: '6px 14px',
        fontSize: '0.8125rem',
        fontWeight: 600,
        transition: 'background-color 120ms ease, border-color 120ms ease, color 120ms ease',
        '&:hover': {
          transform: 'none', // No tacky float animations
        },
      },
      sizeSmall: {
        padding: '4px 10px',
        fontSize: '0.75rem',
        borderRadius: 5,
      },
      sizeLarge: {
        padding: '9px 18px',
        fontSize: '0.875rem',
        borderRadius: 7,
      },
      containedPrimary: {
        backgroundColor: '#ff4d28',
        color: '#ffffff',
        border: '1px solid #e63e18',
        boxShadow: '0 2px 8px rgba(255, 77, 40, 0.25)',
        '&:hover': {
          backgroundColor: '#e63e18',
          borderColor: '#d43511',
          boxShadow: '0 4px 14px rgba(255, 77, 40, 0.35)',
        },
      },
      containedSecondary: {
        backgroundColor: isDark ? '#18181b' : '#f4f4f5',
        color: isDark ? '#f4f4f5' : '#09090b',
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : '#e4e4e7'}`,
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
        '&:hover': {
          backgroundColor: isDark ? '#27272a' : '#e4e4e7',
        },
      },
      outlined: {
        borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : '#cbd5e1',
        backgroundColor: 'transparent',
        color: isDark ? '#f4f4f5' : '#0f172a',
        '&:hover': {
          borderColor: isDark ? 'rgba(255, 255, 255, 0.28)' : '#94a3b8',
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#f8fafc',
        },
      },
    },
  },
  MuiCard: {
    styleOverrides: {
      root: {
        borderRadius: 14,
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
        backgroundColor: isDark ? '#0e0e0e' : '#ffffff',
        boxShadow: isDark
          ? '0 4px 24px rgba(0, 0, 0, 0.7)'
          : '0 1px 3px rgba(15, 23, 42, 0.04)',
        backgroundImage: 'none',
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
          ? '0 4px 24px rgba(0, 0, 0, 0.7)'
          : '0 1px 3px rgba(15, 23, 42, 0.04)',
      },
      elevation0: {
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
      },
    },
  },
  MuiChip: {
    styleOverrides: {
      root: {
        borderRadius: 4,
        fontWeight: 600,
        fontSize: '0.75rem',
        height: 22,
      },
      sizeSmall: {
        height: 20,
        fontSize: '0.6875rem',
      },
    },
  },
  MuiTableCell: {
    styleOverrides: {
      root: {
        borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#f1f5f9',
        padding: '10px 14px',
        fontSize: '0.8125rem',
      },
      head: {
        fontWeight: 600,
        fontSize: '0.6875rem',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: isDark ? '#a1a1aa' : '#64748b',
        backgroundColor: isDark ? '#0c0c0c' : '#f8fafc',
        borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
      },
    },
  },
  MuiTableRow: {
    styleOverrides: {
      root: {
        transition: 'background-color 100ms ease',
        '&:hover': {
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03) !important' : '#f8fafc !important',
        },
      },
    },
  },
  MuiInputLabel: {
    styleOverrides: {
      root: {
        fontSize: '0.875rem',
        color: isDark ? '#a1a1aa' : '#64748b',
        '&.Mui-focused': {
          color: '#ff4d28',
        },
      },
      outlined: {
        transform: 'translate(14px, 11px) scale(1)',
        '&.MuiInputLabel-shrink': {
          transform: 'translate(14px, -8px) scale(0.75)',
          backgroundColor: isDark ? '#0c0c0c' : '#ffffff',
          padding: '0 4px',
          borderRadius: 2,
        },
      },
    },
  },
  MuiOutlinedInput: {
    styleOverrides: {
      root: {
        borderRadius: 8,
        backgroundColor: isDark ? '#0c0c0c' : '#ffffff',
        transition: 'border-color 120ms ease, box-shadow 120ms ease',
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#cbd5e1',
        },
        '&:hover .MuiOutlinedInput-notchedOutline': {
          borderColor: isDark ? 'rgba(255, 255, 255, 0.24)' : '#94a3b8',
        },
        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
          borderColor: '#ff4d28',
          borderWidth: 1.5,
          boxShadow: isDark
            ? '0 0 0 3px rgba(255, 77, 40, 0.2)'
            : '0 0 0 3px rgba(255, 77, 40, 0.12)',
        },
      },
      input: {
        padding: '11px 14px',
        fontSize: '0.875rem',
        lineHeight: 1.5,
        color: isDark ? '#ffffff' : '#0f172a',
        '&::placeholder': {
          color: isDark ? '#71717a' : '#94a3b8',
          opacity: 1,
        },
        '&:-webkit-autofill': {
          WebkitBoxShadow: isDark
            ? '0 0 0 1000px #0c0c0c inset !important'
            : '0 0 0 1000px #ffffff inset !important',
          WebkitTextFillColor: isDark ? '#ffffff !important' : '#0f172a !important',
          caretColor: isDark ? '#ffffff !important' : '#0f172a !important',
          transition: 'background-color 5000s ease-in-out 0s !important',
        },
      },
    },
  },
  MuiDialog: {
    styleOverrides: {
      paper: {
        borderRadius: 14,
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0'}`,
        backgroundColor: isDark ? '#0e0e0e' : '#ffffff',
        boxShadow: isDark
          ? '0 24px 48px rgba(0, 0, 0, 0.9)'
          : '0 16px 36px rgba(15, 23, 42, 0.12)',
      },
    },
  },
});

export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    ...baseColors,
    background: {
      default: '#f8fafc',
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
          backgroundColor: '#ffffff',
          color: '#0f172a',
          boxShadow: 'none',
          borderBottom: '1px solid #e2e8f0',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#ffffff',
          color: '#0f172a',
          borderRight: '1px solid #e2e8f0',
        },
      },
    },
  },
});

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    ...baseColors,
    primary: {
      main: '#ff4d28', // Noir Sunset Coral
      light: '#ff6f4f',
      dark: '#e63e18',
      contrastText: '#ffffff',
    },
    background: {
      default: '#000000', // Pitch Noir Canvas
      paper: '#0e0e0e',   // Obsidian Carbon Surface
    },
    text: {
      primary: '#ffffff', // High contrast white
      secondary: '#a1a1aa',
      disabled: '#52525b',
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
          backgroundColor: '#070707',
          color: '#ffffff',
          boxShadow: 'none',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#050505',
          color: '#ffffff',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        },
      },
    },
  },
});
