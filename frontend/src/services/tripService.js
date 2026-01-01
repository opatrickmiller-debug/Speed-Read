// Fleet Trip Tracking Service
// Handles automatic trip detection, incident logging, and data sync

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

// Get or create device ID
const getDeviceId = () => {
  let deviceId = localStorage.getItem('fleet_device_id');
  if (!deviceId) {
    deviceId = 'device-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
    localStorage.setItem('fleet_device_id', deviceId);
  }
  return deviceId;
};

// Trip state
let currentTrip = null;
let tripPath = [];
let speedSamples = [];
let currentSpeedingIncident = null;
let lastLocation = null;
let tripStartTime = null;

// Accelerometer data for hard brake detection
let lastSpeed = 0;
let lastSpeedTime = Date.now();

// Thresholds
const TRIP_START_SPEED = 5; // mph - start trip when exceeding this
const TRIP_END_STATIONARY_TIME = 5 * 60 * 1000; // 5 minutes stationary = end trip
const HARD_BRAKE_THRESHOLD = 8; // mph/sec deceleration
const HARD_ACCEL_THRESHOLD = 9; // mph/sec acceleration
const SPEEDING_MIN_DURATION = 3000; // 3 seconds minimum to count as incident

let stationaryStartTime = null;

// ============ TRIP MANAGEMENT ============

export const startTrip = async (location) => {
  if (currentTrip) {
    console.log('Trip already in progress');
    return currentTrip;
  }

  const deviceId = getDeviceId();
  
  try {
    const response = await fetch(`${API_BASE}/api/fleet/trips/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: deviceId,
        start_location: {
          lat: location.lat,
          lon: location.lon,
          address: location.address || null
        }
      })
    });

    if (!response.ok) throw new Error('Failed to start trip');

    const data = await response.json();
    currentTrip = {
      id: data.trip_id,
      deviceId,
      startTime: new Date(data.start_time),
      status: 'active'
    };
    
    tripPath = [];
    speedSamples = [];
    tripStartTime = Date.now();
    stationaryStartTime = null;
    
    console.log('Trip started:', currentTrip.id);
    
    // Store in localStorage for persistence
    localStorage.setItem('current_trip', JSON.stringify(currentTrip));
    
    return currentTrip;
  } catch (error) {
    console.error('Error starting trip:', error);
    return null;
  }
};

export const endTrip = async (location) => {
  if (!currentTrip) {
    console.log('No active trip to end');
    return null;
  }

  // End any active speeding incident first
  if (currentSpeedingIncident) {
    await endSpeedingIncident(location);
  }

  try {
    const response = await fetch(`${API_BASE}/api/fleet/trips/${currentTrip.id}/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        end_location: {
          lat: location.lat,
          lon: location.lon,
          address: location.address || null
        }
      })
    });

    if (!response.ok) throw new Error('Failed to end trip');

    const tripSummary = await response.json();
    console.log('Trip ended:', tripSummary);
    
    // Clear state
    const completedTrip = currentTrip;
    currentTrip = null;
    tripPath = [];
    speedSamples = [];
    tripStartTime = null;
    localStorage.removeItem('current_trip');
    
    return tripSummary;
  } catch (error) {
    console.error('Error ending trip:', error);
    return null;
  }
};

