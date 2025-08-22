# FIREBASE MAP - Final Report
Generated: 2025-08-22

## Firebase Configuration
**Location**: `src/features/data/firebase.ts`
- Consolidated from old `firebase-config.js`
- Includes app initialization, auth persistence, and exports

## Collections Structure

### Primary Collections
1. **routes** - Main climbing routes
   - Access: `src/features/routes/routesService.ts`
   - Operations: CRUD for climbing routes, feedback management

2. **walls** - Spray wall definitions
   - Access: `src/features/data/firebase.ts` (`saveWall`, `getWall`)
   - Operations: Wall metadata, image management

3. **spray_seasons** - Spray wall seasonal data
   - Access: `src/features/spraywall/sprayApi.ts`
   - Operations: Season management, route tracking

4. **spray_routes** - Individual spray wall routes
   - Access: `src/features/spraywall/sprayApi.ts`
   - Operations: Route creation, completion tracking

5. **spray_route_completions** - Completion tracking
   - Access: `src/features/spraywall/sprayApi.ts`
   - Operations: User completion records, statistics

6. **feedback** - Route feedback and ratings
   - Access: `src/features/routes/routesService.ts`
   - Operations: Star ratings, difficulty suggestions, route closures

### Authentication
- **Provider**: Firebase Auth with Google OAuth
- **Implementation**: `src/features/auth/GoogleAuth.tsx`
- **Context**: `src/features/auth/UserContext.tsx`
- **Persistence**: React Native AsyncStorage integration

### Storage
- **Images**: Firebase Storage
- **Path Structure**:
  - `/spray_walls/{wallId}/seasons/{seasonId}/wall_image.jpg`
  - `/spray_walls/{wallId}/seasons/{seasonId}/routes/{routeId}/route_image.jpg`
- **Access**: `src/features/spraywall/sprayApi.ts`, `src/features/data/firebase.ts`

## Access Patterns

### Direct Firebase Access
- `src/features/data/firebase.ts` - Core configuration and wall operations
- `src/features/routes/routesService.ts` - Route CRUD operations
- `src/features/spraywall/sprayApi.ts` - Spray wall operations
- `src/features/social/socialService.ts` - Social features

### Service Layer
All screens access Firebase through dedicated service layers:
- **Routes**: Through `routesService.ts`
- **Spray Wall**: Through `sprayApi.ts`
- **Social**: Through `socialService.ts`
- **Auth**: Through `UserContext.tsx` and `GoogleAuth.tsx`

## Real-time Subscriptions
- **Routes**: `subscribeToRoutes()` in routesService
- **Spray Routes**: `subscribeToSprayRoutes()` in sprayApi
- **Feedback**: `subscribeFeedbacksForRoute()` in routesService

## Security
- **Rules**: `firestore.rules`, `storage.rules`
- **Permissions**: `src/features/auth/permissions.ts`
- **Role-based Access**: Admin detection and enforcement

**Status**: ✅ **CENTRALIZED** - All Firebase access consolidated and organized
