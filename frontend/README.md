# wPlanner Frontend

A modern React application for worship team planning and management.

## Features

- **User Authentication**: Secure login and registration
- **Event Management**: Create and manage worship events
- **Team Management**: Organize worship teams and assignments
- **Song Library**: Maintain a comprehensive song database
- **Setlist Planning**: Create and manage worship setlists
- **Real-time Chat**: Communicate with team members during events
- **Production Planning**: Coordinate technical aspects of services
- **PWA Support**: Installable progressive web app
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

- **React 18** with hooks
- **Redux Toolkit** for state management
- **Material-UI** for components
- **React Router** for navigation
- **Axios** for API calls
- **Socket.io** for real-time features
- **Vite** for build tooling
- **Jest** for testing
- **ESLint & Prettier** for code quality

## Getting Started

### Prerequisites

- Node.js 16+
- npm or yarn

### Installation

1. Clone the repository
2. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Copy environment variables:
   ```bash
   cp .env.example .env.local
   ```
5. Start the development server:
   ```bash
   npm run dev
   ```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run format` - Format code with Prettier

## Project Structure

```
src/
├── components/
│   ├── common/          # Shared components
│   └── NotificationBell.jsx
├── pages/               # Page components
├── services/            # API services
├── store/               # Redux store
│   ├── slices/          # Redux slices
│   └── index.js
├── hooks/               # Custom hooks
├── App.jsx
├── main.jsx
└── index.css
```

## Environment Variables

Create a `.env.local` file with:

```
VITE_API_BASE_URL=http://localhost:3000/api
VITE_SOCKET_URL=http://localhost:3000
```

## Testing

Run tests with:

```bash
npm run test
```

## Building for Production

```bash
npm run build
```

The build artifacts will be stored in the `dist/` directory.

## Deployment

The app is configured as a PWA and can be deployed to any static hosting service like Vercel, Netlify, or GitHub Pages.

## Contributing

1. Follow the existing code style
2. Run linting and tests before committing
3. Use conventional commit messages
4. Test on multiple devices/browsers

## License

This project is licensed under the MIT License.
