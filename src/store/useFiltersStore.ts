import { create } from 'zustand';
import { RouteDoc } from '@/features/routes-map/types/route';

export type CompletionFilter = 'all' | 'completed' | 'not-completed';

export interface RouteFilters {
  // סינון לפי מעגלים/צבעים
  circuits: string[];
  colors: string[];
  
  // סינון לפי דרגות
  gradeRange: {
    min: string;
    max: string;
  };
  
  // סינון לפי תאריך הוספה (תאריך ספציפי או 'all')
  // פורמט: 'all' או תאריך בפורמט YYYY-MM-DD
  dateRange: string;
  
  // סינון לפי סטטוס
  status: ('active' | 'archived' | 'draft')[];
  
  // סינון לפי קיר/סקטור
  walls: string[];
  sectors: string[];
  
  // סינון לפי סטטוס אישי (טיקים)
  personalStatus: ('unsent' | 'project' | 'sent' | 'flashed')[];
  
  // סינון לפי סטטוס סגירה אישי
  completionStatus: CompletionFilter;
  
  // סינון לפי תגיות
  tags: string[];
  
  // הצגת מסלולים נראים במפה בלבד
  showOnlyVisibleOnMap: boolean;
}

export interface RouteSorting {
  sortBy: 'grade' | 'date' | 'name' | 'distance' | 'popularity';
  sortOrder: 'asc' | 'desc';
}

export interface FiltersState {
  // מצב הפילטרים
  filters: RouteFilters;
  sorting: RouteSorting;
  
  // מצבי UI
  isFilterSheetOpen: boolean;
  searchQuery: string;
  
  // פעולות
  setFilter: <K extends keyof RouteFilters>(key: K, value: RouteFilters[K]) => void;
  setSorting: (sorting: Partial<RouteSorting>) => void;
  resetFilters: () => void;
  setSearchQuery: (query: string) => void;
  setFilterSheetOpen: (open: boolean) => void;
  
  // פונקציות עזר
  getFilteredRoutes: (routes: RouteDoc[], visibleRouteIds?: string[], completedRouteIds?: Set<string>) => RouteDoc[];
  getActiveFiltersCount: () => number;
}

const defaultFilters: RouteFilters = {
  circuits: [],
  colors: [],
  gradeRange: { min: '', max: '' },
  dateRange: 'all',
  status: ['active'],
  walls: [],
  sectors: [],
  personalStatus: [],
  completionStatus: 'all',
  tags: [],
  showOnlyVisibleOnMap: true, // Default to true for map-list synchronization
};

const defaultSorting: RouteSorting = {
  sortBy: 'distance',
  sortOrder: 'asc',
};

// דרגות טיפוס מסודרות (V-Scale) - עד V18
const GRADE_ORDER = [
  'VB', 'V0', 'V0+', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10',
  'V11', 'V12', 'V13', 'V14', 'V15', 'V16', 'V17', 'V18',
];

function compareGrades(gradeA: string, gradeB: string): number {
  const indexA = GRADE_ORDER.indexOf(gradeA);
  const indexB = GRADE_ORDER.indexOf(gradeB);
  
  if (indexA === -1 && indexB === -1) return gradeA.localeCompare(gradeB);
  if (indexA === -1) return 1;
  if (indexB === -1) return -1;
  
  return indexA - indexB;
}

/**
 * Standalone pure filtering function — stable reference for useMemo consumers.
 * Avoids re-compute when unrelated Zustand state (isFilterSheetOpen, etc.) changes.
 */
