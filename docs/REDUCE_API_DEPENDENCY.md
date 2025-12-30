# Alternatives to Reduce API Dependency

## Overview

This document explains various strategies to reduce reliance on external APIs while maintaining speed limit accuracy for SpeedShield.

---

## Current Data Flow

```
GPS Location → Check Cache → [MISS] → Overpass API → TomTom (fallback) → Estimation
                    ↓
               [HIT] → Return cached data
```

---

## Alternative 1: Pre-Cache Major Roads

### Concept
Download and store speed limits for major highways/routes in your MongoDB database. Only query external APIs for uncached locations.

### Implementation

**Step 1: Create a highways collection**
```javascript
// MongoDB collection: highway_speed_limits
{
  "road_id": "I-94",
  "segments": [
    {
      "start_lat": 44.9537,
      "start_lon": -93.0900,
      "end_lat": 44.9778,
      "end_lon": -93.2650,
      "speed_limit": 55,
      "last_updated": "2024-12-30"
    }
  ]
}
```

**Step 2: Pre-populate with major highways**
- Download OSM data for your region
- Extract highways with speed limits
- Store in MongoDB

**Step 3: Query local DB first**
```python
async def get_speed_limit(lat, lon):
    # Check local DB first
    local = await db.highway_speed_limits.find_one({
        "segments": {
            "$elemMatch": {
                "start_lat": {"$lte": lat},
                "end_lat": {"$gte": lat}
            }
        }
    })
    if local:
        return local["speed_limit"]
    
    # Fall back to API
    return await query_overpass(lat, lon)
```

### Pros & Cons
| ✅ Pros | ❌ Cons |
|---------|---------|
| 90%+ cache hit for commuters | Initial data setup required |
| Zero API calls for known routes | Data can become stale |
| Works offline | More complex code |

---

## Alternative 2: Geofencing Zones

### Concept
Define speed limit zones as polygons instead of querying per-coordinate.

### Implementation

**Step 1: Define zones**
```javascript
// MongoDB collection: speed_zones
{
  "zone_id": "i94_minneapolis",
  "speed_limit": 55,
  "polygon": {
    "type": "Polygon",
    "coordinates": [[
      [-93.1, 44.95],
      [-93.1, 44.98],
      [-93.3, 44.98],
      [-93.3, 44.95],
      [-93.1, 44.95]
    ]]
  }
}
```

**Step 2: Query using geospatial**
```python
zone = await db.speed_zones.find_one({
    "polygon": {
        "$geoIntersects": {
            "$geometry": {
                "type": "Point",
                "coordinates": [lon, lat]
            }
        }
    }
})
```

### Pros & Cons
| ✅ Pros | ❌ Cons |
|---------|---------|
| Instant lookups | Manual zone creation |
| No API needed for known areas | Doesn't scale to all roads |
| Good for fleet management | Updates require manual work |

---

## Alternative 3: Increase Cache TTL Aggressively

### Concept
Speed limits rarely change. Cache results for days instead of hours.

### Current Settings
```python
CACHE_TTL_EXPLICIT = 7200    # 2 hours
CACHE_TTL_ESTIMATED = 3600   # 1 hour
```

### Aggressive Settings
```python
CACHE_TTL_EXPLICIT = 604800   # 7 days
CACHE_TTL_ESTIMATED = 259200  # 3 days
CACHE_TTL_NONE = 86400        # 1 day
```

### Pros & Cons
| ✅ Pros | ❌ Cons |
|---------|---------|
| Dramatically reduces API calls | May show outdated limits |
| Simple to implement | Missed construction zones |
| Good for stable routes | |

---

## Alternative 4: Reduce Polling Frequency

### Concept
Poll less frequently, especially at lower speeds.

### Implementation
```javascript
// In SpeedMap.jsx
const getPollingInterval = (speed) => {
  if (speed < 15) return 30000;  // 30s when slow
  if (speed < 45) return 10000;  // 10s city driving
  return 5000;                   // 5s highway
};
```

### Impact
| Speed | Current | Optimized | Reduction |
|-------|---------|-----------|-----------|
| Parked | 0 | 0 | ✅ Already done |
| City (25mph) | 12/min | 6/min | 50% |
| Highway (70mph) | 12/min | 12/min | 0% |

---

## Alternative 5: User-Contributed Data

### Concept
Let users report speed limits, building a community database.

### Implementation

**Backend endpoint:**
```python
@api_router.post("/report-speed-limit")
async def report_speed_limit(
    lat: float, 
    lon: float, 
    speed_limit: int,
    user_id: str
):
    await db.user_reported_limits.insert_one({
        "lat": lat,
        "lon": lon,
        "speed_limit": speed_limit,
        "reported_by": user_id,
        "timestamp": datetime.utcnow(),
        "confirmations": 1
    })
```

**Validation:**
- Require 3+ confirmations before trusting
- Compare with nearby official data
- Flag outliers for review

### Pros & Cons
| ✅ Pros | ❌ Cons |
|---------|---------|
| Free data collection | Risk of bad data |
| Covers roads OSM misses | Requires moderation |
| Community engagement | Slow to build coverage |

---

## Alternative 6: Hybrid Cache Strategy

### Concept
Combine multiple strategies for maximum efficiency.

### Implementation Order

1. **Check in-memory cache** (instant)
2. **Check MongoDB pre-cached roads** (fast)
3. **Check user-reported data** (fast)
4. **Query self-hosted Overpass** (if configured)
5. **Query public Overpass** (rate limited)
6. **Query TomTom** (paid fallback)
7. **Estimate from road type** (always works)

### Code Structure
```python
async def get_speed_limit_hybrid(lat, lon):
    # Level 1: Memory cache
    cached = get_cached_speed_limit(lat, lon)
    if cached:
        return cached
    
    # Level 2: MongoDB pre-cached
    precached = await db.precached_roads.find_one(near(lat, lon))
    if precached:
        set_cached_speed_limit(lat, lon, precached)
        return precached
    
    # Level 3: User-reported (with confirmations)
    reported = await db.user_reported_limits.find_one({
        "location": near(lat, lon),
        "confirmations": {"$gte": 3}
    })
    if reported:
        return reported
    
    # Level 4+: External APIs
    return await query_external_apis(lat, lon)
```

---

## Recommendation Matrix

| Use Case | Best Strategy |
|----------|---------------|
| Personal use (1-10 users) | Current setup + TomTom |
| Small launch (10-100 users) | Alternative 3 (aggressive cache) + TomTom |
| Regional launch (100-1000) | Self-hosted Overpass |
| National launch (1000+) | Self-hosted + Pre-caching + User reports |
| Fleet management | Geofencing zones + Pre-caching |

---

## Quick Wins (Easy to Implement)

1. **Aggressive caching** - Change TTL values (5 min change)
2. **Speed-based polling** - Reduce calls when driving slowly (30 min change)
3. **TomTom fallback** - Add API key for 2,500 free requests/day (done!)

---

## Next Steps

1. Start with quick wins
2. Monitor cache hit rates via `/api/cache-stats`
3. Identify your most common routes
4. Consider pre-caching those routes
5. Evaluate self-hosting when ready to scale
