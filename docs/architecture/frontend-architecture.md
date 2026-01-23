# Frontend Architecture - TenpennyNovels

## Overview

TenpennyNovels implementa un'architettura frontend multi-applicazione basata su Next.js 14, con design system Victorian centralizzato e integrazione WebSocket per features real-time.

## 🏗️ Multi-Application Architecture

### 6 Applicazioni Frontend (Ports 4000-4005)

#### Landing App (Port 4000)
- **Scopo**: Login, character selection, onboarding
- **Features**: NextAuth.js authentication, character chooser, initial Victorian atmosphere
- **Stack**: Next.js 14, NextAuth.js, SCSS Victorian theme

#### Game App (Port 4001)
- **Scopo**: Main gameplay interface, character management
- **Features**: Character sheet, location navigation, messaging systems, real-time gameplay
- **Stack**: Next.js 14, Socket.io client, Victorian UI components

#### Documents App (Port 4002)  
- **Scopo**: Ambientazione, rules, content management
- **Features**: Rich text editor, document versioning, Victorian-styled content presentation
- **Stack**: Next.js 14, Rich text editing, Content management

#### Forum App (Port 4003)
- **Scopo**: Community discussions, topic management
- **Features**: Victorian-themed forum, discussion threads, community features
- **Stack**: Next.js 14, Real-time updates, Community tools

#### Management App (Port 4004)
- **Scopo**: Administrative interface, analytics dashboards
- **Features**: Complete admin panel for all systems, analytics, user management
- **Stack**: Next.js 14, Chart libraries, Admin UI components

#### Tickets App (Port 4005)
- **Scopo**: Support system, help desk
- **Features**: Ticket creation, tracking, admin resolution tools
- **Stack**: Next.js 14, Support workflows, Status tracking

## 🎨 Victorian Design System

### Centralized SCSS Architecture
```scss
// Design system structure
apps/shared-ui/src/styles/
├── _main.scss              // Master import file
├── tokens/                 // Design tokens
│   ├── _colors.scss        // Victorian color palette
│   ├── _typography.scss    // Period-appropriate fonts
│   ├── _spacing.scss       // Consistent spacing system
│   └── _shadows.scss       // Victorian depth and elegance
├── mixins/                 // Reusable patterns
│   ├── _buttons.scss       // Victorian button styles
│   ├── _forms.scss         // Period-appropriate form elements
│   ├── _cards.scss         // Elegant card components
│   └── _layout.scss        // Grid and layout systems
└── components/             // Component-specific styles
    ├── _navigation.scss    // Victorian navigation patterns
    ├── _modals.scss        // Period-appropriate overlays
    └── _tables.scss        // Data presentation styles
```

### Victorian Color Palette
```scss
// Primary Victorian colors
$gold-primary: #D4AF37;      // Rich Victorian gold
$burgundy-primary: #800020;  // Deep burgundy
$navy-primary: #1B2951;      // Victorian navy
$cream-primary: #F5F5DC;     // Elegant cream

// Supporting colors
$brown-leather: #8B4513;     // Rich leather brown
$green-victorian: #228B22;   // Period green
$purple-royal: #663399;      // Royal purple accent
```

### Typography System
```scss
// Victorian-inspired typography
$font-heading: 'Playfair Display', serif;    // Elegant headings
$font-body: 'Source Serif Pro', serif;       // Readable body text
$font-accent: 'Crimson Text', serif;         // Special accents
$font-mono: 'JetBrains Mono', monospace;     // Code/data display
```

## 🔌 Next.js Configuration

### Shared Configuration Pattern
```javascript
// next.config.js (shared pattern across all apps)
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // SCSS configuration
  sassOptions: {
    includePaths: ['../shared-ui/src/styles'],
    prependData: `@import 'main';`
  },
  
  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_WEBSOCKET_URL: process.env.NEXT_PUBLIC_WEBSOCKET_URL
  },
  
  // Image optimization
  images: {
    domains: ['localhost'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    formats: ['image/webp', 'image/avif']
  },
  
  // Performance optimization
  experimental: {
    optimizeCss: true,
    scrollRestoration: true
  }
};
```

## 🔐 Authentication Integration

### NextAuth.js Configuration
```javascript
// Dual-token system integration
export default NextAuth({
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials)
        });
        
        if (response.ok) {
          const { auth_token, character_context } = await response.json();
          return {
            auth_token,
            character_context,
            // Additional user data
          };
        }
        return null;
      }
    })
  ],
  
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.auth_token = user.auth_token;
        token.character_context = user.character_context;
      }
      return token;
    },
    
    async session({ session, token }) {
      session.auth_token = token.auth_token;
      session.character_context = token.character_context;
      return session;
    }
  },
  
  // Cross-domain cookie configuration
  cookies: {
    sessionToken: {
      name: 'next-auth.session-token',
      options: {
        domain: '.localhost',  // Shared across subdomains in development
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production'
      }
    }
  }
});
```

## 🔄 Real-time Integration

