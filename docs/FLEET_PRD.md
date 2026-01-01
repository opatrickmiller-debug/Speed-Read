# SpeedShield Fleet & Insurance Module
## Product Requirements Document

---

## Executive Summary

Transform SpeedShield from a consumer alerting app into a fleet management and insurance telematics platform by adding trip logging, incident tracking, driver scoring, and reporting capabilities.

**Target Markets:**
- Small/medium fleet operators (10-100 vehicles)
- Insurance companies (usage-based insurance programs)
- Gig economy platforms (delivery, rideshare)

**Revenue Model:**
- $10-15/vehicle/month (undercut enterprise players)
- White-label licensing for insurance partners
- API access fees for data consumers

---

## Phase 1: Trip Logging & Incident Tracking

### 1.1 Automatic Trip Detection

**Start Trip Triggers:**
```
- Speed exceeds 5 mph for 30+ seconds
- Manual "Start Trip" button
- Scheduled start (fleet use)
- Geofence exit
```

**End Trip Triggers:**
```
- Speed below 2 mph for 5+ minutes
- Ignition off (if OBD connected)
- Manual "End Trip" button
- Geofence arrival
- App backgrounded for 10+ minutes with no movement
```

**Trip Data Captured:**
```javascript
{
  trip_id: "uuid",
  driver_id: "uuid",           // Phase 2
  vehicle_id: "uuid",          // Phase 2
  
  // Timing
  start_time: "2025-01-15T08:30:00Z",
  end_time: "2025-01-15T09:15:00Z",
  duration_minutes: 45,
  
  // Location
  start_location: {
    lat: 44.9778,
    lon: -93.2650,
    address: "123 Main St, Minneapolis, MN"
  },
  end_location: {
    lat: 44.8848,
    lon: -93.2223,
    address: "456 Oak Ave, Bloomington, MN"
  },
  
  // Distance
  distance_miles: 12.4,
  
  // Speed Summary
  max_speed_mph: 72,
  avg_speed_mph: 38,
  
  // Safety Metrics
  speeding_incidents: 3,
  speeding_duration_seconds: 127,
  speeding_distance_miles: 1.8,
  hard_brake_events: 1,
  hard_accel_events: 0,
  
  // Scoring
  safety_score: 78,           // 0-100
  
  // Road Breakdown
  road_types: {
    motorway: 0.45,           // 45% of trip
    primary: 0.30,
    residential: 0.25
  },
  
  // Time of Day
  night_driving_pct: 0,       // % between 11pm-5am
  rush_hour_pct: 0.80,        // % during peak hours
  
  // Raw Path (for replay)
  path: [
    { lat: 44.9778, lon: -93.2650, speed: 0, timestamp: "..." },
    // ... sampled every 5-10 seconds
  ]
}
```

### 1.2 Speeding Incident Logging

**Incident Detection:**
```
Incident starts when:
  - Speed > posted_limit + threshold_buffer + 1 mph
  - For at least 3 seconds (configurable)

Incident ends when:
  - Speed <= posted_limit + threshold_buffer
  - For at least 2 seconds
```

**Incident Data Captured:**
```javascript
{
  incident_id: "uuid",
  trip_id: "uuid",
  driver_id: "uuid",
  
  // Timing
  start_time: "2025-01-15T08:42:15Z",
  end_time: "2025-01-15T08:43:02Z",
  duration_seconds: 47,
  
  // Location
  start_location: { lat: 44.9234, lon: -93.2891 },
  end_location: { lat: 44.9198, lon: -93.2834 },
  road_name: "I-94 W",
  road_type: "motorway",
  
  // Speed Data
  posted_limit: 60,
  threshold_used: 5,          // Buffer that was set
  effective_limit: 65,        // posted + threshold
  
  max_speed: 78,
  avg_speed: 71,
  speed_over_limit: 13,       // Max over posted
  speed_over_effective: 8,    // Max over effective
  
  // Severity Classification
  severity: "moderate",       // minor (<5 over), moderate (5-15), severe (15+)
  
  // Context
  weather_condition: "clear", // If available
  time_of_day: "morning_rush",
  
  // Path during incident
  path: [
    { lat: ..., lon: ..., speed: 68, limit: 60, timestamp: "..." },
    { lat: ..., lon: ..., speed: 72, limit: 60, timestamp: "..." },
    // ...
  ]
}
```