export const updateTripLocation = async (location, speed, heading) => {
  if (!currentTrip) return;

  // Store locally
  const point = {
    lat: location.lat,
    lon: location.lon,
    speed,
    heading,
    timestamp: new Date().toISOString()
  };
  tripPath.push(point);
  speedSamples.push(speed);
  lastLocation = location;

  // Check for hard braking/acceleration
  detectHardEvents(speed, location);

  // Send to server (throttled - every 5th point or important events)
  if (tripPath.length % 5 === 0) {
    try {
      await fetch(`${API_BASE}/api/fleet/trips/${currentTrip.id}/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip_id: currentTrip.id,
          device_id: currentTrip.deviceId,
          ...point
        })
      });
    } catch (error) {
      console.error('Error updating location:', error);
    }
  }

  // Check for trip end (stationary for too long)
  if (speed < 2) {
    if (!stationaryStartTime) {
      stationaryStartTime = Date.now();
    } else if (Date.now() - stationaryStartTime > TRIP_END_STATIONARY_TIME) {
      console.log('Auto-ending trip due to inactivity');
      await endTrip(location);
    }
  } else {
    stationaryStartTime = null;
  }
};

// ============ AUTOMATIC TRIP DETECTION ============

export const checkAutoTripStart = async (speed, location) => {
  if (currentTrip) return false;
  
  if (speed >= TRIP_START_SPEED) {
    console.log('Auto-starting trip (speed threshold reached)');
    await startTrip(location);
    return true;
  }
  return false;
};

// ============ SPEEDING INCIDENTS ============

export const startSpeedingIncident = async (location, postedLimit, threshold, currentSpeed, roadName, roadType) => {
  if (currentSpeedingIncident) return currentSpeedingIncident;
  if (!currentTrip) return null;

  try {
    const response = await fetch(`${API_BASE}/api/fleet/incidents/speeding/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trip_id: currentTrip.id,
        device_id: currentTrip.deviceId,
        start_time: new Date().toISOString(),
        start_location: { lat: location.lat, lon: location.lon },
        posted_limit: postedLimit,
        threshold_used: threshold,
        max_speed: currentSpeed,
        road_name: roadName,
        road_type: roadType
      })
    });

    if (!response.ok) throw new Error('Failed to start speeding incident');

    const data = await response.json();
    currentSpeedingIncident = {
      id: data.incident_id,
      startTime: Date.now(),
      startLocation: location,
      postedLimit,
      maxSpeed: currentSpeed,
      speedSamples: [currentSpeed],
      severity: data.severity
    };

    console.log('Speeding incident started:', data.severity);
    return currentSpeedingIncident;
  } catch (error) {
    console.error('Error starting speeding incident:', error);
    return null;
  }
};

export const updateSpeedingIncident = async (currentSpeed) => {
  if (!currentSpeedingIncident) return;

  currentSpeedingIncident.speedSamples.push(currentSpeed);
  
  if (currentSpeed > currentSpeedingIncident.maxSpeed) {
    currentSpeedingIncident.maxSpeed = currentSpeed;
    
    // Update server with new max
    try {
      await fetch(`${API_BASE}/api/fleet/incidents/speeding/${currentSpeedingIncident.id}/update?max_speed=${currentSpeed}`, {
        method: 'POST'
      });
    } catch (error) {
      console.error('Error updating speeding incident:', error);
    }
  }
};

export const endSpeedingIncident = async (location) => {
  if (!currentSpeedingIncident) return null;

  const duration = Math.round((Date.now() - currentSpeedingIncident.startTime) / 1000);
  
  // Don't log very short incidents
  if (duration < SPEEDING_MIN_DURATION / 1000) {
    console.log('Speeding incident too short, not logging');
    currentSpeedingIncident = null;
    return null;
  }

  const avgSpeed = currentSpeedingIncident.speedSamples.reduce((a, b) => a + b, 0) / 
                   currentSpeedingIncident.speedSamples.length;

  try {
    const response = await fetch(`${API_BASE}/api/fleet/incidents/speeding/${currentSpeedingIncident.id}/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        end_time: new Date().toISOString(),
        end_location: { lat: location.lat, lon: location.lon },
        duration_seconds: duration,
        avg_speed: Math.round(avgSpeed)
      })
    });

    if (!response.ok) throw new Error('Failed to end speeding incident');

    const data = await response.json();
    console.log('Speeding incident ended:', data.severity, `${duration}s`);
    
    currentSpeedingIncident = null;
    return data;
  } catch (error) {
    console.error('Error ending speeding incident:', error);
    currentSpeedingIncident = null;
    return null;
  }
};

export const isSpeedingIncidentActive = () => !!currentSpeedingIncident;

// ============ HARD BRAKE/ACCEL DETECTION ============

const detectHardEvents = async (currentSpeed, location) => {
  if (!currentTrip) return;

  const now = Date.now();
  const timeDelta = (now - lastSpeedTime) / 1000; // seconds
  
  if (timeDelta > 0 && timeDelta < 5) { // Only check if reasonable time gap
    const speedChange = currentSpeed - lastSpeed;
    const acceleration = speedChange / timeDelta; // mph/sec

    // Hard braking (negative acceleration)
    if (acceleration < -HARD_BRAKE_THRESHOLD) {
      await logDrivingEvent('hard_brake', Math.abs(acceleration) / 22, location, lastSpeed, currentSpeed, timeDelta * 1000);
    }
    // Hard acceleration
    else if (acceleration > HARD_ACCEL_THRESHOLD) {
      await logDrivingEvent('hard_accel', acceleration / 22, location, lastSpeed, currentSpeed, timeDelta * 1000);
    }
  }

  lastSpeed = currentSpeed;
  lastSpeedTime = now;
};

const logDrivingEvent = async (eventType, intensityG, location, speedBefore, speedAfter, durationMs) => {
  if (!currentTrip) return;

  try {
    const response = await fetch(`${API_BASE}/api/fleet/incidents/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trip_id: currentTrip.id,
        device_id: currentTrip.deviceId,
        event_type: eventType,
        timestamp: new Date().toISOString(),
        location: { lat: location.lat, lon: location.lon },
        intensity_g: Math.round(intensityG * 100) / 100,
        speed_before: speedBefore,
        speed_after: speedAfter,
        duration_ms: Math.round(durationMs)
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`${eventType} event logged:`, data.severity);
    }
  } catch (error) {
    console.error('Error logging driving event:', error);
  }
};