### Socket.io Client Setup
```typescript
// WebSocket context for real-time features
import { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  const connect = () => {
    const newSocket = io(process.env.NEXT_PUBLIC_WEBSOCKET_URL!, {
      transports: ['websocket', 'polling'],
      upgrade: true,
      rememberUpgrade: true
    });
    
    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('WebSocket connected');
    });
    
    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('WebSocket disconnected');
    });
    
    setSocket(newSocket);
  };
  
  const disconnect = () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
    }
  };
  
  useEffect(() => {
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [socket]);
  
  return (
    <WebSocketContext.Provider value={{ socket, isConnected, connect, disconnect }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
};
```

## 📱 Responsive Design Strategy

### Mobile-First Victorian Approach
```scss
// Breakpoint system
$breakpoints: (
  mobile: 320px,
  tablet: 768px,
  desktop: 1024px,
  wide: 1440px
);

// Victorian-themed responsive mixins
@mixin victorian-mobile {
  @media (max-width: map-get($breakpoints, tablet) - 1px) {
    @content;
  }
}

@mixin victorian-tablet {
  @media (min-width: map-get($breakpoints, tablet)) and (max-width: map-get($breakpoints, desktop) - 1px) {
    @content;
  }
}

@mixin victorian-desktop {
  @media (min-width: map-get($breakpoints, desktop)) {
    @content;
  }
}

// Responsive Victorian card component
.victorian-card {
  background: $cream-primary;
  border: 2px solid $gold-primary;
  border-radius: 8px;
  padding: $spacing-md;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  
  @include victorian-mobile {
    padding: $spacing-sm;
    margin: $spacing-xs;
  }
  
  @include victorian-tablet {
    padding: $spacing-md;
    margin: $spacing-sm;
  }
  
  @include victorian-desktop {
    padding: $spacing-lg;
    margin: $spacing-md;
  }
}
```

## 🧩 Component Architecture

### Victorian UI Component Library
```typescript
// Base Victorian Button component
interface VictorianButtonProps {
  variant: 'primary' | 'secondary' | 'elegant' | 'danger';
  size: 'small' | 'medium' | 'large';
  isLoading?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export const VictorianButton: React.FC<VictorianButtonProps> = ({
  variant,
  size,
  isLoading,
  children,
  onClick,
  className
}) => {
  const baseClasses = 'victorian-button';
  const variantClasses = `victorian-button--${variant}`;
  const sizeClasses = `victorian-button--${size}`;
  const loadingClasses = isLoading ? 'victorian-button--loading' : '';
  
  return (
    <button
      className={`${baseClasses} ${variantClasses} ${sizeClasses} ${loadingClasses} ${className || ''}`}
      onClick={onClick}
      disabled={isLoading}
    >
      {isLoading ? <VictorianSpinner /> : children}
    </button>
  );
};

// Victorian Character Sheet component
interface CharacterSheetProps {
  character: Character;
  onUpdate: (updates: Partial<Character>) => void;
  isEditable?: boolean;
}

export const VictorianCharacterSheet: React.FC<CharacterSheetProps> = ({
  character,
  onUpdate,
  isEditable = false
}) => {
  return (
    <div className="victorian-character-sheet">
      <VictorianCard className="character-header">
        <h2 className="character-name">{character.name}</h2>
        <p className="character-occupation">{character.occupation}</p>
      </VictorianCard>
      
      <VictorianTabs>
        <VictorianTab label="Statistics">
          <CharacterStats stats={character.stats} onUpdate={onUpdate} isEditable={isEditable} />
        </VictorianTab>
        
        <VictorianTab label="Skills">
          <CharacterSkills skills={character.skills} onUpdate={onUpdate} isEditable={isEditable} />
        </VictorianTab>
        
        <VictorianTab label="Progression">
          <CharacterProgression characterId={character._id} />
        </VictorianTab>
        
        <VictorianTab label="Equipment">
          <CharacterEquipment equipment={character.equipment} onUpdate={onUpdate} />
        </VictorianTab>
      </VictorianTabs>
    </div>
  );
};
```

## 🔄 State Management

### React Context Pattern for Game State
```typescript
// Game state context for character and session data
interface GameStateContextType {
  character: Character | null;
  currentLocation: Location | null;
  activeSession: GamingSession | null;
  notifications: Notification[];
  updateCharacter: (updates: Partial<Character>) => void;
  setLocation: (location: Location) => void;
  joinSession: (session: GamingSession) => void;
  addNotification: (notification: Notification) => void;
}

export const GameStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [character, setCharacter] = useState<Character | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [activeSession, setActiveSession] = useState<GamingSession | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  const updateCharacter = (updates: Partial<Character>) => {
    if (character) {
      setCharacter({ ...character, ...updates });
    }
  };
  
  const setLocation = (location: Location) => {
    setCurrentLocation(location);
  };
  
  const joinSession = (session: GamingSession) => {
    setActiveSession(session);
  };
  
  const addNotification = (notification: Notification) => {
    setNotifications(prev => [notification, ...prev]);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 5000);
  };
  
  return (
    <GameStateContext.Provider value={{
      character,
      currentLocation,
      activeSession,
      notifications,
      updateCharacter,
      setLocation,
      joinSession,
      addNotification
    }}>
      {children}
    </GameStateContext.Provider>
  );
};
```

