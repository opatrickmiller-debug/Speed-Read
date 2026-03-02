# Isotope - Keto Nutrition Tracker with Amino Acid Analysis

## Original Problem Statement
Build a Keto-based nutrition tracker that tracks protein intake similar to existing apps but shows a breakdown of the amino acids in each food, is it a complete protein or what proteins are missing.

## User Choices
- Data Source: USDA FoodData Central API (all foods)
- Features: Advanced (meal planning, protein goals, history/trends, favorites)
- Authentication: JWT-based custom auth (multi-user)
- Food Support: All foods (not keto-specific only)

## Architecture

### Tech Stack
- **Frontend**: React 19 + Tailwind CSS + Recharts + Framer Motion
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **External API**: USDA FoodData Central API
- **Authentication**: JWT tokens with bcrypt password hashing

### Data Flow
1. User searches food → Backend queries USDA FDC API → Returns amino acid data
2. User logs food → Backend stores in MongoDB with amino acid breakdown
3. Dashboard aggregates daily totals → Shows protein progress + amino acid profile

### Database Collections
- `users`: User accounts, protein goals
- `food_logs`: Daily food entries with amino acids
- `meal_plans`: Saved meal combinations
- `favorites`: User favorite foods

## Core Requirements (Static)

### Must Have
- [x] User authentication (register/login)
- [x] Food search with USDA database
- [x] Amino acid extraction for all foods
- [x] Complete/Incomplete protein indicator
- [x] Missing amino acids display
- [x] Daily food logging
- [x] Protein progress tracking
- [x] Amino acid radar chart visualization

### Should Have
- [x] Meal planning feature
- [x] Favorites management
- [x] Weekly trends chart
- [x] Protein goal settings

### Nice to Have
- [ ] Food barcode scanning
- [ ] Meal recommendations
- [ ] Export data to CSV

## What's Been Implemented (March 2, 2026)

### Backend
- Complete FastAPI server with 20+ endpoints
- JWT authentication with secure password hashing
- USDA FDC API integration with amino acid extraction
- Correct nutrient IDs for all 18 amino acids (1210-1228)
- Food logging with amino acid tracking
- Daily/Weekly stats aggregation
- Meal plans and favorites CRUD
- **NEW: Open Food Facts barcode lookup integration**
- **NEW: Amino acid suggestions based on daily intake deficits**
- **NEW: Complete protein foods recommendations**

### Frontend
- "Isotope" bioluminescent dark theme design
- Syne + Manrope typography
- Glass-morphism card components
- Amino acid radar chart (Recharts)
- Complete/Incomplete protein indicators
- Dashboard with protein progress
- Food search with split-view details
- Food log with date picker
- Trends page with weekly chart
- Settings with protein goal
- **NEW: Barcode Scanner page with camera support**
- **NEW: Amino Acid Suggestions page**
- **NEW: Quick action buttons on dashboard**

## Prioritized Backlog

### P0 - Critical
- All P0 features completed

### P1 - High Priority
- [ ] Camera-based barcode scanning (currently manual input)
- [ ] Fix weekly stats to include current day
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

## Next Tasks
1. Implement camera barcode detection (BarcodeDetector API)
2. Fix weekly trends to show today's data
3. Add food portion presets
4. Add body weight setting for personalized RDAs
