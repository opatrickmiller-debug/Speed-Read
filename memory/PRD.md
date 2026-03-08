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
- **Mobile**: PWA + Capacitor for native iOS/Android builds

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
│   ├── foods.py        # Food search routes with smart ranking
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

## Current Status

### All Systems Operational ✅
- **Barcode Scanner**: CONFIRMED WORKING (March 7, 2026) - Camera functioning on mobile device
- **Deployment**: READY - Health check passed, no blockers
- **All Features**: Working as expected


### March 8, 2026 - Meal Builder Feature Implementation
- **IMPLEMENTED**: Full Meal Builder feature at `/meal-builder`
  - Users can search and add multiple foods to build a meal
  - Portion controls with +/- buttons and direct gram input
  - Real-time total macros calculation (calories, protein, fat, carbs)
  - Delete functionality for individual food items
  - Save meal creates custom meal via POST /api/custom-meals
  - Toast notifications for add/save actions
  - Data-testids for all interactive elements
  - Validation: Requires meal name and at least one food
- **TESTED**: Full E2E testing with testing_agent_v3_fork
  - 100% backend tests passed (15/15)
  - 100% frontend tests passed
  - Test file created: /app/backend/tests/test_meal_builder.py

### March 8, 2026 - Redis Caching Implementation
- **ENABLED**: Redis caching for search performance
  - Installed and configured Redis server
  - Added REDIS_URL to backend/.env
  - Verified Redis connection on app startup
- **CACHED ENDPOINTS**:
  - `/api/foods/autocomplete`: 63% faster (1.9s → 0.7s cached)
  - `/api/foods/search`: USDA and OFF results cached for 1 hour
  - Food details cached for 7 days
- **CACHE STATS**: Available at `/api/cache/stats`
- **PERFORMANCE**:
  - Autocomplete: ~0.7s cached vs ~1.9s uncached
  - Search: Cached results avoid re-fetching from USDA/OFF APIs

### March 8, 2026 - Capacitor Mobile Build Preparation
- **CONFIGURED**: Full Capacitor setup for native mobile builds
  - App ID: `com.isotope.app`
  - App Name: `Isotope`
- **CAMERA PERMISSIONS**:
  - Android: CAMERA, READ_EXTERNAL_STORAGE, WRITE_EXTERNAL_STORAGE, READ_MEDIA_IMAGES, VIBRATE
  - iOS: NSCameraUsageDescription, NSPhotoLibraryUsageDescription, NSPhotoLibraryAddUsageDescription