## 🚀 Performance Optimization

### Code Splitting and Lazy Loading
```typescript
// Lazy loading for heavy components
const VictorianCharacterSheet = lazy(() => import('../components/VictorianCharacterSheet'));
const SessionManagementPanel = lazy(() => import('../components/SessionManagementPanel'));
const CorporationDashboard = lazy(() => import('../components/CorporationDashboard'));

// Optimized loading with Victorian-themed loading states
const LazyComponent: React.FC<{ component: React.ComponentType }> = ({ component: Component }) => (
  <Suspense fallback={<VictorianLoadingSpinner />}>
    <Component />
  </Suspense>
);
```

### Image Optimization
```typescript
// Victorian-themed image optimization
import Image from 'next/image';

export const VictorianPortrait: React.FC<{ src: string, alt: string, character?: Character }> = ({ 
  src, 
  alt, 
  character 
}) => (
  <div className="victorian-portrait-frame">
    <Image
      src={src}
      alt={alt}
      width={200}
      height={250}
      priority={character?.isActive}
      className="victorian-portrait-image"
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/..."
    />
    {character && (
      <div className="victorian-portrait-nameplate">
        {character.name}
      </div>
    )}
  </div>
);
```

## 🔗 API Integration Patterns

### Unified API Client
```typescript
// Centralized API client with error handling
class TenpennyNovelsAPI {
  private baseURL: string;
  private auth: AuthContextType;
  
  constructor(baseURL: string, auth: AuthContextType) {
    this.baseURL = baseURL;
    this.auth = auth;
  }
  
  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include', // Include cookies for authentication
    };
    
    // Add character context if available
    if (this.auth.character_context) {
      config.headers['X-Character-Context'] = this.auth.character_context;
    }
    
    const response = await fetch(url, config);
    
    if (!response.ok) {
      throw new APIError(
        `API request failed: ${response.status} ${response.statusText}`,
        response.status,
        endpoint
      );
    }
    
    return response.json();
  }
  
  // Game backend methods
  async getCharacterProgression(characterId: string): Promise<CharacterProgression> {
    return this.request(`/game/character/experience`);
  }
  
  async spendExperience(data: SpendExperienceData): Promise<SpendExperienceResult> {
    return this.request(`/game/character/experience/spend`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
  
  // Management backend methods
  async getSessionAnalytics(filters?: SessionFilters): Promise<SessionAnalytics> {
    const query = filters ? `?${new URLSearchParams(filters).toString()}` : '';
    return this.request(`/admin/sessions/analytics${query}`);
  }
}
```

## 📊 Development Workflow

### Build and Development Scripts
```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:landing\" \"npm run dev:game\" \"npm run dev:documents\" \"npm run dev:forum\" \"npm run dev:management\" \"npm run dev:tickets\"",
    "dev:landing": "cd apps/landing && npm run dev",
    "dev:game": "cd apps/game && npm run dev", 
    "dev:documents": "cd apps/documents && npm run dev",
    "dev:forum": "cd apps/forum && npm run dev",
    "dev:management": "cd apps/management && npm run dev",
    "dev:tickets": "cd apps/tickets && npm run dev",
    "build": "npm run build:shared && npm run build:apps",
    "build:shared": "cd apps/shared-ui && npm run build",
    "build:apps": "concurrently \"npm run build:landing\" \"npm run build:game\" \"npm run build:documents\" \"npm run build:forum\" \"npm run build:management\" \"npm run build:tickets\"",
    "lint": "npm run lint:apps",
    "lint:apps": "concurrently \"npm run lint:landing\" \"npm run lint:game\" \"npm run lint:documents\" \"npm run lint:forum\" \"npm run lint:management\" \"npm run lint:tickets\"",
    "test": "npm run test:apps",
    "test:apps": "concurrently \"npm run test:landing\" \"npm run test:game\" \"npm run test:documents\" \"npm run test:forum\" \"npm run test:management\" \"npm run test:tickets\""
  }
}
```

## 🎯 Integration Requirements

### Backend Service Communication
- **Authentication Integration**: NextAuth.js with dual-token JWT system
- **Real-time Features**: Socket.io client for live gameplay updates
- **API Communication**: RESTful APIs with proper error handling and loading states
- **State Synchronization**: Character data, session state, location updates

### Cross-Application Data Sharing
- **Shared Authentication State**: Cross-domain cookie sharing
- **Character Context**: Consistent character data across all apps
- **Real-time Synchronization**: WebSocket events for live updates
- **Design System Consistency**: Shared SCSS and component library

This frontend architecture provides a comprehensive foundation for the 6-application Victorian RPG platform with modern performance, authentic design, and seamless user experience across all game features.