**Severity Levels:**
| Level | Over Posted Limit | Score Impact |
|-------|-------------------|--------------|
| Minor | 1-5 mph | -2 points |
| Moderate | 6-15 mph | -5 points |
| Severe | 16-25 mph | -10 points |
| Extreme | 25+ mph | -20 points |

### 1.3 Hard Braking / Acceleration Detection

**Using Device Accelerometer:**
```javascript
// Hard Brake Detection
if (deceleration > 8.0 mph/sec) {  // ~0.37g
  log_hard_brake_event();
}

// Hard Acceleration Detection  
if (acceleration > 9.0 mph/sec) {  // ~0.41g
  log_hard_accel_event();
}

// Hard Cornering Detection
if (lateral_g > 0.3g) {
  log_hard_corner_event();
}
```

**Event Data:**
```javascript
{
  event_id: "uuid",
  trip_id: "uuid",
  event_type: "hard_brake",    // hard_brake, hard_accel, hard_corner
  
  timestamp: "2025-01-15T08:45:30Z",
  location: { lat: 44.9123, lon: -93.2567 },
  
  // Measurements
  intensity_g: 0.42,           // G-force
  speed_before: 45,
  speed_after: 28,
  duration_ms: 1200,
  
  // Context
  road_name: "Highway 100",
  road_type: "primary",
  
  severity: "moderate"         // minor, moderate, severe
}
```

### 1.4 Safety Score Algorithm

**Score Calculation (0-100):**
```
Base Score: 100

Deductions:
- Speeding (minor):     -2 per incident
- Speeding (moderate):  -5 per incident
- Speeding (severe):    -10 per incident
- Speeding (extreme):   -20 per incident
- Hard brake:           -3 per event
- Hard acceleration:    -2 per event
- Hard cornering:       -2 per event
- Phone handling:       -5 per event (future)
- Night driving:        -0.5 per 10 minutes after midnight

Bonuses:
- Trip with 0 incidents: +2 (max +10/day)
- 7 consecutive safe days: +5

Minimum Score: 0
Maximum Score: 100

Score Categories:
- 90-100: Excellent
- 80-89:  Good
- 70-79:  Fair
- 60-69:  Needs Improvement
- 0-59:   Poor
```

**Rolling Score Windows:**
```
- Trip Score: Single trip
- Daily Score: All trips in 24 hours
- Weekly Score: Rolling 7 days
- Monthly Score: Rolling 30 days
- Lifetime Score: All time (weighted recent)
```

---

## Phase 1: Database Schema

### MongoDB Collections

