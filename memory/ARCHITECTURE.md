# Keto Nutrition Tracker - System Architecture

This document defines **what the system should look like**.

For rules on **how to safely modify the system**, see `/memory/AI_ENGINEERING_RULES.md`.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         KETO NUTRITION TRACKER                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    FRONTEND (React + Capacitor)                        │ │
│  │                                                                        │ │
│  │   Pages          Components           Context         Lib              │ │
│  │   ├─ Dashboard   ├─ Layout            ├─ AuthContext  ├─ api.js       │ │
│  │   ├─ FoodSearch  ├─ Sidebar           └─ ThemeContext └─ utils.js     │ │
│  │   ├─ FoodDetails ├─ AminoAcidRadar                                    │ │
│  │   ├─ FoodLog     ├─ FattyAcidChart                                    │ │
│  │   ├─ MealBuilder ├─ NutritionScore                                    │ │
│  │   ├─ Settings    └─ ui/ (Shadcn)                                      │ │
│  │   └─ Trends                                                            │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                         │
│                                    ▼ HTTP/REST                               │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                      BACKEND (FastAPI)                                 │ │
│  │                                                                        │ │
│  │   Routes              Services              Models                     │ │
│  │   ├─ auth.py          ├─ nutrition_calc     ├─ food.py                │ │
│  │   ├─ foods.py         ├─ food_normalizer    ├─ user.py                │ │
│  │   ├─ logs.py          ├─ food_search        ├─ meal.py                │ │
│  │   ├─ stats.py         ├─ fdc_client         └─ stored_food.py         │ │
│  │   ├─ meals.py         └─ off_client                                   │ │
│  │   ├─ stored_foods.py                                                  │ │
│  │   └─ suggestions.py   Core                                            │ │
│  │                       ├─ database.py                                  │ │
│  │                       ├─ security.py                                  │ │
│  │                       ├─ cache.py                                     │ │
│  │                       └─ config.py                                    │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                          │              │              │                     │
│                          ▼              ▼              ▼                     │
│                    ┌──────────┐  ┌──────────┐  ┌──────────────┐             │
│                    │ MongoDB  │  │  Redis   │  │ External APIs│             │
│                    │ (Atlas)  │  │ (Cache)  │  │ USDA, OFF    │             │
│                    └──────────┘  └──────────┘  └──────────────┘             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Layer Responsibilities

### Frontend Layer

| Component | Responsibility |
|-----------|----------------|
| **Pages** | Route-level components, data fetching, layout |
| **Components** | Reusable UI, charts, visualizations |
| **Context** | Global state (auth, theme) |
| **API Client** | HTTP calls to backend, response handling |

**Frontend MUST NOT:**
- Implement nutrition calculations
- Implement serving conversions
- Be the source of truth for business logic

### Backend Layer

| Component | Responsibility |
|-----------|----------------|
| **Routes** | Request validation, call services, return responses |
| **Services** | Business logic, calculations, external API calls |
| **Models** | Data validation, schemas |
| **Core** | Database, auth, caching, configuration |

**Routes MUST:**
- Stay thin (validate → call service → respond)
- Not contain business logic

**Services MUST:**
- Contain all business logic
- Be reusable across routes
- Not directly return HTTP responses

### Data Layer

| Component | Responsibility |
|-----------|----------------|
| **MongoDB** | Persistent storage |
| **Redis** | Caching (optional, graceful fallback) |
| **External APIs** | USDA, Open Food Facts |

---

## Canonical Data Models

### ServingSize (Canonical)

```python
{
    "unit": str,           # "g", "oz", "cup", "large_egg"
    "description": str,    # "1 large egg (50g)"
    "grams": float         # 50.0
}
```

### NormalizedFood (Canonical)

```python
{
    "id": str,             # Unique ID
    "name": str,           # Food name
    "source": str,         # "usda", "off", "custom", "local"
    
    # Per 100g
    "calories": float,
    "protein": float,
    "fat": float,
    "carbs": float,
    "fiber": float,
    
    # Detailed
    "amino_acids": Dict[str, float],
    "fatty_acids": Dict[str, float],
    
    # Serving options
    "servings": List[ServingSize],
    
    # Metadata
    "brand": Optional[str],
    "category": Optional[str],
    "barcode": Optional[str],
    
    "base_amount": 100
}
```

### FoodLog (Immutable Snapshot)

```python
{
    "id": str,
    "user_id": str,
    "fdc_id": str,
    "description": str,
    
    # Snapshot at log time (IMMUTABLE)
    "serving_size": float,      # grams consumed
    "calories": float,
    "protein": float,
    "fat": float,
    "carbs": float,
    "fiber": float,
    "amino_acids": List[Dict],
    "fatty_acids": List[Dict],
    
    "meal_type": str,           # breakfast, lunch, dinner, snack
    "logged_at": datetime,
    "created_at": datetime
}
```

---

## MongoDB Collections

| Collection | Primary Key | Indexes | Purpose |
|------------|-------------|---------|---------|
| `users` | `id` | `email`, `id` | User accounts |
| `food_logs` | `id` | `user_id + logged_at`, `fdc_id` | Daily entries |
| `foods` | `_id` | `name (text)` | Local food cache |
| `favorites` | `id` | `user_id`, `user_id + fdc_id` | Starred foods |
| `custom_meals` | `id` | `user_id`, `is_public` | Saved meals |
| `custom_foods` | `id` | `user_id` | User-created foods |
| `food_popularity` | `food_id` | `count`, `food_id` | Usage tracking |