// ============ DATA RETRIEVAL ============

export const getTrips = async (fromDate, toDate, limit = 20) => {
  const deviceId = getDeviceId();
  let url = `${API_BASE}/api/fleet/trips?device_id=${deviceId}&limit=${limit}`;
  if (fromDate) url += `&from_date=${fromDate}`;
  if (toDate) url += `&to_date=${toDate}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch trips');
    return await response.json();
  } catch (error) {
    console.error('Error fetching trips:', error);
    return { trips: [], total: 0 };
  }
};

export const getTripDetail = async (tripId) => {
  try {
    const response = await fetch(`${API_BASE}/api/fleet/trips/${tripId}`);
    if (!response.ok) throw new Error('Failed to fetch trip');
    return await response.json();
  } catch (error) {
    console.error('Error fetching trip detail:', error);
    return null;
  }
};

export const getScores = async () => {
  const deviceId = getDeviceId();
  
  try {
    const response = await fetch(`${API_BASE}/api/fleet/scores?device_id=${deviceId}`);
    if (!response.ok) throw new Error('Failed to fetch scores');
    return await response.json();
  } catch (error) {
    console.error('Error fetching scores:', error);
    return null;
  }
};

export const getIncidents = async (fromDate, toDate, severity, limit = 50) => {
  const deviceId = getDeviceId();
  let url = `${API_BASE}/api/fleet/incidents?device_id=${deviceId}&limit=${limit}`;
  if (fromDate) url += `&from_date=${fromDate}`;
  if (toDate) url += `&to_date=${toDate}`;
  if (severity) url += `&severity=${severity}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch incidents');
    return await response.json();
  } catch (error) {
    console.error('Error fetching incidents:', error);
    return [];
  }
};

// ============ STATE GETTERS ============

export const getCurrentTrip = () => currentTrip;
export const isTripping = () => !!currentTrip;
export const getTripDuration = () => tripStartTime ? Date.now() - tripStartTime : 0;
export const getTripPath = () => [...tripPath];
export const getDeviceIdValue = () => getDeviceId();

// ============ RESTORE STATE ON LOAD ============

export const restoreTrip = () => {
  const saved = localStorage.getItem('current_trip');
  if (saved) {
    try {
      const trip = JSON.parse(saved);
      // Only restore if trip is less than 12 hours old
      if (Date.now() - new Date(trip.startTime).getTime() < 12 * 60 * 60 * 1000) {
        currentTrip = trip;
        tripStartTime = new Date(trip.startTime).getTime();
        console.log('Restored active trip:', trip.id);
        return trip;
      } else {
        localStorage.removeItem('current_trip');
      }
    } catch (e) {
      localStorage.removeItem('current_trip');
    }
  }
  return null;
};

// Auto-restore on module load
restoreTrip();