```javascript
// trips collection
{
  _id: ObjectId,
  id: "uuid",                  // Application ID
  driver_id: "uuid",           // null for Phase 1
  vehicle_id: "uuid",          // null for Phase 1
  device_id: "uuid",           // Unique device identifier
  
  status: "active" | "completed" | "cancelled",
  
  start_time: ISODate,
  end_time: ISODate,
  duration_minutes: Number,
  
  start_location: {
    lat: Number,
    lon: Number,
    address: String,
    geohash: String            // For geospatial queries
  },
  end_location: {
    lat: Number,
    lon: Number,
    address: String,
    geohash: String
  },
  
  distance_miles: Number,
  
  max_speed_mph: Number,
  avg_speed_mph: Number,
  
  speeding_incidents_count: Number,
  speeding_duration_seconds: Number,
  speeding_distance_miles: Number,
  
  hard_brake_count: Number,
  hard_accel_count: Number,
  hard_corner_count: Number,
  
  safety_score: Number,
  
  road_type_breakdown: {
    motorway: Number,          // Percentage
    trunk: Number,
    primary: Number,
    secondary: Number,
    residential: Number,
    other: Number
  },
  
  time_breakdown: {
    night_driving_pct: Number,
    rush_hour_pct: Number
  },
  
  // Compressed path for replay
  path_encoded: String,        // Polyline encoded
  
  created_at: ISODate,
  updated_at: ISODate
}

// speeding_incidents collection
{
  _id: ObjectId,
  id: "uuid",
  trip_id: "uuid",
  driver_id: "uuid",
  device_id: "uuid",
  
  start_time: ISODate,
  end_time: ISODate,
  duration_seconds: Number,
  
  location: {
    start: { lat: Number, lon: Number },
    end: { lat: Number, lon: Number },
    road_name: String,
    road_type: String,
    geohash: String
  },
  
  posted_limit: Number,
  threshold_used: Number,
  max_speed: Number,
  avg_speed: Number,
  speed_over_limit: Number,
  
  severity: "minor" | "moderate" | "severe" | "extreme",
  score_impact: Number,
  
  path_encoded: String,
  
  created_at: ISODate
}

// driving_events collection
{
  _id: ObjectId,
  id: "uuid",
  trip_id: "uuid",
  driver_id: "uuid",
  device_id: "uuid",
  
  event_type: "hard_brake" | "hard_accel" | "hard_corner",
  timestamp: ISODate,
  
  location: {
    lat: Number,
    lon: Number,
    road_name: String,
    road_type: String
  },
  
  intensity_g: Number,
  speed_before: Number,
  speed_after: Number,
  duration_ms: Number,
  
  severity: "minor" | "moderate" | "severe",
  score_impact: Number,
  
  created_at: ISODate
}

// daily_summaries collection (for fast reporting)
{
  _id: ObjectId,
  device_id: "uuid",
  driver_id: "uuid",
  date: ISODate,               // Date only, no time
  
  trips_count: Number,
  total_distance_miles: Number,
  total_duration_minutes: Number,
  
  speeding_incidents_count: Number,
  speeding_duration_seconds: Number,
  hard_brake_count: Number,
  hard_accel_count: Number,
  
  max_speed_recorded: Number,
  avg_speed: Number,
  
  daily_score: Number,
  
  // Trend
  score_change_from_yesterday: Number,
  
  created_at: ISODate
}

// Indexes
db.trips.createIndex({ device_id: 1, start_time: -1 })
db.trips.createIndex({ driver_id: 1, start_time: -1 })
db.trips.createIndex({ "start_location.geohash": 1 })
db.speeding_incidents.createIndex({ trip_id: 1 })
db.speeding_incidents.createIndex({ driver_id: 1, start_time: -1 })
db.speeding_incidents.createIndex({ severity: 1, start_time: -1 })
db.daily_summaries.createIndex({ device_id: 1, date: -1 })
db.daily_summaries.createIndex({ driver_id: 1, date: -1 })
```

---

## Phase 1: API Endpoints

### Trip Management

```
POST   /api/trips/start
  Body: { device_id, start_location }
  Response: { trip_id, status: "active" }

POST   /api/trips/{trip_id}/end
  Body: { end_location, summary_stats }
  Response: { trip summary }

GET    /api/trips
  Query: ?device_id=X&from=DATE&to=DATE&limit=50
  Response: { trips: [...], pagination }

GET    /api/trips/{trip_id}
  Response: { full trip details with incidents }

GET    /api/trips/{trip_id}/replay
  Response: { path points for map replay }
```

### Incident Logging

```
POST   /api/incidents/speeding
  Body: { trip_id, incident_data }
  Response: { incident_id, severity, score_impact }

POST   /api/incidents/driving-event
  Body: { trip_id, event_type, event_data }
  Response: { event_id, severity, score_impact }

GET    /api/incidents
  Query: ?device_id=X&type=speeding&severity=severe&from=DATE&to=DATE
  Response: { incidents: [...], pagination }
```

