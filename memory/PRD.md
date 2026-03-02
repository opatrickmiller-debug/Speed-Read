# Isotope - Keto Nutrition Tracker with Amino Acid & Fatty Acid Analysis

## Original Problem Statement
Build a Keto-based nutrition tracker that tracks protein intake similar to existing apps but shows a breakdown of the amino acids in each food, is it a complete protein or what proteins are missing. Extended to include essential fatty acids tracking (Omega-3 and Omega-6).

## User Choices
- Data Source: USDA FoodData Central API (all foods)
- Features: Advanced (meal planning, protein goals, history/trends, favorites)
- Authentication: JWT-based custom auth (multi-user)
- Food Support: All foods (not keto-specific only)

## Architecture

### Tech Stack
- **Frontend**: React 19 + Tailwind CSS + Recharts + Framer Motion
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **External API**: USDA FoodData Central API, Open Food Facts API
- **Authentication**: JWT tokens with bcrypt password hashing

### Data Flow
1. User searches food -> Backend queries USDA FDC API -> Returns amino acid & fatty acid data
2. User logs food -> Backend stores in MongoDB with amino acid and fatty acid breakdown
3. Dashboard aggregates daily totals -> Shows protein progress + amino acid + fatty acid profiles

### Backend Modular Structure (Refactored March 2, 2026)
```
/app/backend/
├── server.py           # Main FastAPI app with router includes
├── core/
│   ├── config.py       # Settings and configuration
│   ├── constants.py    # Amino acid data, fatty acid data, keto foods
│   ├── database.py     # MongoDB connection
│   └── security.py     # Auth helpers (JWT, password)
├── models/
│   ├── food.py         # Food-related Pydantic models (includes FattyAcid)
│   ├── meal.py         # Meal plan models
│   ├── stats.py        # Statistics models (includes FattyAcidSuggestion)
│   └── user.py         # User models
├── routes/
│   ├── auth.py         # Authentication routes
│   ├── barcode.py      # Barcode lookup routes
│   ├── foods.py        # Food search routes
│   ├── keto_score.py   # Keto score routes
│   ├── logs.py         # Food log routes
│   ├── meals.py        # Meal plans, custom meals, favorites
│   ├── stats.py        # Daily/weekly statistics
│   └── suggestions.py  # Amino acid & fatty acid suggestions
└── services/
    ├── fdc_client.py   # USDA FoodData Central API client (extracts fatty acids)
    ├── off_client.py   # Open Food Facts API client
    └── suggestions.py  # Amino acid & fatty acid suggestion logic
```

### Database Collections
- `users`: User accounts, protein goals, body composition settings
- `food_logs`: Daily food entries with amino acids and fatty acids
- `meal_plans`: Saved meal combinations
- `custom_meals`: User-created custom meals with keto tiers
- `favorites`: User favorite foods

## What's Been Implemented

### March 2, 2026 - Essential Fatty Acids Feature + Nutrition Score + Bug Fix + Refactoring
- **NEW**: Essential Fatty Acids tracking (Omega-3 and Omega-6)
  - Extracts fatty acids from USDA FDC data using nutrient IDs (LA:1269, ALA:1270, DHA:1272, EPA:1278)
  - Food details show fatty acid profile, omega totals, and omega ratio
  - Suggestions page has tabs for "Amino Acids" and "Fatty Acids"
  - Fatty acid suggestions with deficit calculations and keto-friendly food recommendations
  - OmegaSummary component shows omega-3 vs omega-6 balance
  - FattyAcidChart (bar chart) and FattyAcidList components
  - Food logs include fatty acid data
- **NEW**: Combined Nutrition Score
  - Single metric combining amino acid completeness (40%), omega balance (30%), and protein goal (30%)
  - Grade system (A+ to F) with color coding
  - Expandable breakdown with progress bars for each factor
  - Personalized tips to improve score
  - Displayed on Dashboard with collapsible details
- **Fixed**: Trends page weekly stats now correctly include today's data
  - Changed date range from `today - 7 days` to `today - 6 days` 
- **Refactored**: Backend from monolithic 1700+ line server.py to modular structure
  - Split into core/, models/, routes/, services/ directories

### Previous Implementation
- Complete FastAPI server with 30+ endpoints
- JWT authentication with secure password hashing
- USDA FDC API integration with amino acid and fatty acid extraction
- Correct nutrient IDs for all 18 amino acids (1210-1228) and 4 essential fatty acids
- Food logging with amino acid and fatty acid tracking
- Daily/Weekly stats aggregation
- Meal plans and favorites CRUD
- Open Food Facts barcode lookup integration
- Amino acid suggestions based on daily intake deficits
- Keto Meal Builder with combined amino acid analysis
- Keto tier classification (ultra_low, low, moderate, high)
- User settings for protein goals based on LBM
- Daily carb limits
- Keto Score calculation

### Frontend Features
- "Isotope" bioluminescent dark theme design
- Syne + Manrope typography
- Glass-morphism card components
- Amino acid radar chart (Recharts)
- Fatty acid bar chart (Recharts)
- Omega balance summary with ratio indicator
- Complete/Incomplete protein indicators
- Dashboard with protein progress
- Food search with split-view details (now includes fatty acids)
- Food log with date picker
- Trends page with weekly chart
- Settings with protein goal
- Barcode Scanner page with camera support
- Nutrition Suggestions page with Amino Acids and Fatty Acids tabs
- Keto Meal Builder page
- Keto tier badges on all foods

## Prioritized Backlog

### P0 - Critical
- All P0 features completed

### P1 - High Priority
- [x] Fix weekly stats to include current day (DONE - March 2, 2026)
- [x] Essential Fatty Acids tracking (DONE - March 2, 2026)
- [ ] Camera-based barcode scanning (currently manual input)
- [ ] Add loading skeleton states
- [ ] Mobile responsive refinements

### P2 - Medium Priority
- [ ] Food portion size presets (1 oz, 1 cup, etc.)
- [ ] Duplicate meal from history
- [ ] Share meal plans
- [ ] Amino acid RDA customization based on body weight

### P3 - Low Priority
- [ ] Dark/Light theme toggle
- [ ] Data export feature
- [ ] Recipe builder with combined amino acids
- [ ] Push notifications for protein goal reminders

## Key API Endpoints
- `/api/auth/*` - Authentication (register, login, settings)
- `/api/foods/*` - Food search and details (includes fatty acids)
- `/api/logs/*` - Food log CRUD (includes fatty acids)
- `/api/stats/*` - Daily and weekly statistics
- `/api/barcode/*` - Barcode lookup
- `/api/suggestions/amino-acids` - Amino acid suggestions
- `/api/suggestions/fatty-acids` - Fatty acid suggestions
- `/api/suggestions/omega-rich-foods` - Omega-3/6 rich foods
- `/api/nutrition-score` - Combined nutrition score (NEW)
- `/api/meal-builder/*` - Meal analysis
- `/api/custom-meals/*` - Custom meals CRUD
- `/api/meal-plans/*` - Meal plans CRUD
- `/api/favorites/*` - Favorites CRUD
- `/api/keto-score` - Keto score calculation

## Test Reports
- Latest: `/app/test_reports/iteration_5.json`
- Backend: 100% (13/13 tests passed)
- Frontend: 100% (All fatty acids features working correctly)