- **SPLASH SCREEN**:
  - Dark theme (#050505 background)
  - Centered logo with 2-second display
  - Configured for both Android and iOS
- **MOBILE RESPONSIVE**:
  - Safe area insets for notched devices
  - Touch-optimized CSS (no tap highlight, manipulation touch-action)
  - 16px minimum font for inputs (prevents iOS zoom)
- **CAPACITOR PLUGINS**: Camera, SplashScreen, StatusBar, Keyboard, Haptics, App
- **BUILD SCRIPTS** (in package.json):
  - `yarn build:mobile` - Build and sync all platforms
  - `yarn build:android` - Build and sync Android only
  - `yarn build:ios` - Build and sync iOS only
  - `yarn cap:open:android` - Open in Android Studio
  - `yarn cap:open:ios` - Open in Xcode

### March 8, 2026 - Multi-Unit Portion System
- **IMPLEMENTED**: Flexible portion unit selection for food logging
- **Supported Units**:
  - g (grams) - default
  - oz (ounces) - 28.35g conversion
  - lb (pounds) - 453.6g conversion
  - kg (kilograms) - 1000g conversion
  - cup - 240g conversion (approximate)
  - tbsp (tablespoons) - 15g conversion
  - tsp (teaspoons) - 5g conversion
  - serving - 100g standard serving
- **FoodDetails.jsx**: Full unit selector with quick amount buttons per unit type
- **MealBuilder.jsx**: Unit selector per food item in meal
- **Calculation**: User inputs amount in preferred unit → converted to grams → macros calculated from per-100g USDA data
- **Example**: 2oz cheese → 56.7g → macros = per_100g × 0.567

### March 8, 2026 - Serving Size Converter Enhancement
- **IMPROVED**: Cleaner modal UI with dropdown selector
- **NEW FEATURES**:
  - Dropdown unit selector (cleaner than button grid)
  - Universal quick buttons: [½] [1] [2] [3]
  - Gram conversion box: "2 oz = 56.7g" with serving label
  - Dynamic serving size from USDA data when available
  - Additional units: slice (28g), piece (50g)
- **UTILITY FUNCTIONS** (`/lib/utils.js`):
  - `unitToGrams(amount, unit, servingWeight)` - Convert any unit to grams
  - `getUnitOptions(servingWeight, servingLabel)` - Get unit definitions
- **SHARED CODE**: Both FoodDetails and MealBuilder use same conversion utilities
- **TESTED**: Verified 2oz → 56.7g → backend receives correct grams

## What's Been Implemented

### March 7, 2026 - MyFitnessPal-Style Portion Selection UI
- **REDESIGNED**: FoodDetails page with MyFitnessPal-style interface
  - Clean "Add Food" header with back arrow and checkmark confirm button
  - Food title with source badge (USDA, Open Food Facts, Custom)
  - Settings-style row layout: Meal, Number of Servings, Serving Size, Nutrition Details
  - Each row is tappable to open its respective modal
  - Favorite button (heart icon) next to food title
- **NEW**: "How Much?" Portion Modal with Quick Presets
  - **Quick Select buttons** at top for fast portion selection:
    - Serving: ½ srv, 1 srv, 1½ srv, 2 srv, 3 srv
    - Gram: 50g, 100g, 150g, 200g, 250g
    - Ounce: 1 oz, 2 oz, 3 oz, 4 oz, 6 oz, 8 oz
    - Cup: ¼, ½, ¾, 1, 1½, 2 cup
    - Tablespoon: 1, 2, 3, 4 tbsp
    - Teaspoon: 1, 2, 3, 4 tsp
    - Pound: ¼, ½, 1, 1½, 2 lb
    - Kilogram: ¼, ½, 1, 1½, 2 kg
  - Quantity input with "Serving(s) of" label
  - Scrollable list of portion options: default serving, gram, ounce, pound, kilogram, teaspoon, tablespoon, cup
  - Default serving highlighted with "Default serving" label
  - Selected option highlighted in green
  - Cancel/Save buttons at bottom
- **CHANGED**: Macro Display from Circle to Radar Chart
  - Replaced donut/circle chart with polygon/spider radar chart
  - Matches visual style of Amino Acid Profile chart
  - 4-point radar: Cal, Pro (Protein), Fat, Carb
  - Green fill with transparency, dots at data points
  - Hover tooltip shows exact values
  - Macro values displayed below chart (Protein highlighted in emerald)
- **NEW**: Meal Selection Modal
  - Clean list with Breakfast, Lunch, Dinner, Snack options
  - Checkmark indicator for selected meal
  - Instant selection (no save button needed)
- **NEW**: Nutrition Details Modal
  - Full macro grid (Protein, Calories, Fat, Carbs)
  - Protein quality status (complete/incomplete)
  - Amino acid radar chart and breakdown (when available)
  - Fatty acid profile and omega ratio (when available)
- **IMPROVED**: Dynamic portion calculation
  - Nutrition recalculates live as portion changes
  - "Add to [Meal]" button shows selected meal type
  - Checkmark in header confirms and navigates back to search

### March 6, 2026 - Native App Build Setup Complete
- **COMPLETED**: Capacitor native app setup for iOS and Android
  - Added iOS platform (`/app/frontend/ios/`)
  - Added Android platform (`/app/frontend/android/`)
  - All 4 Capacitor plugins synced (app, haptics, keyboard, status-bar)
  - Created `README-NATIVE.md` with complete build instructions
  - NPM scripts added: `cap:sync`, `cap:open:ios`, `cap:open:android`, `build:mobile`
- **Search State Persistence**: Users now return to their search results when navigating back from food details

### March 5, 2026 - Debug & Optimization Pass
- **FIXED**: USDA FDC API 404 errors for food details
  - Added fallback to batch endpoint when single food endpoint returns 404
  - In-memory caching for food details (500 items max)
  - Better error handling for API failures
- **FIXED**: Missing calories in search results
  - Search now returns `calories_per_100g` along with `protein_per_100g`
  - Results display "224 cal · 24g protein" format
- **FIXED**: Food click navigation
  - Entire food row is now clickable (not just text area)
  - Improved touch targets for mobile users
- **NEW**: Meal Type Selector on Search Page
  - Breakfast, Lunch, Dinner, Snack buttons at top of search
  - Selected meal highlighted in green
  - URL param updates for meal persistence
- **CODE CLEANUP**: 
  - Fixed unused exception variables in Python
  - Added eslint-disable for intentional hook dependency omissions
  - Linting passes for both backend and frontend

### March 5, 2026 - Camera Button Fix & Cleanup
- **FIXED**: Missing Camera Button on Barcode Scanner Page
  - Redesigned barcode scanner page with prominent camera button
  - Large circular button (112x112px) with cyan-to-emerald gradient
  - "Tap to Scan" label clearly visible when camera available
  - Better mobile device detection - assumes camera available on mobile
  - Helpful error messages when camera unavailable (permission denied, not found)
  - Loading state while checking camera availability
  - Improved accessibility with aria-describedby on dialogs
- **CLEANUP**: Deleted unused `/app/frontend/src/pages/FoodSearch.jsx` file
  - FoodSearchNew.jsx is now the only search component

### March 4, 2026 - PWA & Native App Support
- **PWA Enhancement**:
  - Service worker for offline caching (static assets, API responses)
  - App manifest with app icons, shortcuts, and proper theme colors
  - Install prompt component (shows after 30s of use)
  - iOS-specific "Add to Home Screen" instructions
  - Safe area handling for notched devices
- **Capacitor Setup for Native Apps**:
  - iOS and Android build configuration
  - Native plugins: StatusBar, Keyboard, Haptics, App lifecycle
  - Build scripts: `yarn build:mobile`, `yarn cap:open:ios/android`
  - Native app splash screen and status bar customization
- **Mobile-First CSS**:
  - Dynamic viewport height (100dvh) for mobile browsers
  - Safe area insets for notched phones
  - Keyboard height handling
  - Touch-optimized interactions

### March 4, 2026 - Search Ranking & Mobile Optimization
- **NEW**: Smart Search Result Ranking
  - Prioritizes simple whole foods over complex meals/branded products
  - Scoring factors: exact match (+150), simplicity (+60 for 2 words), data source quality
  - Foundation foods ranked highest (+70), then SR Legacy (+65), Survey (+40), Branded (+5)
  - Amino acid availability bonus (+30)
  - Penalty for complex food indicators (with, sauce, casserole, etc.)
  - Searches USDA by data type: Foundation, SR Legacy, Survey, then Branded
- **NEW**: Dedicated Food Details Page
  - Clicking search result navigates to `/food/:fdcId` page (not split view)
  - "Back to Search" button for easy navigation
  - Full details: macros, amino acid radar chart, fatty acid profile
  - Add to Log dialog with servings and meal type
  - Favorite toggle functionality
- **IMPROVED**: Mobile-First UI Optimization
  - Responsive search page with 2-column category grid on mobile
  - Touch-friendly cards with `active:scale-95` feedback
  - Horizontal scroll for quick suggestions with `-mx-4 px-4` edge-to-edge
  - Food details page optimized for mobile with stacked layout
  - Bottom navigation bar for easy thumb access

### March 4, 2026 - Enhanced Suggestions & Total Carbs Update
- **ENHANCED**: Suggestions Page with Personalized Quick Actions
  - "Quick Suggestions for You" section at top of page
  - Personalized cards: "You're low on [Nutrient] - Try [Food]"
  - Search icon on each card to quickly find the suggested food
  - Shows top 2 amino acid gaps + 1 fatty acid gap
  - Badge counts on tabs showing deficiency numbers
  - Improved header with icon and updated description
- **CHANGED**: Carb Tracking Now Uses TOTAL Carbs (Not Net Carbs)
  - Keto Score calculation based on total carbs for conservative tracking
  - Dashboard displays "Total Carbs" label with fiber shown separately
  - Settings page note: "Based on total carbs (not net carbs)"
  - Education content updated to explain this approach
  - All keto-related messages reference "total carb limit"

### March 4, 2026 - User Engagement Features (Education, Onboarding, Community)
- **NEW**: Onboarding Flow for New Users
  - 4-step guided onboarding modal after first login
  - Step 1: Welcome screen with key features overview
  - Step 2: Set protein goal with quick presets (100g, 150g, 200g)
  - Step 3: Choose keto level (Strict/Moderate/Liberal)
  - Step 4: Education about unique features (amino acids, fatty acids)
  - Progress saved to user profile (onboarding_completed flag)
  - Automatically skipped for returning users
- **NEW**: Education Layer with Info Tooltips
  - InfoTooltip component shows quick explanations on hover
  - Added to Dashboard: Keto Score, Nutrition Score
  - Educational content for: completeProtein, aminoAcids, ketoScore, omegaRatio, nutritionScore, leanBodyMass
  - LearnMoreLink for expandable detailed articles
  - EducationCard for inline expandable content
- **NEW**: Public Meal Library (Community Feature)
  - Browse meals shared by other users at /meal-library
  - Search and filter by keto tier (ultra_low, low, moderate)
  - Sort by: recent, popular (likes), most saved, highest protein
  - Like and save meals from the community
  - Copy public meals to your own collection
  - Publish your custom meals to share with others
  - Meal cards show: macros, complete protein badge, author, likes/saves count
  - Full detail modal with ingredients list
- **Backend**: New API endpoints for meal library
  - POST /api/meals/publish/{id} - Make meal public
  - POST /api/meals/unpublish/{id} - Remove from library
  - GET /api/meals/library - Browse with search/filter/sort
  - POST /api/meals/library/{id}/like - Toggle like
  - POST /api/meals/library/{id}/save - Save to collection
  - DELETE /api/meals/library/{id}/unsave - Remove from saved
  - GET /api/meals/saved - Get user's saved meals
  - POST /api/meals/library/{id}/copy - Copy to own collection
- **Sidebar**: Added "Meal Library" navigation link

### March 4, 2026 - Theme Toggle, Portion Presets, Performance & UI Polish
- **NEW**: Dark/Light Theme Toggle
  - Theme toggle button in sidebar with Sun/Moon icon
  - Full light mode styling: white backgrounds, dark text, subtle shadows
  - Theme persists in localStorage across sessions
  - Smooth transition animations between themes
  - All components updated for theme support (Sidebar, GlassCard, Layout, all pages)
  - Improved text contrast throughout light mode
  - **DEFAULT changed to LIGHT MODE** (March 4, 2026)
- **NEW**: Imperial/Metric Unit Toggle
  - Toggle between metric (kg, cm) and imperial (lbs, in) units
  - Body weight displays in selected unit system
  - Lean Body Mass displays in selected unit system  
  - Unit preference saved to user profile
  - **DEFAULT changed to IMPERIAL** for new users (March 4, 2026)
- **REMOVED**: Portion Size Presets (March 4, 2026)
  - Quick portion buttons removed from Add to Log dialog
  - Users now manually enter servings value
- **CHANGED**: All Data Inputs Manual Entry (March 4, 2026)
  - Replaced all sliders with text inputs on Settings page:
    - Body Weight (kg/lbs)
    - Body Fat (%)
    - Protein per kg LBM (g/kg)
    - Daily Carb Limit (g)
  - Users now type values directly instead of using sliders
- **NEW**: Search Result Caching
  - Client-side cache with 5-minute TTL
  - Cached searches are ~100x faster
  - Toast shows "(cached)" for cached results
  - Cache auto-cleans expired entries
- **NEW**: Scroll to Top on Navigation
  - All pages now scroll to top when navigated to
  - Consistent user experience across page transitions
- **Fixed**: Light mode text contrast improved on all pages
  - Settings, Dashboard, Food Search, Custom Foods, etc.
- **NEW**: Unified Food Database Search
  - Parallel search across USDA FoodData Central and Open Food Facts APIs
  - Search results from both sources displayed with distinct badges:
    - Cyan for USDA items
    - Orange for Open Food Facts items
    - Purple for Custom foods
  - "AA Data" badge shows for USDA items with amino acid profiles (SR Legacy, Foundation, Survey)
  - Results sorted: Custom foods first → USDA with amino acids → Open Food Facts → USDA branded
  - Food details load from respective APIs (USDA or Open Food Facts)
  - "Basic Nutrition Data" notice for items without amino acid profiles
  - Add to Log and Favorite functionality works for both sources
  - OFF food IDs use `off:` prefix (e.g., `off:5449000054227`)
- **NEW**: Custom Foods UI
  - Full CRUD interface for user-created food entries
  - Form with name, brand, serving size, unit, macros (calories, protein, fat, carbs, fiber, sugar, sodium), notes
  - Edit and delete existing custom foods
  - Search/filter within custom foods list
  - Custom foods appear in unified search results with purple "Custom" badge
  - Navigation link added to sidebar
- **NEW**: Search Progress Indicator
  - Progress bar shows during search with "Searching USDA & Open Food Facts..." text
  - Animated percentage from 0% to 100%
  - Gradient from emerald to cyan color
- **NEW**: Dark/Light Theme Toggle
  - Theme toggle button in sidebar with Sun/Moon icon
  - Full light mode styling: white backgrounds, dark text, subtle shadows
  - Theme persists in localStorage across sessions
  - Smooth transition animations between themes
  - All components updated for theme support (Sidebar, GlassCard, Layout)
- **NEW**: Portion Size Presets
  - Quick portion buttons in Add to Log dialog: ¼, ½, 1, 1½, 2, 3, 4, 5
  - Clicking preset updates servings input instantly
  - Total calculation now shows both protein AND calories
- **NEW**: Search Result Caching
  - Client-side cache with 5-minute TTL
  - Cached searches are ~100x faster
  - Toast shows "(cached)" for cached results
  - Cache auto-cleans expired entries
- **Fixed**: Open Food Facts results previously being dropped from unified search
  - Improved error handling in async API calls
  - Increased timeout from 15s to 20s for better reliability
- **Note**: Search takes 15-25 seconds due to external API latency (instant if cached)

### March 2, 2026 - Essential Fatty Acids + Nutrition Score + P1 Features + Bug Fix + Refactoring
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
- **NEW**: Loading Skeleton States
  - DashboardSkeleton - Full page skeleton for dashboard
  - SearchResultsSkeleton - For food search results
  - FoodDetailSkeleton - For food detail panel
  - SuggestionsSkeleton - For suggestions page
  - Animated pulse effect with bioluminescent theme styling
- **NEW**: Mobile Responsive Refinements
  - Bottom navigation bar with 4 main items + "More" menu
  - "More" menu slides up with remaining nav items and logout
  - Safe area insets for iOS devices
  - Better touch targets (min 44px height)
  - 16px font size on inputs to prevent iOS zoom
- **NEW**: Camera-based Barcode Scanning
  - Uses native BarcodeDetector API when available
  - Quagga2 library fallback for older browsers
  - Supports EAN-13, EAN-8, UPC-A, UPC-E, Code-128
  - Visual scanning guide overlay on camera view
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
- [x] Fix camera button on barcode scanner page (DONE - March 5, 2026)
- [x] Native App Builds via Capacitor (DONE - March 6, 2026)

### P1 - High Priority
- [ ] **Voice Search** - "Add 2 eggs" style voice input
- [ ] **AI-Powered Features**:
  - AI Meal Planner - Generate full day/week of keto-friendly meals
  - "Snap a Pic" Food Logging - Image recognition to identify food
  - Conversational AI Coach - Chatbot for nutrition questions
- [x] Fix weekly stats to include current day (DONE - March 2, 2026)
- [x] Essential Fatty Acids tracking (DONE - March 2, 2026)
- [x] Combined Nutrition Score (DONE - March 2, 2026)
- [x] Camera-based barcode scanning with Quagga2 fallback (DONE - March 2, 2026)
- [x] Loading skeleton states for Dashboard, FoodSearch, Suggestions (DONE - March 2, 2026)
- [x] Mobile responsive refinements with bottom nav "More" menu (DONE - March 2, 2026)
- [x] Unified Food Search (USDA + Open Food Facts) (DONE - March 3, 2026)
- [x] Custom Foods feature - User-created food entries with macros (DONE - March 3, 2026)
- [x] Search progress indicator (DONE - March 3, 2026)
- [x] Dark/Light theme toggle (DONE - March 4, 2026)
- [x] Portion size presets (DONE - March 4, 2026)
- [x] Search result caching for performance (DONE - March 4, 2026)

### P2 - Medium Priority
- [ ] Search Performance Optimization - Improve slow Open Food Facts API responses
- [ ] Historical Trends V2 - Enhanced charting on Trends page
- [ ] Sharing V2 - Allow users to share custom meals with other users
- [ ] Duplicate meal from history
- [ ] Amino acid RDA customization based on body weight

### P3 - Low Priority
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
- Latest: `/app/test_reports/iteration_14.json`
- Backend: 100% (15/15 pytest tests passed)
- Frontend: 100% (all Playwright tests passed)
- Food Search/Details: All tests passing with caching verified

## Known Issues & Monitoring
- **Scrolling**: Has been a recurring issue. Current CSS fixes in `index.css` and `Layout.jsx` should be monitored during future layout changes.
- **Open Food Facts API**: Can be slow (3s timeout currently). Consider caching layer for frequent queries.

## Files Cleanup History
- March 5, 2026: Deleted `/app/frontend/src/pages/FoodSearch.jsx` (unused, replaced by FoodSearchNew.jsx)
