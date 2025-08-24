# ⚠️ DEPRECATED: Old Routes Service

**Date Deprecated**: August 24, 2025
**Replaced By**: 
- `src/features/routes-map/services/RoutesService.ts` - For route CRUD operations
- `src/features/routes-map/services/FeedbackService.ts` - For feedback management

## Why Was This Deprecated?

This old `routesService.ts` was deprecated as part of a consolidation effort to:

1. **Eliminate Code Duplication**: There were two AddRouteScreen components doing similar things
2. **Improve Architecture**: Separate route operations from feedback operations for better organization
3. **Enhance Type Safety**: Move to TypeScript class-based services with proper interfaces
4. **Modern Patterns**: Use static methods and better error handling

## Migration Guide

### Route Display Functions
```typescript
// OLD ❌
import { getDisplayGrade, getDisplayStarRating, getCompletionCount } from '@/features/routes/routesService';

// NEW ✅
import { RoutesService } from '@/features/routes-map/services/RoutesService';
RoutesService.getDisplayGrade(route)
RoutesService.getDisplayStarRating(route)
RoutesService.getCompletionCount(route)
```

### Feedback Operations
```typescript
// OLD ❌
import { addFeedbackToRoute, subscribeFeedbacksForRoute, deleteFeedback } from '@/features/routes/routesService';

// NEW ✅
import { FeedbackService } from '@/features/routes-map/services/FeedbackService';
FeedbackService.addFeedbackToRoute(routeId, feedbackData)
FeedbackService.subscribeFeedbacksForRoute(routeId, callback)
FeedbackService.deleteFeedback(feedbackId)
```

### Route CRUD Operations
```typescript
// OLD ❌
import { addRoute, updateRoute, subscribeToRoutes } from '@/features/routes/routesService';

// NEW ✅
import { RoutesService } from '@/features/routes-map/services/RoutesService';
RoutesService.addRoute(routeData)
RoutesService.updateRoute(id, data)
RoutesService.subscribeRoutes(callback)
```

## Files Successfully Migrated

- ✅ `src/components/routes/RouteCircle.tsx`
- ✅ `src/components/routes/RouteDialog.tsx`
- ✅ `src/components/routes/RouteFeedbackView.tsx`
- ✅ `src/components/routes/RouteList.tsx`
- ✅ `src/screens/profile/services/profileService.ts`

All components have been updated to use the new service architecture.