### Scoring & Reports

```
GET    /api/scores/current
  Query: ?device_id=X
  Response: { 
    trip_score: 85,
    daily_score: 82,
    weekly_score: 79,
    monthly_score: 81,
    trend: "improving"
  }

GET    /api/reports/daily
  Query: ?device_id=X&date=2025-01-15
  Response: { daily_summary }

GET    /api/reports/weekly
  Query: ?device_id=X&week_start=2025-01-13
  Response: { weekly_summary with daily breakdown }

GET    /api/reports/monthly
  Query: ?device_id=X&month=2025-01
  Response: { monthly_summary with trends }

GET    /api/reports/export
  Query: ?device_id=X&from=DATE&to=DATE&format=csv|pdf
  Response: { download_url } or file stream
```

### Real-time (WebSocket)

```
WS     /api/ws/trip/{trip_id}
  
  Client -> Server:
    { type: "location", lat, lon, speed, heading, timestamp }
    { type: "speeding_start", ... }
    { type: "speeding_end", ... }
    { type: "hard_brake", ... }
  
  Server -> Client:
    { type: "speed_limit", limit, road_name }
    { type: "score_update", current_score }
    { type: "alert", message }
```

---

## Phase 1: Frontend Changes

### New Components

#### Trip History Screen
```
/trips - List of past trips

┌─────────────────────────────────────┐
│  📍 Trip History                    │
├─────────────────────────────────────┤
│  Today                              │
│  ┌─────────────────────────────────┐│
│  │ 🏠 → 🏢  8:30 AM - 9:15 AM     ││
│  │ 12.4 mi • 45 min • Score: 78   ││
│  │ ⚠️ 3 speeding incidents        ││
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │ 🏢 → 🏠  5:45 PM - 6:38 PM     ││
│  │ 14.1 mi • 53 min • Score: 92   ││
│  │ ✅ No incidents                 ││
│  └─────────────────────────────────┘│
│                                     │
│  Yesterday                          │
│  ┌─────────────────────────────────┐│
│  │ ...                             ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

#### Trip Detail Screen
```
/trips/{id} - Single trip details

┌─────────────────────────────────────┐
│  ← Trip Details                     │
├─────────────────────────────────────┤
│  ┌─────────────────────────────────┐│
│  │         [MAP WITH PATH]         ││
│  │    Red segments = speeding      ││
│  │    🔴 = incidents               ││
│  └─────────────────────────────────┘│
│                                     │
│  📊 Score: 78/100                   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│  📍 123 Main St → 456 Oak Ave      │
│  🕐 45 minutes  📏 12.4 miles      │
│  ⚡ Max: 78 mph  📈 Avg: 38 mph    │
│                                     │
│  ──────────────────────────────────│
│  ⚠️ Incidents (3)                   │
│                                     │
│  🔴 8:42 AM - I-94 W               │
│     72 mph in 60 zone (47 sec)     │
│     Severity: Moderate  -5 pts     │
│                                     │
│  🟡 8:51 AM - Highway 100          │
│     48 mph in 45 zone (12 sec)     │
│     Severity: Minor  -2 pts        │
│                                     │
│  [Export PDF]  [Share]             │
└─────────────────────────────────────┘
```

#### Dashboard / Score Screen
```
/dashboard - Overview

