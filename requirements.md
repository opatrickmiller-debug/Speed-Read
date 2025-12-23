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
- **server.py**: Main API server
  - `GET /api/` - Health check
  - `GET /api/speed-limit?lat={lat}&lon={lon}` - Fetches speed limit from OpenStreetMap

### Frontend (React)
- **pages/SpeedMap.jsx**: Main page with Google Maps overlay
- **components/Speedometer.jsx**: Large speed display with dynamic coloring
- **components/SpeedLimitSign.jsx**: Road sign style speed limit display  
- **components/AlertOverlay.jsx**: Full screen red flash + audio alarm
- **components/SettingsPanel.jsx**: Settings with toggles and sliders

### Key Features Implemented
- ✅ Real-time GPS tracking with speed calculation
- ✅ Speed limit fetching from OpenStreetMap Overpass API
- ✅ Visual alert (red border flash) when speeding
- ✅ Audio alarm (oscillator-based) when speeding
- ✅ Demo mode for testing without GPS
- ✅ Settings: audio toggle, speed unit (mph/km/h), threshold offset
- ✅ Dark "Pilot HUD" theme aesthetic
- ✅ Mobile-responsive design

### Design System
- **Fonts**: Chivo (headings/speed), JetBrains Mono (labels)
- **Colors**: Dark zinc base, Orange warning, Sky blue safe, Red danger
- **Style**: Glassmorphism panels, HUD-inspired aesthetic

## Next Tasks / Enhancements
1. Upgrade Google Maps Marker to AdvancedMarkerElement (deprecation warning)
2. Add speed history/trip logging feature
3. Add offline caching for speed limits
4. Add voice announcements for speed alerts
5. Add customizable alarm sounds
6. Add multi-language support
