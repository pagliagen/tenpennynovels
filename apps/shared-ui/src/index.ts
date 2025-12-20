// TenpennyNovels Shared UI Components
// Main export file

// Components
export * from './components/Button';
export * from './components/Input';
export * from './components/Card';

// Styles (import this in your main app)
// export { default as styles } from './styles/index.scss';

// Utility types
export interface Theme {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    border: string;
    borderAccent: string;
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  fonts: {
    display: string[];
    heading: string[];
    body: string[];
    ui: string[];
    mono: string[];
  };
  spacing: Record<string, string>;
  borderRadius: Record<string, string>;
  shadows: Record<string, string>;
  breakpoints: Record<string, string>;
}

// Victorian theme configuration
export const victorianTheme: Theme = {
  colors: {
    primary: '#ff9500',
    secondary: '#2d5a5a',
    background: '#000000',
    surface: '#1a1a1a',
    textPrimary: '#ff9500',
    textSecondary: '#ffffff',
    textMuted: '#888888',
    border: '#333333',
    borderAccent: '#ff9500',
    success: '#4caf50',
    warning: '#ff9800',
    error: '#f44336',
    info: '#2196f3'
  },
  fonts: {
    display: ['Creepster', 'Chiller', 'Nosifer', 'cursive'],
    heading: ['Cinzel', 'Playfair Display', 'Times New Roman', 'serif'],
    body: ['Crimson Text', 'Lora', 'Georgia', 'serif'],
    ui: ['Inter', 'Segoe UI', 'Roboto', 'sans-serif'],
    mono: ['Fira Code', 'Monaco', 'Consolas', 'monospace']
  },
  spacing: {
    '0': '0',
    '1': '0.25rem',
    '2': '0.5rem',
    '3': '0.75rem',
    '4': '1rem',
    '5': '1.25rem',
    '6': '1.5rem',
    '8': '2rem',
    '10': '2.5rem',
    '12': '3rem',
    '16': '4rem',
    '20': '5rem',
    '24': '6rem',
    '32': '8rem',
    '40': '10rem',
    '48': '12rem',
    '56': '14rem',
    '64': '16rem'
  },
  borderRadius: {
    'none': '0',
    'sm': '0.125rem',
    'base': '0.25rem',
    'md': '0.375rem',
    'lg': '0.5rem',
    'xl': '0.75rem',
    '2xl': '1rem',
    '3xl': '1.5rem',
    'full': '9999px'
  },
  shadows: {
    'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    'base': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    'inner': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
    'gold-glow': '0 0 20px rgba(255, 149, 0, 0.3)',
    'gold-glow-strong': '0 0 30px rgba(255, 149, 0, 0.5)',
    'victorian-card': '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 20px rgba(255, 149, 0, 0.1)'
  },
  breakpoints: {
    'sm': '640px',
    'md': '768px',
    'lg': '1024px',
    'xl': '1280px',
    '2xl': '1536px'
  }
};