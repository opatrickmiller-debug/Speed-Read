# AI Engineering Rules for Keto Nutrition Tracker

> **Role**: Principal Software Architect responsible for maintaining system-wide integrity.

---

## Pre-Implementation Checklist

### 1. Repository Scan
Before implementing ANY change, perform a full repository scan:

```bash
# Understand the architecture
find /app/backend -name "*.py" | head -30
find /app/frontend/src -name "*.jsx" | head -30

# Check for existing patterns
grep -rn "PATTERN" /app/backend /app/frontend/src
```

### 2. Build Dependency Graph

For every requested change, map the impact across:

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEPENDENCY GRAPH                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  MongoDB Schema                                                  │
│       ↓                                                          │
│  Pydantic Models (/backend/models/)                             │
│       ↓                                                          │
│  Services (/backend/services/)                                  │
│       ↓                                                          │
│  API Routes (/backend/routes/)                                  │
│       ↓                                                          │
│  API Client (/frontend/src/lib/api.js)                         │
│       ↓                                                          │
│  React Pages (/frontend/src/pages/)                            │
│       ↓                                                          │
│  Components (/frontend/src/components/)                        │
│       ↓                                                          │
│  Charts & Visualizations                                        │
│       ↓                                                          │
│  User Workflows                                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Identify ALL Affected Files

**NEVER modify a single file in isolation.**

Use this checklist:

```markdown
## Change: [Description]

### Backend Files
- [ ] /backend/models/[model].py
- [ ] /backend/services/[service].py
- [ ] /backend/routes/[route].py
- [ ] /backend/core/database.py (if schema change)

### Frontend Files
- [ ] /frontend/src/lib/api.js
- [ ] /frontend/src/pages/[Page].jsx
- [ ] /frontend/src/components/[Component].jsx

### Tests
- [ ] /backend/tests/test_[feature].py
- [ ] /frontend/src/tests/[Feature].test.jsx
```

---

## Implementation Plan Template

Before writing code, create this plan:

```markdown
## Implementation Plan

### 1. Change Summary
- What: [Brief description]
- Why: [Business reason]
- Risk: [Low/Medium/High]

### 2. Affected Layers
| Layer | File(s) | Changes |
|-------|---------|---------|
| MongoDB | - | [Schema changes] |
| Models | /models/X.py | [Field additions/removals] |
| Services | /services/X.py | [Logic changes] |
| Routes | /routes/X.py | [Endpoint changes] |
| API Client | api.js | [New methods] |
| Pages | Page.jsx | [UI changes] |
| Components | Component.jsx | [Prop changes] |

### 3. Migration Required?
- [ ] Database migration needed
- [ ] Data backfill required
- [ ] Breaking API change

### 4. Rollback Plan
[How to revert if something goes wrong]
```

---

## Consistency Rules

### MongoDB ↔ Pydantic ↔ API ↔ Frontend

**All layers MUST match:**

```python
# MongoDB Document
{
    "_id": ObjectId,
    "user_id": str,
    "food_name": str,        # Field name
    "calories": float        # Field type
}

# Pydantic Model
class FoodLog(BaseModel):
    id: str
    user_id: str
    food_name: str           # MUST match MongoDB
    calories: float          # MUST match MongoDB

# API Response
{
    "id": "...",
    "user_id": "...",
    "food_name": "...",      # MUST match Pydantic
    "calories": 150.0        # MUST match Pydantic
}

# Frontend Usage
const { food_name, calories } = response;  // MUST match API
```

### Naming Conventions

| Layer | Convention | Example |
|-------|------------|---------|
| MongoDB | snake_case | `user_id`, `food_name` |
| Pydantic | snake_case | `user_id`, `food_name` |
| API Response | snake_case | `user_id`, `food_name` |
| Frontend JS | camelCase | `userId`, `foodName` |
| React Props | camelCase | `userId`, `foodName` |

---

## Post-Implementation Checklist

### 1. Search for Outdated References

```bash
# Search for old field names
grep -rn "OLD_FIELD_NAME" /app/backend /app/frontend/src

# Search for broken imports
grep -rn "from.*OLD_MODULE" /app/backend /app/frontend/src

# Search for old API endpoints
grep -rn "OLD_ENDPOINT" /app/frontend/src
```

### 2. Validate API Contracts

```bash
# Test endpoint responses match frontend expectations
curl -s API_URL/endpoint | python3 -c "
import sys, json
d = json.load(sys.stdin)
required_fields = ['field1', 'field2', 'field3']
missing = [f for f in required_fields if f not in d]
if missing:
    print(f'MISSING FIELDS: {missing}')
    sys.exit(1)
print('✅ All fields present')
"
```

