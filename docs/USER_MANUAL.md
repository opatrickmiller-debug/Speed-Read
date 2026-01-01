# SpeedShield User Manual

## Version 2.3.0

---

## Table of Contents

1. [What is SpeedShield?](#what-is-speedshield)
2. [Getting Started](#getting-started)
3. [Main Interface](#main-interface)
4. [Settings](#settings)
5. [Advanced Settings](#advanced-settings)
6. [Tips for Best Results](#tips-for-best-results)
7. [Troubleshooting](#troubleshooting)

---

## What is SpeedShield?

SpeedShield is a Progressive Web App (PWA) designed to help drivers stay aware of speed limits while driving. The app uses your device's GPS to track your current speed and location, then retrieves real-time speed limit data from OpenStreetMap to alert you when you're exceeding the posted limit.

### Key Features

- **Real-time Speed Monitoring** - Displays your current speed with a large, easy-to-read speedometer
- **Speed Limit Detection** - Automatically fetches speed limits based on your GPS location
- **Speeding Alerts** - Audio and voice alerts when you exceed the speed limit
- **AI Speed Prediction** - Warns you before entering lower speed zones
- **Offline Caching** - Stores speed limit data for areas you frequently drive
- **Customizable Thresholds** - Set buffer zones for when alerts trigger
- **Weather Alerts** - Notifies you of severe weather in your area
- **Works on Any Device** - Install as an app on iOS, Android, or use in any web browser

### How It Works

1. **GPS Tracking** - The app continuously reads your device's GPS to determine your location and speed
2. **Speed Limit Lookup** - Your coordinates are sent to our server, which queries OpenStreetMap's road database
3. **Comparison** - Your current speed is compared against the posted limit (plus any buffer you've set)
4. **Alert** - If you're over the limit, you'll receive audio and/or voice alerts

---

## Getting Started

### Installation (Recommended)

For the best experience, install SpeedShield as an app on your device:

**iPhone/iPad:**
1. Open Safari and navigate to the app URL
2. Tap the Share button (square with arrow)
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add" to confirm

**Android:**
1. Open Chrome and navigate to the app URL
2. Tap the menu (three dots)
3. Tap "Add to Home Screen" or "Install App"
4. Tap "Install" to confirm

**Desktop:**
1. Open Chrome/Edge and navigate to the app URL
2. Click the install icon in the address bar
3. Click "Install" to confirm

### First Launch

1. **Allow Location Access** - When prompted, allow the app to access your location. Choose "While Using the App" for best battery life
2. **Allow Notifications** (Optional) - Enable for weather alerts
3. **Tap "Get Started"** - You'll be taken to the main map view

---

## Main Interface

### Speedometer Display

The large circular speedometer in the center shows:

| Element | Description |
|---------|-------------|
| **Large Number** | Your current speed |
| **Unit** | MPH or KM/H (configurable) |
| **Status** | "SAFE" (green) or "OVER LIMIT" (red) |
| **Ring Color** | Green = safe, Yellow = approaching limit, Red = speeding |

The speedometer is draggable - press and hold to move it anywhere on screen.

### Speed Limit Sign

The speed limit sign shows:

| Element | Description |
|---------|-------------|
| **Number** | Current posted speed limit |
| **Road Name** | Name of the road you're on |
| **LAST KNOWN** | Appears when using cached data (no fresh data available) |

### Compass

The compass displays your direction of travel:
- **Fixed Arrow** - Points in your direction of travel (up = forward)
- **Rotating Ring** - N, E, S, W markers rotate to show where North is relative to you
- **Red N** - Always indicates true North

### Map

The background map shows your current location with:
- Blue dot = your position
- Blue cone = direction you're heading
- Road network for context

### Bottom Info Bar

Shows additional information:
- Current road name and type
- Data source (OpenStreetMap, TomTom, or Estimated)
- Connection status

---

## Settings

Access settings by tapping the **gear icon** in the top-right corner. Settings are divided into two tabs:

### Settings Tab (Basic)

#### Sound Alerts
- **Toggle** - Enable/disable alert sounds when speeding
- **Volume** - Adjust alert volume (0-100%)

#### Voice Alerts
- **Toggle** - Enable/disable spoken alerts
- **Language** - Choose from 12 languages for voice announcements
- **Test Voice** - Tap to hear a sample alert

Available languages:
- English, Spanish, French, German, Italian, Portuguese
- Chinese, Japanese, Korean, Hindi, Arabic, Russian

#### Units
Choose your preferred measurement system:
- **Imperial** - Speed in MPH, distances in miles
- **Metric** - Speed in KM/H, distances in kilometers

#### Alert Delay
- **Slider (0-10 seconds)** - How long you must be speeding before an alert sounds
- Useful to avoid alerts for brief speed fluctuations
- Default: 3 seconds

#### Keep Screen On
- **Toggle** - Prevents your screen from turning off while driving
- Recommended for dashboard mounting

#### Theme
- **Light** - Bright interface, better for daytime
- **Dark** - Dark interface, better for nighttime driving

---

## Advanced Settings

Tap the **"Advanced"** tab to access additional options:

### Display

#### Transparency
- **Slider** - Adjust how transparent the speedometer appears
- Allows you to see more of the map behind it

#### Compass
- **Toggle** - Show or hide the compass

#### Reset Positions
- **Button** - Resets speedometer and compass to their default positions
- Use if you've accidentally moved them off-screen

### Alert Threshold

Configure when speeding alerts trigger:

#### Smart Threshold
When enabled, different speed zones have different buffers:

| Zone | Default Range | Default Buffer |
|------|---------------|----------------|
| Zone 1 | 0-45 mph | +0 mph (alert at limit) |
| Zone 2 | 45-65 mph | +5 mph |
| Zone 3 | 65+ mph | +10 mph |

**Example:** In a 70 mph zone with Zone 3 settings, alerts trigger at 70 + 10 + 1 = **81 mph**

Each zone is customizable:
- **Upper Limit** - Where this zone ends
- **Buffer** - How many mph/kmh over the limit before alerting

#### Fixed Buffer
When Smart Threshold is disabled, a single buffer applies to all speed zones.

### Alert Sound
Choose from different alert tones:
- Classic Beep
- Chime
- Warning
- Gentle
- Urgent

### AI Speed Prediction
- **Toggle** - Enable/disable predictive warnings
- Analyzes the road ahead and warns before entering lower speed zones
- Only active at 35+ mph for accuracy
- Shows upcoming speed changes in a panel on screen

### Weather Alerts
- **Toggle** - Enable/disable severe weather notifications
- Uses weather.gov data (US only)
- Alerts for storms, floods, winter weather, etc.

### Mobile Optimization

#### Data Saver
- **Toggle** - Reduces data usage by limiting API calls
- Useful on limited data plans

#### Low Power Mode
- **Toggle** - Reduces GPS polling frequency
- Extends battery life but may reduce accuracy

### Offline Cache
- **Toggle** - Enable/disable local storage of speed limit data
- **Cache Status** - Shows how many locations are cached
- **Clear Cache** - Removes all cached data

Benefits of caching:
- Faster speed limit lookups in familiar areas
- Works when cellular signal is weak
- Reduces data usage

### App Updates
- **Check for Updates** - Force refreshes the app to get the latest version
- Clears cached app files and reloads

### Demo Mode
- **Toggle** - Simulates driving for testing/demonstration
- Useful for exploring the app without actually driving

### Clear All App Data
- **Button** - Removes all settings, cache, and preferences
- Resets app to factory defaults
- Use if experiencing persistent issues

---

## Tips for Best Results

### For Accurate Speed Limits

1. **Mount your phone securely** - A stable mount improves GPS accuracy
2. **Use a clear view of the sky** - GPS works best with unobstructed sky view
3. **Allow time for GPS lock** - Wait a few seconds after starting for accurate readings
4. **Stay on mapped roads** - Speed limits are most accurate on major roads

### For Battery Life

1. **Enable "Keep Screen On"** - Prevents constant screen wake/sleep cycles
2. **Use Low Power Mode** - If battery is a concern
3. **Dim your screen** - Reduces power consumption
4. **Close other apps** - Reduces background activity

### For Best Alerts

1. **Set appropriate thresholds** - Use Smart Threshold for different road types
2. **Use a 2-3 second delay** - Avoids false alerts from brief speed changes
3. **Enable voice alerts** - Easier to hear than beeps while driving
4. **Test your volume** - Ensure alerts are audible over music/road noise

### Safety Reminders

- **Never interact with the app while driving** - Set up before you start
- **Use as an aid, not a replacement** - Always watch for actual speed limit signs
- **Speed limits may vary** - Construction zones, school zones may have temporary limits
- **Data may not be current** - OpenStreetMap data is community-maintained

---

## Troubleshooting

### "No Speed Limit Data"

**Possible causes:**
- You're in an area without mapped speed limits
- Weak or no internet connection
- API rate limiting (too many requests)

**Solutions:**
- Wait a few seconds for data to load
- Check your internet connection
- The app will show "LAST KNOWN" data if available

### "LAST KNOWN" Always Showing

**Possible causes:**
- Poor GPS signal
- Internet connection issues
- Server temporarily unavailable

**Solutions:**
- Move to an area with better GPS reception
- Check your internet connection
- Wait for the connection to restore

### Inaccurate Speed Display

**Possible causes:**
- GPS signal interference
- Device GPS hardware issues
- Driving through tunnels or urban canyons

**Solutions:**
- Ensure phone has clear view of sky
- Restart your device
- Check that location services are enabled

### Alerts Not Working

**Possible causes:**
- Sound alerts disabled
- Phone on silent/vibrate
- Alert delay too long
- Threshold set too high

**Solutions:**
- Check Settings > Sound Alerts is enabled
- Check phone volume is up
- Reduce alert delay
- Lower your threshold buffer

### App Running Slowly

**Possible causes:**
- Too many cached items
- Low device memory
- Old app version

**Solutions:**
- Clear cache in Advanced Settings
- Close other apps
- Check for Updates

### Battery Draining Quickly

**Possible causes:**
- Screen always on at high brightness
- GPS polling at high frequency
- Multiple apps using location

**Solutions:**
- Enable Low Power Mode
- Reduce screen brightness
- Close other location-using apps

---

## Data Sources

SpeedShield uses the following data sources:

| Source | Data Type | Coverage |
|--------|-----------|----------|
| **OpenStreetMap** | Speed limits, road names | Worldwide |
| **TomTom** (fallback) | Speed limits | Worldwide |
| **Weather.gov** | Weather alerts | United States |

### Data Accuracy

Speed limit data comes from OpenStreetMap, a community-maintained map database. While generally accurate, data may be:
- Missing for some roads
- Outdated in some areas
- Incorrect in rare cases

**Always defer to posted speed limit signs on the road.**

---

## Privacy

SpeedShield respects your privacy:

- **Location data** is only sent to our server to look up speed limits
- **No tracking** - We don't store your location history
- **No accounts required** - Use the app without signing up
- **Local storage** - Your settings and cache stay on your device

---

## Support

For issues, feature requests, or feedback:
- Check the [Self-Hosting Guide](/docs/SELF_HOSTING_GUIDE.md) for advanced deployment
- Review this manual for common solutions

---

*SpeedShield - Drive Informed, Drive Safe*
