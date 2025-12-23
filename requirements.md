# Speed Alert Map App - Requirements & Architecture

## Original Problem Statement
Build an app that overlays on Google Maps that allows user to set an alarm to go off when they are speeding. Adjustable speed setting that changes as the speed on the map changes.

## User Choices
1. Speed limits fetched from third-party API (OpenStreetMap Overpass API)
2. Both visual and audio alerts when speeding
3. Core speeding alarm feature only (no history/logs)
4. No authentication (local settings)
5. Google Maps with user-provided API key

## Architecture

### Backend (FastAPI)
- **server.py**: Main API server with security features
  - `POST /api/auth/register` - User registration (rate limited: 5/min)
  - `POST /api/auth/login` - User login with JWT (rate limited: 10/min)
  - `GET /api/auth/me` - Get current user info (requires auth)
  - `GET /api/speed-limit` - Fetch speed limit from OpenStreetMap (rate limited: 30/min)
  - `POST /api/trips/start` - Start trip recording (requires auth)
  - `POST /api/trips/data-point` - Record data point (requires auth)
  - `POST /api/trips/end` - End trip (requires auth)
  - `GET /api/trips` - List user's trips (requires auth)
  - `DELETE /api/trips/{id}` - Delete trip (requires auth, owner only)

### Security Features
- **JWT Authentication**: Secure token-based auth with 7-day expiry
- **Password Hashing**: bcrypt with automatic salting
- **Rate Limiting**: SlowAPI middleware protects all endpoints
- **CORS Restrictions**: Limited to specific allowed origins
- **Input Validation**: Pydantic validators for all inputs
- **User Isolation**: Users can only access their own trip data
- **Sanitization**: Road names sanitized to prevent XSS

### Frontend (React)
- **pages/SpeedMap.jsx**: Main page with Google Maps overlay
- **components/Speedometer.jsx**: Large speed display with dynamic coloring
- **components/SpeedLimitSign.jsx**: Road sign style speed limit display  
- **components/AlertOverlay.jsx**: Full screen red flash + audio alarm
- **components/SettingsPanel.jsx**: Settings with toggles and sliders

### Key Features Implemented
- ✅ Real-time GPS tracking with speed calculation
- ✅ Speed limit fetching from OpenStreetMap Overpass API
- ✅ Visual alert (red border flash + info banner) when speeding
- ✅ Audio alarm (oscillator-based beeping) when speeding
- ✅ **Voice alerts** using Web Speech API - announces when speeding starts
- ✅ **12 language support** with native translations
- ✅ **Offline caching** with geohash-based localStorage
- ✅ **Trip history logging** with MongoDB storage
- ✅ Demo mode for testing without GPS
- ✅ Settings panel with comprehensive controls
- ✅ Dark "Pilot HUD" theme aesthetic
- ✅ Mobile-responsive design
- ✅ Status indicators (Voice, Audio, Recording, Cached, Offline)

### Trip History Features
- Start/Stop recording with one click
- Tracks: max speed, avg speed, total alerts, distance, duration
- Data points recorded every 5 seconds with timestamps
- Trip list with expandable details
- Delete trips functionality
- Real-time stats display while recording

### Alert System Details
- **Visual**: Full-screen red border flash, animated corner indicators, speed comparison banner
- **Audio**: Oscillator-based alarm (800/600Hz alternating)
- **Voice**: Web Speech API with 12 languages supported:
  - 🇺🇸 English, 🇪🇸 Español, 🇫🇷 Français, 🇩🇪 Deutsch
  - 🇮🇹 Italiano, 🇧🇷 Português, 🇨🇳 中文, 🇯🇵 日本語
  - 🇰🇷 한국어, 🇮🇳 हिन्दी, 🇸🇦 العربية, 🇷🇺 Русский
- Voice announces in selected language when speeding starts, repeats every 10 seconds
- Language selector in settings with country flags
- Status indicator shows selected language flag

### Design System
- **Fonts**: Chivo (headings/speed), JetBrains Mono (labels)
- **Colors**: Dark zinc base, Orange warning, Sky blue safe, Red danger
- **Style**: Glassmorphism panels, HUD-inspired aesthetic

## Next Tasks / Enhancements
1. Upgrade Google Maps Marker to AdvancedMarkerElement (deprecation warning)
2. Add customizable alarm sounds
3. Add different voice styles/personalities
4. Add trip route visualization on map
