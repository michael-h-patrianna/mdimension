# N-Dimensional Object Visualizer

A React + TypeScript application for visualizing N-dimensional objects using Three.js, with support for interactive 3D projections and transformations.

## Features

- Interactive 3D visualization with Three.js
- React Three Fiber for declarative 3D scene management
- TypeScript strict mode with comprehensive type safety
- State management with Zustand
- Tailwind CSS with dark theme
- Modern build tooling with Vite
- Comprehensive testing setup with Vitest

## Tech Stack

- **Frontend Framework**: React 18+
- **3D Rendering**: Three.js, @react-three/fiber, @react-three/drei
- **Language**: TypeScript (strict mode)
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Testing**: Vitest + React Testing Library
- **Code Quality**: ESLint + Prettier

## Project Structure

```
src/
├── components/           # React components
│   ├── canvas/          # Three.js canvas components
│   ├── controls/        # UI control panel components
│   └── ui/              # Generic UI components
├── lib/                 # Core libraries
│   ├── math/            # N-dimensional math utilities
│   ├── geometry/        # Object generation algorithms
│   └── projection/      # Projection algorithms
├── hooks/               # Custom React hooks
├── stores/              # Zustand state management
├── types/               # TypeScript type definitions
├── utils/               # Utility functions
└── tests/               # Test files and setup
```

## Getting Started

### Prerequisites

- Node.js 18+ (recommended: use LTS version)
- npm or pnpm

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create environment file (optional):
```bash
cp .env.example .env
```

### Development

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Building for Production

Build the application:
```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm test` - Run tests once
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Lint code with ESLint
- `npm run format` - Format code with Prettier

## Testing

The project uses Vitest for unit and integration tests, with React Testing Library for component testing.

Run tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

## Path Aliases

The project is configured with the following path aliases:

- `@/` → `src/`
- `@/components` → `src/components`
- `@/lib` → `src/lib`
- `@/hooks` → `src/hooks`
- `@/stores` → `src/stores`
- `@/types` → `src/types`
- `@/utils` → `src/utils`

Example usage:
```typescript
import { Scene } from '@/components/canvas/Scene'
import { useStore } from '@/stores'
```

## Code Quality

The project enforces strict TypeScript rules:
- No implicit `any` types
- Strict null checks
- Unused variables/parameters detection
- No fallthrough cases in switch statements

ESLint and Prettier are configured to maintain consistent code style.

## Development Guidelines

See `CLAUDE.md` for detailed development guidelines, testing requirements, and folder usage rules.

## License

MIT