---

## API Endpoints

### Auth (`/api/auth`)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/register` | Create account |
| POST | `/login` | Login |
| GET | `/me` | Current user |
| PUT | `/settings` | Update settings |

### Foods (`/api/foods`)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/search?q=` | Search foods |
| GET | `/autocomplete?q=` | Fast suggestions |
| GET | `/{fdc_id}` | Food details |
| POST | `/calculate` | Calculate nutrition |
| GET | `/categories` | Food categories |
| GET | `/recent` | Recent foods |

### Stored Foods (`/api/stored-foods`)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/calculate` | Hybrid calculation |
| POST | `/import/{fdc_id}` | Import from USDA |
| POST | `/` | Create local food |
| GET | `/` | List stored foods |
| GET | `/{id}` | Get stored food |
| PUT | `/{id}` | Update food |
| DELETE | `/{id}` | Delete food |

### Logs (`/api/logs`)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/?date=` | Get logs by date |
| POST | `/` | Log food |
| POST | `/quick` | Quick log |
| DELETE | `/{id}` | Delete log |

### Stats (`/api/stats`)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/daily?date=` | Daily stats |
| GET | `/weekly` | Weekly stats |
| GET | `/nutrition-score` | Nutrition score |

---

## Service Responsibilities

### NutritionCalculator
- Calculate nutrition for amount + unit
- Scale amino acids and fatty acids
- Convert between serving units

### FoodNormalizer
- Normalize data from USDA, OFF, custom, local
- Output consistent `NormalizedFood` structure
- Convert to calculator format

### FoodSearch
- Search across multiple sources
- Rank and score results
- Handle caching

### FDCClient
- Fetch data from USDA FoodData Central
- Parse food details
- Extract servings, amino acids, fatty acids

### OFFClient
- Fetch data from Open Food Facts
- Handle barcode lookups

---

## Data Flow: Food Logging

```
User selects food
       │
       ▼
Frontend calls GET /api/foods/{id}
       │
       ▼
Backend fetches from USDA/OFF/Local
       │
       ▼
FoodNormalizer normalizes data
       │
       ▼
Frontend displays with serving options
       │
       ▼
User selects amount + unit
       │
       ▼
Frontend calls POST /api/logs
       │
       ▼
NutritionCalculator calculates
       │
       ▼
Snapshot stored in food_logs (immutable)
       │
       ▼
Dashboard/Stats queries food_logs
```

---

## Invariants

### Nutrition Calculation
- **Always server-side** via NutritionCalculator
- **Per-100g is canonical** - all conversions derive from this
- **Serving grams are the conversion factor**

### Food Logs
- **Immutable snapshots** - nutrition values frozen at log time
- **Never recalculated** - changing food definitions doesn't affect old logs
- **Complete data** - contains all nutrition, not just references

### Serving Units
- **Grams are the base unit**
- **All servings have a gram equivalent**
- **Frontend displays, backend calculates**

### Data Sources
- **Hybrid lookup** - local DB first, external API fallback
- **Normalized output** - all sources produce same structure
- **Source tracking** - every food knows its origin

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, Tailwind CSS, Shadcn UI, Capacitor |
| Backend | FastAPI, Pydantic, Python 3.11 |
| Database | MongoDB (Motor async driver) |
| Cache | Redis (aioredis, optional) |
| External | USDA FoodData Central, Open Food Facts |
| Auth | JWT (python-jose), bcrypt |

---

## File Structure

```
/app
├── backend/
│   ├── core/
│   │   ├── cache.py
│   │   ├── config.py
│   │   ├── database.py
│   │   └── security.py
│   ├── models/
│   │   ├── food.py
│   │   ├── meal.py
│   │   ├── stored_food.py
│   │   └── user.py
│   ├── routes/
│   │   ├── auth.py
│   │   ├── foods.py
│   │   ├── logs.py
│   │   ├── meals.py
│   │   ├── stats.py
│   │   └── stored_foods.py
│   ├── services/
│   │   ├── fdc_client.py
│   │   ├── food_normalizer.py
│   │   ├── food_search.py
│   │   ├── nutrition_calculator.py
│   │   └── off_client.py
│   ├── migrations/
│   │   └── create_indexes.py
│   └── server.py
│
├── frontend/src/
│   ├── components/
│   │   ├── AminoAcidRadar.jsx
│   │   ├── FattyAcidChart.jsx
│   │   ├── Layout.jsx
│   │   ├── NutritionScore.jsx
│   │   ├── Sidebar.jsx
│   │   └── ui/
│   ├── context/
│   │   ├── AuthContext.js
│   │   └── ThemeContext.js
│   ├── lib/
│   │   ├── api.js
│   │   └── utils.js
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── FoodDetails.jsx
│   │   ├── FoodLog.jsx
│   │   ├── FoodSearchNew.jsx
│   │   ├── MealBuilder.jsx
│   │   ├── Settings.jsx
│   │   └── Trends.jsx
│   ├── App.js
│   └── index.css
│
└── memory/
    ├── AI_ENGINEERING_RULES.md
    ├── ARCHITECTURE.md
    └── PRD.md
```

---

*Last Updated: March 2026*