┌─────────────────────────────────────┐
│  SpeedShield Dashboard              │
├─────────────────────────────────────┤
│       ┌───────────────┐             │
│       │      82       │             │
│       │   GOOD 📈     │             │
│       │  Weekly Score │             │
│       └───────────────┘             │
│                                     │
│  Today         This Week            │
│  ┌──────────┐  ┌──────────┐        │
│  │ 2 trips  │  │ 12 trips │        │
│  │ 26.5 mi  │  │ 156 mi   │        │
│  │ Score:85 │  │ Score:82 │        │
│  └──────────┘  └──────────┘        │
│                                     │
│  ──────────────────────────────────│
│  📈 7-Day Trend                     │
│                                     │
│  100│      ·                        │
│   80│  · ·   · · ·                  │
│   60│·                              │
│     └──────────────────             │
│      M  T  W  T  F  S  S            │
│                                     │
│  ──────────────────────────────────│
│  ⚠️ This Week's Issues              │
│  • 8 speeding incidents            │
│  • 2 hard braking events           │
│  • Most speeding: I-94 (5x)        │
│                                     │
│  [View All Trips]  [Export Report] │
└─────────────────────────────────────┘
```

### Navigation Updates

```
Bottom Nav Bar:
┌─────────────────────────────────────┐
│  🗺️      📊       📍       ⚙️      │
│  Map    Score   Trips   Settings   │
└─────────────────────────────────────┘
```

---

## Phase 1: Export Formats

### CSV Export
```csv
Date,Start Time,End Time,Duration (min),Distance (mi),Start Address,End Address,Max Speed,Avg Speed,Speeding Incidents,Hard Brakes,Safety Score
2025-01-15,08:30,09:15,45,12.4,"123 Main St","456 Oak Ave",78,38,3,1,78
2025-01-15,17:45,18:38,53,14.1,"456 Oak Ave","123 Main St",62,31,0,0,92
```

### PDF Report
```
┌─────────────────────────────────────────────┐
│                                             │
│          SPEEDSHIELD DRIVING REPORT         │
│                                             │
│  Driver: Device ABC123                      │
│  Period: January 1-31, 2025                 │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  SUMMARY                                    │
│  ────────────────────────────────────────  │
│  Total Trips:        47                     │
│  Total Distance:     892 miles              │
│  Total Drive Time:   32 hours               │
│  Average Score:      81/100 (Good)          │
│                                             │
│  SAFETY METRICS                             │
│  ────────────────────────────────────────  │
│  Speeding Incidents: 23                     │
│    - Minor:          15                     │
│    - Moderate:       7                      │
│    - Severe:         1                      │
│  Hard Braking:       8                      │
│  Hard Acceleration:  3                      │
│                                             │
│  SCORE TREND                                │
│  ────────────────────────────────────────  │
│  [Chart showing weekly scores]              │
│                                             │
│  TOP SPEEDING LOCATIONS                     │
│  ────────────────────────────────────────  │
│  1. I-94 W (7 incidents)                    │
│  2. Highway 100 (5 incidents)               │
│  3. County Rd 18 (3 incidents)              │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Phase 2: Multi-Driver Fleet (Future)

### Additional Features
- Driver login/profiles
- Vehicle assignment
- Fleet admin web portal
- Driver comparison/ranking
- Team/group management
- Geofencing
- Scheduled reports (email)
- Role-based access control

### Additional Schema
```javascript
// drivers collection
{
  id: "uuid",
  fleet_id: "uuid",
  email: String,
  name: String,
  phone: String,
  license_number: String,
  hire_date: ISODate,
  status: "active" | "inactive",
  assigned_vehicles: ["uuid"],
  lifetime_score: Number,
  total_miles: Number,
  created_at: ISODate
}

// vehicles collection
{
  id: "uuid",
  fleet_id: "uuid",
  make: String,
  model: String,
  year: Number,
  vin: String,
  license_plate: String,
  odometer: Number,
  status: "active" | "maintenance" | "retired",
  assigned_driver_id: "uuid",
  created_at: ISODate
}

// fleets collection
{
  id: "uuid",
  name: String,
  admin_email: String,
  subscription_tier: "basic" | "pro" | "enterprise",
  vehicle_count: Number,
  driver_count: Number,
  settings: {
    speeding_threshold: Number,
    alert_emails: [String],
    report_frequency: "daily" | "weekly"
  },
  created_at: ISODate
}

// geofences collection
{
  id: "uuid",
  fleet_id: "uuid",
  name: String,
  type: "circle" | "polygon",
  center: { lat, lon },
  radius_meters: Number,
  polygon: [[lat, lon], ...],
  alert_on: "enter" | "exit" | "both",
  active: Boolean
}
```

