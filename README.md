# BeybladeX Tournament Management System

A modern Next.js application for managing Beyblade tournaments with Challonge integration.

## Features

- **Dynamic Tournament Routing**: Access tournaments via `/playerxjudge/{challongeId}`
- **Dual Access System**: 
  - Judge panel with QR scanning and match scoring
  - Player dashboard with statistics and match history
- **Real-time Match Management**: Score submission and tracking
- **QR Code Scanning**: Built-in camera support for judges
- **Screenshot Functionality**: Capture and save match moments
- **Local Storage**: Persistent data storage for offline functionality

## Technology Stack

- **Frontend**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React hooks with localStorage
- **Camera Access**: WebRTC getUserMedia API
- **Build Tool**: Next.js built-in build system

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn package manager

### Installation

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) with your browser.

### Usage

1. **Home Page**: Enter a Challonge tournament ID
2. **Tournament Access**: Choose between Judge or Player access
3. **Judge Features**:
   - Login with password (default: `judgepass123`)
   - QR code scanning with camera
   - Match scoring system
   - Match management
4. **Player Features**:
   - Enter player name
   - View personal statistics
   - Track match history

## Configuration

### Judge Passwords

Edit `src/app/api/judge-login/route.ts` to configure tournament-specific passwords:

```typescript
const JUDGE_PASSWORDS = {
  'default': 'judgepass123',
  'tournament123': 'custompass',
};
```

### Challonge Integration

To connect with real Challonge tournaments:

1. Get your Challonge API key
2. Update the API routes in `src/app/api/tournaments/`
3. Replace mock data with actual API calls

## Project Structure

```
src/
├── app/
│   ├── api/                 # API routes
│   ├── playerxjudge/
│   │   └── [challongeId]/   # Dynamic tournament pages
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx             # Home page
└── components/
    ├── JudgeLogin.tsx       # Judge authentication
    ├── JudgePanel.tsx       # Judge dashboard
    └── PlayerDashboard.tsx  # Player interface
```

## Features in Detail

### Dynamic Routing
- URL format: `/playerxjudge/{challongeId}`
- Each tournament has its own isolated space
- Persistent sessions per tournament

### Judge Panel
- Password-protected access
- QR code scanner with camera
- Screenshot capture functionality
- Match scoring with increment/decrement controls
- Complete match management system

### Player Dashboard
- Name-based identification
- Personal statistics (wins/losses/total)
- Match history with timestamps
- Responsive design for mobile use

## Development

### Building for Production

```bash
npm run build
npm start
```

### Linting

```bash
npm run lint
```

## Deployment

This Next.js application can be deployed on:

- Vercel (recommended)
- Netlify
- Any Node.js hosting platform

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License.