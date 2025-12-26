// Speed Limit Cache Utility
// Caches speed limits by geohash for offline use
// AUTO-MANAGED: Automatically cleans up old/excess entries

const CACHE_KEY = 'speedLimitCache';
const CACHE_EXPIRY_DAYS = 7;
const MAX_CACHE_ENTRIES = 500;
const CLEANUP_THRESHOLD = 0.8; // Trigger cleanup at 80% capacity
const LAST_CLEANUP_KEY = 'speedLimitCacheLastCleanup';
const CLEANUP_INTERVAL_HOURS = 6; // Run cleanup every 6 hours max

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
    // If storage is full, force cleanup and retry
    if (e.name === 'QuotaExceededError') {
      const cleanedCache = performCleanup(cache, true);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(cleanedCache));
      } catch (e2) {
        // If still failing, clear everything
        localStorage.removeItem(CACHE_KEY);
      }
    }
  }
};

// Perform cache cleanup - removes old and excess entries
const performCleanup = (cache, aggressive = false) => {
  const now = Date.now();
  const expiryMs = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  
  // Get all entries with their keys
  const entries = Object.entries(cache);
  const beforeCount = entries.length;
  
  // Filter out expired entries
  let validEntries = entries.filter(([_, value]) => now - value.timestamp < expiryMs);
  
  // Sort by timestamp (newest first) and limit to max entries
  const maxEntries = aggressive ? Math.floor(MAX_CACHE_ENTRIES * 0.5) : MAX_CACHE_ENTRIES;
  validEntries = validEntries
    .sort((a, b) => b[1].timestamp - a[1].timestamp)
    .slice(0, maxEntries);
  
  const newCache = Object.fromEntries(validEntries);
  const afterCount = Object.keys(newCache).length;
  
  if (beforeCount !== afterCount) {
    console.log(`[Cache] Auto-cleanup: ${beforeCount} → ${afterCount} entries (removed ${beforeCount - afterCount})`);
  }
  
  // Update last cleanup timestamp
  localStorage.setItem(LAST_CLEANUP_KEY, now.toString());
  
  return newCache;
};

// Check if cleanup is needed and perform it
const maybeCleanup = (cache) => {
  const now = Date.now();
  const lastCleanup = parseInt(localStorage.getItem(LAST_CLEANUP_KEY) || '0', 10);
  const hoursSinceCleanup = (now - lastCleanup) / (1000 * 60 * 60);
  
  const entryCount = Object.keys(cache).length;
  const capacityRatio = entryCount / MAX_CACHE_ENTRIES;
  
  // Cleanup if:
  // 1. Cache is at 80%+ capacity, OR
  // 2. It's been more than 6 hours since last cleanup
  if (capacityRatio >= CLEANUP_THRESHOLD || hoursSinceCleanup >= CLEANUP_INTERVAL_HOURS) {
    return performCleanup(cache);
  }
  
  return cache;
};

// Cache a speed limit for a location
export const cacheSpeedLimit = (lat, lon, speedLimit, unit, roadName) => {
  if (!speedLimit) return;
  
  const geohash = encodeGeohash(lat, lon);
  let cache = getCache();
  
  cache[geohash] = {
    speedLimit,
    unit,
    roadName,
    timestamp: Date.now(),
    lat,
    lon
  };
  
  // Auto-cleanup if needed
  cache = maybeCleanup(cache);
  saveCache(cache);
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
  const capacityPercent = Math.round((entries.length / MAX_CACHE_ENTRIES) * 100);
  
  return {
    totalEntries: entries.length,
    validEntries: validEntries.length,
    maxEntries: MAX_CACHE_ENTRIES,
    capacityPercent,
    oldestEntry: entries.length > 0 
      ? Math.round((now - Math.min(...entries.map(e => e.timestamp))) / (1000 * 60 * 60 * 24))
      : 0,
    newestEntry: entries.length > 0
      ? Math.round((now - Math.max(...entries.map(e => e.timestamp))) / (1000 * 60))
      : 0,
    autoManaged: true // Flag to indicate cache is auto-managed
  };
};

// Clear all cached data
export const clearCache = () => {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(LAST_CLEANUP_KEY);
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

// Initialize cache on module load - run cleanup if needed
(() => {
  try {
    const cache = getCache();
    const entryCount = Object.keys(cache).length;
    
    if (entryCount > 0) {
      const cleanedCache = maybeCleanup(cache);
      if (Object.keys(cleanedCache).length !== entryCount) {
        saveCache(cleanedCache);
      }
    }
  } catch (e) {
    console.warn('Cache initialization cleanup failed:', e);
  }
})();
