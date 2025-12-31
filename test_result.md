# Test Results - SpeedShield App

## Current Test Focus
**Testing TomTom Fallback Logic Revert**
- The "proactive" TomTom fallback logic was reverted
- TomTom should ONLY be called when OSM finds NO roads at all (not when OSM finds roads but no explicit speed limit)
- This fixes the regression where side/cross road data was incorrectly being picked up

## Testing Protocol
- Backend API testing for speed limit accuracy
- Verify OSM is used as primary source
- Verify TomTom is only triggered as a last resort

## Test Endpoints
- `/api/speed-limit?lat=X&lon=Y` - Main speed limit endpoint
- `/api/cache-stats` - Cache statistics
- `/api/speed-ahead?lat=X&lon=Y&bearing=Z` - Speed prediction

## Incorporate User Feedback
- User reported the app was picking up side/cross road data after the proactive TomTom change
- User reported the posted speed was not updating as effectively
- Previous logic (TomTom as true fallback only) worked much better

## Test Credentials
- Test user: triptest@example.com / Test123!

## Current Fix Applied
- Removed proactive TomTom call from lines 1236-1246 in server.py
- TomTom now only called at lines 1248-1255 when ALL OSM queries fail

## Expected Behavior After Fix
1. Roads with explicit maxspeed → Use OSM data
2. Roads with road type but no maxspeed → Use road-type estimation (source: "estimated")
3. No road found at all → ONLY THEN use TomTom fallback