### 3. Feature Validation Checklist

After ANY change, verify these features still work:

| Feature | Test Method | Endpoint(s) |
|---------|-------------|-------------|
| ✅ Food Search | Manual + curl | `GET /api/foods/search` |
| ✅ Food Details | Manual + curl | `GET /api/foods/{id}` |
| ✅ Nutrition Calculation | curl | `POST /api/foods/calculate` |
| ✅ Food Logging | curl | `POST /api/logs` |
| ✅ Meal Builder | Screenshot | `/meal-builder` |
| ✅ Barcode Scanning | Manual | `GET /api/barcode/{code}` |
| ✅ Custom Foods | curl | `GET/POST /api/custom-foods` |
| ✅ Stats & Trends | curl | `GET /api/stats/daily` |
| ✅ Nutrition Charts | Screenshot | `/food/{id}` |

---

## Change Summary Template

After implementing, provide this summary:

```markdown
## Change Summary

### Files Changed
| File | Change Type | Reason |
|------|-------------|--------|
| /path/to/file.py | Modified | [Reason] |
| /path/to/file.jsx | Created | [Reason] |

### Migrations Required
- [ ] MongoDB index: `db.collection.create_index(...)`
- [ ] Data backfill: [Script path]
- [ ] Schema migration: [Description]

### API Changes
| Endpoint | Change | Breaking? |
|----------|--------|-----------|
| `GET /api/x` | Added field `y` | No |
| `POST /api/z` | Removed field `w` | Yes |

### Potential Risks
1. [Risk description and mitigation]
2. [Risk description and mitigation]

### Testing Done
- [x] Backend lint passed
- [x] Frontend build passed
- [x] API endpoints tested
- [x] UI screenshot verified
```

---

## Critical Data Models Reference

### ServingSize (Canonical)
```python
class ServingSize(BaseModel):
    unit: str                # "g", "oz", "cup", "large_egg"
    description: Optional[str]  # "1 large egg (50g)"
    grams: float             # 50.0
```

### FoodDetail (Canonical)
```python
class FoodDetail(BaseModel):
    fdc_id: str
    description: str
    calories: float
    protein: float
    fat: float
    carbs: float
    fiber: float
    servings: List[ServingSize]
    amino_acids: List[AminoAcid]
    fatty_acids: List[FattyAcid]
```

### NutritionCalculator Format
```python
{
    "name": "Egg",
    "nutrition": {"calories": 155, "protein": 13, "fat": 11, "carbs": 1.1},
    "amino_acids": {"lysine": 0.9, "methionine": 0.4},
    "fatty_acids": {"omega3": 0.05, "omega6": 1.2},
    "base_amount": 100,
    "servings": [
        {"unit": "egg", "description": "1 large egg", "grams": 50},
        {"unit": "g", "description": "1 gram", "grams": 1}
    ]
}
```

---

## MongoDB Collections Reference

| Collection | Primary Key | Indexes |
|------------|-------------|---------|
| `users` | `id` | `email` (unique), `id` (unique) |
| `food_logs` | `id` | `user_id + logged_at`, `fdc_id` |
| `foods` | `_id` | `name` (text) |
| `favorites` | `id` | `user_id`, `user_id + fdc_id` (unique) |
| `custom_meals` | `id` | `user_id`, `is_public` |
| `custom_foods` | `id` | `user_id` |
| `food_popularity` | `food_id` | `count`, `food_id` (unique) |

---

## API Endpoints Reference

### Auth
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Current user
- `PUT /api/auth/settings` - Update settings

### Foods
- `GET /api/foods/search?q=` - Search foods
- `GET /api/foods/autocomplete?q=` - Fast suggestions
- `GET /api/foods/{fdc_id}` - Food details
- `POST /api/foods/calculate` - Calculate nutrition
- `GET /api/foods/categories` - Food categories
- `GET /api/foods/recent` - Recent foods

### Logs
- `GET /api/logs?date=` - Get logs by date
- `POST /api/logs` - Log food
- `POST /api/logs/quick` - Quick log
- `DELETE /api/logs/{id}` - Delete log

### Stats
- `GET /api/stats/daily?date=` - Daily stats
- `GET /api/stats/weekly` - Weekly stats
- `GET /api/nutrition-score` - Nutrition score

---

## Quick Commands

```bash
# Lint backend
cd /app/backend && ruff check .

# Lint frontend
cd /app/frontend && yarn lint

# Build frontend
cd /app/frontend && yarn build

# Test API endpoint
API_URL=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)
curl -s "$API_URL/api/endpoint"

# Restart services
sudo supervisorctl restart backend
sudo supervisorctl restart frontend
```

---

*Last Updated: March 2026*