export function filterRoutes(
  routes: RouteDoc[],
  filters: RouteFilters,
  sorting: RouteSorting,
  searchQuery: string,
  visibleRouteIds?: string[],
  completedRouteIds?: Set<string>,
): RouteDoc[] {
  let filteredRoutes = routes;

  if (filters.showOnlyVisibleOnMap && visibleRouteIds) {
    filteredRoutes = filteredRoutes.filter(route => visibleRouteIds.includes(route.id));
  }

  if (filters.completionStatus && filters.completionStatus !== 'all' && completedRouteIds) {
    if (filters.completionStatus === 'completed') {
      filteredRoutes = filteredRoutes.filter(route => completedRouteIds.has(route.id));
    } else if (filters.completionStatus === 'not-completed') {
      filteredRoutes = filteredRoutes.filter(route => !completedRouteIds.has(route.id));
    }
  }

  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filteredRoutes = filteredRoutes.filter(route =>
      route.name?.toLowerCase().includes(query) ||
      route.grade.toLowerCase().includes(query) ||
      route.setter?.toLowerCase().includes(query)
    );
  }

  if (filters.status.length > 0) {
    filteredRoutes = filteredRoutes.filter(route =>
      filters.status.includes(route.status || 'active')
    );
  }

  if (filters.colors.length > 0) {
    filteredRoutes = filteredRoutes.filter(route =>
      filters.colors.includes(route.color)
    );
  }

  if (filters.gradeRange.min || filters.gradeRange.max) {
    const minIndex = filters.gradeRange.min ? GRADE_ORDER.indexOf(filters.gradeRange.min) : 0;
    const maxIndex = filters.gradeRange.max ? GRADE_ORDER.indexOf(filters.gradeRange.max) : GRADE_ORDER.length - 1;
    filteredRoutes = filteredRoutes.filter(route => {
      const routeGradeIndex = GRADE_ORDER.indexOf(route.grade);
      return routeGradeIndex >= minIndex && routeGradeIndex <= maxIndex;
    });
  }

  if (filters.dateRange && filters.dateRange !== 'all') {
    const selectedDate = new Date(filters.dateRange);
    const startOfDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    const endOfDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + 1);
    filteredRoutes = filteredRoutes.filter(route => {
      if (!route.createdAt) return false;
      const routeDate = route.createdAt.toDate ? route.createdAt.toDate() : new Date(route.createdAt);
      return routeDate >= startOfDay && routeDate < endOfDay;
    });
  }

  if (filters.tags.length > 0) {
    filteredRoutes = filteredRoutes.filter(route =>
      route.tags?.some(tag => filters.tags.includes(tag))
    );
  }

  filteredRoutes = [...filteredRoutes].sort((a, b) => {
    let comparison = 0;
    switch (sorting.sortBy) {
      case 'grade':
        comparison = compareGrades(a.grade, b.grade);
        break;
      case 'name':
        comparison = (a.name || '').localeCompare(b.name || '');
        break;
      case 'date':
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        comparison = aTime - bTime;
        break;
      case 'popularity':
        comparison = (b.tops || 0) - (a.tops || 0);
        break;
      case 'distance':
      default:
        comparison = 0;
        break;
    }
    return sorting.sortOrder === 'desc' ? -comparison : comparison;
  });

  return filteredRoutes;
}

export const useFiltersStore = create<FiltersState>((set, get) => ({
  filters: defaultFilters,
  sorting: defaultSorting,
  isFilterSheetOpen: false,
  searchQuery: '',

  setFilter: (key, value) => {
    set((state) => ({
      filters: {
        ...state.filters,
        [key]: value,
      },
    }));
  },

  setSorting: (sorting) => {
    set((state) => ({
      sorting: {
        ...state.sorting,
        ...sorting,
      },
    }));
  },

  resetFilters: () => {
    set({
      filters: defaultFilters,
      searchQuery: '',
    });
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },

  setFilterSheetOpen: (open) => {
    set({ isFilterSheetOpen: open });
  },

  getFilteredRoutes: (routes, visibleRouteIds, completedRouteIds) => {
    const { filters, sorting, searchQuery } = get();
    return filterRoutes(routes, filters, sorting, searchQuery, visibleRouteIds, completedRouteIds);
  },

  getActiveFiltersCount: () => {
    const { filters, searchQuery } = get();
    let count = 0;
    
    if (searchQuery.trim()) count++;
    if (filters.circuits.length > 0) count++;
    if (filters.colors.length > 0) count++;
    if (filters.gradeRange.min || filters.gradeRange.max) count++;
    if (filters.dateRange && filters.dateRange !== 'all') count++;
    if (filters.status.length !== 1 || filters.status[0] !== 'active') count++;
    if (filters.walls.length > 0) count++;
    if (filters.sectors.length > 0) count++;
    if (filters.personalStatus.length > 0) count++;
    if (filters.completionStatus && filters.completionStatus !== 'all') count++;
    if (filters.tags.length > 0) count++;
    if (!filters.showOnlyVisibleOnMap) count++;
    
    return count;
  },
}));
