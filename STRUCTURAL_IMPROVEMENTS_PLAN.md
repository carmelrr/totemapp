# 🏗️ Organizational and Structural Improvements Plan

## Current State Analysis

### ✅ What's Already Good
- Feature-based folder structure (routes-map, auth, social, etc.)
- Use of @/ aliases for imports
- Zustand store for filters (useFiltersStore.ts)
- Separated services (FeedbackService, UserStatsService, RouteStatsService)

### 🔧 Areas for Improvement

## 1. 📦 Business Logic Separation

### Current Issues:
- Mixed responsibilities in some services
- State management scattered across different patterns
- Some business logic still in components

### Proposed Structure:
```
src/
├── services/                    # 🆕 Global business services
│   ├── feedback/
│   │   ├── FeedbackService.ts
│   │   └── FeedbackUtils.ts
│   ├── routes/
│   │   ├── RoutesService.ts
│   │   └── RouteStatsService.ts
│   ├── users/
│   │   ├── UserService.ts
│   │   └── UserStatsService.ts
│   └── auth/
│       └── AuthService.ts
├── store/                       # 🆕 Unified state management
│   ├── filtersStore.ts
│   ├── routesStore.ts          # 🆕 Global routes state
│   ├── userStore.ts            # 🆕 Global user state
│   └── index.ts                # 🆕 Store exports
└── utils/                       # ✅ Already exists
    ├── businessLogic/          # 🆕 Pure business logic
    │   ├── routeCalculations.ts
    │   ├── feedbackCalculations.ts
    │   └── userStatistics.ts
    └── ...
```

## 2. 🏪 Unified State Management Strategy

### Current State:
- ✅ Zustand: Filters (useFiltersStore.ts)
- ✅ Context: Auth, User
- ❌ Local state: Routes loading, individual screen states

### Proposed Unified Approach:
**Use Zustand as primary state management with Context for auth only**

#### New Stores to Create:
1. **RoutesStore** - Global routes data and loading states
2. **UserStore** - Current user data and preferences  
3. **FeedbackStore** - Feedback data management
4. **UIStore** - Global UI states (modals, loading, etc.)

## 3. 📁 Folder Structure Consolidation

### Current Duplication Issues:
- `src/canvas/` AND `src/components/canvas/`
- `src/navigation/` (single file) - should be in app structure

### Proposed Consolidation:
```
src/
├── components/
│   ├── canvas/                 # 🔄 Merge both canvas directories here
│   │   ├── WallMap.tsx        # Move from components/map/
│   │   ├── CanvasDrawing.tsx
│   │   └── index.ts
│   ├── feedback/               # ✅ Already refactored
│   ├── ui/                     # ✅ Already exists
│   └── ...
├── navigation/                 # 🔄 Keep all navigation here
│   ├── AppNavigator.tsx       # 🆕 Main app navigation
│   ├── SprayNavigator.tsx     # ✅ Already exists
│   └── index.ts               # 🆕 Navigation exports
└── ...
```

## 4. 📝 Import Standards and Linting

### Current Issues:
- Mixed quote styles (" vs ')
- Inconsistent import ordering
- Some relative imports where aliases could be used

### Proposed Standards:
- **Always use @/ aliases** for src/ imports
- **Consistent import order**: External packages → Internal modules → Types
- **Single quotes** throughout the project
- **Prettier + ESLint** configuration for automation

## 5. 🧹 Code Style Consistency

### Proposed ESLint + Prettier Configuration:
```json
{
  "extends": ["@expo/eslint-config"],
  "rules": {
    "quotes": ["error", "single"],
    "import/order": [
      "error",
      {
        "groups": [
          "builtin",
          "external", 
          "internal",
          "parent",
          "sibling",
          "index"
        ],
        "pathGroups": [
          {
            "pattern": "@/**",
            "group": "internal"
          }
        ]
      }
    ]
  }
}
```

## Implementation Priority

### Phase 1: Core Infrastructure (High Priority)
1. ✅ Service separation (Already done with FeedbackService refactor)
2. 🔄 Create unified Zustand stores
3. 🔄 Consolidate canvas/map directories
4. 🔄 Setup ESLint/Prettier configuration

### Phase 2: State Management Migration (Medium Priority)  
1. 🔄 Migrate routes loading to RoutesStore
2. 🔄 Migrate user data to UserStore
3. 🔄 Remove local state where possible

### Phase 3: Polish and Documentation (Low Priority)
1. 🔄 Standardize all imports
2. 🔄 Update documentation
3. 🔄 Create style guide

## Expected Benefits

### 🎯 Developer Experience
- **Faster navigation** - Clear, consistent structure
- **Easier debugging** - Centralized state management
- **Better IntelliSense** - Proper TypeScript integration
- **Reduced cognitive load** - Know exactly where to find/add code

### 🚀 Performance
- **Better caching** - Centralized data management
- **Reduced re-renders** - Optimized Zustand selectors
- **Smaller bundle** - No duplicate business logic

### 🔧 Maintenance
- **Single source of truth** - One place for each concern
- **Easier testing** - Isolated business logic
- **Consistent patterns** - New developers can follow established patterns
