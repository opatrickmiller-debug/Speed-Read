// Speed Limit Cache Utility
// Caches speed limits by geohash for offline use

const CACHE_KEY = 'speedLimitCache';
const CACHE_EXPIRY_DAYS = 7;
const MAX_CACHE_ENTRIES = 500;

// Simple geohash implementation for location-based caching
// Precision of ~150m x 150m cells
const encodeGeohash = (lat, lon, precision = 7) => {
  const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let idx = 0;
  let bit = 0;
  let evenBit = true;
  let geohash = '';
  let minLat = -90, maxLat = 90;
  let minLon = -180, maxLon = 180;

  while (geohash.length < precision) {
    if (evenBit) {
      const midLon = (minLon + maxLon) / 2;
      if (lon >= midLon) {
        idx = idx * 2 + 1;
        minLon = midLon;
      } else {
        idx = idx * 2;
        maxLon = midLon;
      }
    } else {
      const midLat = (minLat + maxLat) / 2;
      if (lat >= midLat) {
        idx = idx * 2 + 1;
        minLat = midLat;
      } else {
        idx = idx * 2;
        maxLat = midLat;
      }
    }
    evenBit = !evenBit;

    if (++bit === 5) {
      geohash += BASE32[idx];
      bit = 0;
      idx = 0;
    }
  }
  return geohash;
};

// Get cache from localStorage
const getCache = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.warn('Failed to read speed limit cache:', e);
  }
  return {};
};

// Save cache to localStorage
const saveCache = (cache) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('Failed to save speed limit cache:', e);
    // If storage is full, clear old entries
    if (e.name === 'QuotaExceededError') {
      clearOldEntries(cache);
    }
  }
};

// Clear old cache entries
const clearOldEntries = (cache) => {
  const now = Date.now();
  const expiryMs = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  
  const entries = Object.entries(cache);
  const validEntries = entries
    .filter(([_, value]) => now - value.timestamp < expiryMs)
    .sort((a, b) => b[1].timestamp - a[1].timestamp)
    .slice(0, MAX_CACHE_ENTRIES);
  
  const newCache = Object.fromEntries(validEntries);
  saveCache(newCache);
  return newCache;
};

// Cache a speed limit for a location
export const cacheSpeedLimit = (lat, lon, speedLimit, unit, roadName) => {
  if (!speedLimit) return;
  
  const geohash = encodeGeohash(lat, lon);
  const cache = getCache();
  
  cache[geohash] = {
    speedLimit,
    unit,
    roadName,
    timestamp: Date.now(),
    lat,
    lon
  };
  
  // Limit cache size
  if (Object.keys(cache).length > MAX_CACHE_ENTRIES) {
    clearOldEntries(cache);
  } else {
    saveCache(cache);
  }
};

// Get cached speed limit for a location
export const getCachedSpeedLimit = (lat, lon) => {
  const geohash = encodeGeohash(lat, lon);
  const cache = getCache();
  const entry = cache[geohash];
  
  if (entry) {
    const now = Date.now();
    const expiryMs = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    
    // Check if entry is still valid
    if (now - entry.timestamp < expiryMs) {
      return {
        speedLimit: entry.speedLimit,
        unit: entry.unit,
        roadName: entry.roadName,
        isCached: true,
        age: Math.round((now - entry.timestamp) / (1000 * 60 * 60)) // hours
      };
    }
  }
  
  // Try nearby cells (adjacent geohashes)
  const nearbyEntry = findNearbyCache(lat, lon, cache);
  if (nearbyEntry) {
    return {
      ...nearbyEntry,
      isCached: true,
      isNearby: true
    };
  }
  
  return null;
};

// Find cache entry in nearby cells
const findNearbyCache = (lat, lon, cache) => {
  const now = Date.now();
  const expiryMs = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  
  // Check slightly offset positions (~150m in each direction)
  const offsets = [
    [0.001, 0], [-0.001, 0], [0, 0.001], [0, -0.001],
    [0.001, 0.001], [-0.001, -0.001], [0.001, -0.001], [-0.001, 0.001]
  ];
  
  for (const [latOffset, lonOffset] of offsets) {
    const nearbyHash = encodeGeohash(lat + latOffset, lon + lonOffset);
    const entry = cache[nearbyHash];
    
    if (entry && (now - entry.timestamp < expiryMs)) {
      return {
        speedLimit: entry.speedLimit,
        unit: entry.unit,
        roadName: entry.roadName,
        age: Math.round((now - entry.timestamp) / (1000 * 60 * 60))
      };
    }
  }
  
  return null;
};

// Get cache statistics
export const getCacheStats = () => {
  const cache = getCache();
  const entries = Object.values(cache);
  const now = Date.now();
  const expiryMs = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  
  const validEntries = entries.filter(e => now - e.timestamp < expiryMs);
  
  return {
    totalEntries: entries.length,
    validEntries: validEntries.length,
    oldestEntry: entries.length > 0 
      ? Math.round((now - Math.min(...entries.map(e => e.timestamp))) / (1000 * 60 * 60 * 24))
      : 0,
    newestEntry: entries.length > 0
      ? Math.round((now - Math.max(...entries.map(e => e.timestamp))) / (1000 * 60))
      : 0
  };
};

// Clear all cached data
export const clearCache = () => {
  try {
    localStorage.removeItem(CACHE_KEY);
    return true;
  } catch (e) {
    console.warn('Failed to clear cache:', e);
    return false;
  }
};

// Check if device is online
export const isOnline = () => {
  return navigator.onLine;
};
