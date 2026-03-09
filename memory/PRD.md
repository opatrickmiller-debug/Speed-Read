# Keto Nutrition Tracker PRD

## Original Problem Statement
Build a sophisticated Keto-based nutrition tracker with focus on detailed protein and amino acid tracking.

## Reference Documents
- **Architecture**: `/app/memory/ARCHITECTURE.md` - System design and data models
- **Engineering Rules**: `/app/memory/AI_ENGINEERING_RULES.md` - How to safely modify the system

## Core Features
- Keto Meal Builder with custom meal saving
- Essential fatty acids tracking (Omega-3, Omega-6)
- Expanded food database (USDA, Open Food Facts, custom foods)
- Dark/light theme, mobile responsiveness
- Total carbs calculation (not net carbs)
- Fast food search with categories, time-based suggestions, recent foods
- MyFitnessPal-style logging UI
- PWA and native mobile support (Capacitor)
- Multiple portion options (g, oz, cup) with USDA serving sizes
- Server-side NutritionCalculator for consistent calculations

## Tech Stack
- **Backend**: FastAPI, MongoDB, Redis, Pydantic
- **Frontend**: React, Tailwind CSS, Shadcn UI, Capacitor
- **External APIs**: USDA FoodData Central, Open Food Facts

## Data Models

### ServingSize
```python
class ServingSize(BaseModel):
    unit: str                        # e.g., "large_egg", "cup", "g"
    description: Optional[str]       # e.g., "1 large egg (50g)"
    grams: float
```

### FoodDetailSimple
```python
class FoodDetailSimple(BaseModel):
    id: str
    name: str
    nutrition: Dict[str, float]
    base_amount: float = 100
    servings: List[ServingSize]
```

## Key API Endpoints
- `GET /api/foods/{id}` - Food details with servings array
- `POST /api/foods/calculate` - Calculate nutrition for amount/unit
- `POST /api/logs/v2` - Log food by unit and amount
- `GET /api/foods/search` - Ranked food search
- `GET /api/foods/autocomplete` - Fast suggestions

## Completed (as of March 2026)
- [x] Server-side NutritionCalculator class
- [x] Live nutrition preview in logging modal
- [x] MyFitnessPal-style UI implementation
- [x] USDA serving size integration
- [x] 1-tap fast logging
- [x] Redis caching for autocomplete/search
- [x] Capacitor mobile preparation
- [x] Meal Builder feature
- [x] Model alignment (ServingSize: unit/description/grams)

## In Progress
- [ ] P2 - Search Performance optimization
- [ ] P3 - Timezone mismatch fix

## Backlog
- [ ] P1 - AI-Powered Features (Meal Planner, Snap-a-Pic)
- [ ] P1 - Voice Search
- [ ] P2 - Historical Trends V2
- [ ] P2 - Sharing V2

## Test Credentials
- Email: tester@test.com
- Password: test123