---

## Phase 3: Insurance Integration (Future)

### API for Insurance Partners
```
GET  /api/v1/insurance/driver/{driver_id}/score
GET  /api/v1/insurance/driver/{driver_id}/risk-profile
GET  /api/v1/insurance/driver/{driver_id}/trips?from=&to=
GET  /api/v1/insurance/driver/{driver_id}/incidents?from=&to=
POST /api/v1/insurance/webhooks/subscribe
```

### Risk Profile Response
```javascript
{
  driver_id: "uuid",
  period: "2025-01",
  
  risk_score: 72,              // 0-100 (lower = riskier)
  risk_category: "moderate",   // low, moderate, high
  
  driving_metrics: {
    total_miles: 892,
    total_trips: 47,
    avg_trip_miles: 19,
    
    speeding_rate: 0.026,      // Incidents per mile
    hard_brake_rate: 0.009,
    
    night_driving_pct: 0.12,
    highway_pct: 0.45,
    
    max_speed_recorded: 84,
    avg_speed: 42
  },
  
  comparison: {
    vs_fleet_avg: "+8%",       // Better than average
    vs_all_drivers: "+12%",
    percentile: 68             // Top 68% of drivers
  },
  
  trend: {
    direction: "improving",
    score_change_30d: +4,
    score_change_90d: +11
  },
  
  risk_factors: [
    { factor: "highway_speeding", severity: "moderate", frequency: 7 },
    { factor: "night_driving", severity: "low", frequency: 12 }
  ],
  
  recommended_premium_adjustment: -0.05  // 5% discount suggested
}
```

---

## Implementation Priority

### Week 1-2: Core Trip Logging
- [ ] Trip auto-detection (start/end)
- [ ] Location sampling during trip
- [ ] Speeding incident detection & logging
- [ ] Basic trip storage (MongoDB)
- [ ] Trip list API endpoint

### Week 3-4: Scoring & Events
- [ ] Hard brake/accel detection (accelerometer)
- [ ] Safety score calculation
- [ ] Daily summary aggregation
- [ ] Score API endpoints

### Week 5-6: Frontend
- [ ] Trip history screen
- [ ] Trip detail screen with map
- [ ] Dashboard with score
- [ ] Navigation updates

### Week 7-8: Reporting
- [ ] CSV export
- [ ] PDF report generation
- [ ] Date range filtering
- [ ] Basic analytics queries

---

## Success Metrics

### Phase 1 Goals
- Trip logging accuracy: >95%
- Speeding detection accuracy: >90%
- App battery impact: <15% additional drain
- User retention (fleet): >80% at 30 days

### Business Goals
- 10 paying fleet customers within 6 months
- 500 vehicles tracked within 12 months
- $5,000 MRR within 12 months

---

## Competitive Analysis

| Feature | SpeedShield | Samsara | Verizon Connect | Geotab |
|---------|-------------|---------|-----------------|--------|
| **Price/vehicle** | $10-15 | $30-40 | $25-45 | $20-35 |
| **Hardware required** | No | Yes | Yes | Yes |
| **Setup time** | 5 min | Days | Days | Days |
| **Speed limits** | ✅ | ✅ | ✅ | ✅ |
| **Hard brake** | ✅ | ✅ | ✅ | ✅ |
| **Driver scoring** | ✅ | ✅ | ✅ | ✅ |
| **Fuel tracking** | ❌ | ✅ | ✅ | ✅ |
| **Maintenance** | ❌ | ✅ | ✅ | ✅ |
| **Dashcam** | ❌ | ✅ | Optional | Optional |

**Our Advantage:** No hardware, instant setup, lowest price point. Perfect for small fleets that can't justify $30+/vehicle and hardware installation.

---

*Document Version: 1.0*
*Last Updated: January 2025*
