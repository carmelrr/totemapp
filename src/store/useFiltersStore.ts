import { create } from 'zustand';
import { RouteDoc } from '@/features/routes-map/types/route';

export interface RouteFilters {
  // סינון לפי מעגלים/צבעים
  circuits: string[];
  colors: string[];
  
  // סינון לפי דרגות
  gradeRange: {
    min: string;
    max: string;
  };
  
  // סינון לפי סטטוס
  status: ('active' | 'archived' | 'draft')[];
  
  // סינון לפי קיר/סקטור
  walls: string[];
  sectors: string[];
  
  // סינון לפי סטטוס אישי (טיקים)
  personalStatus: ('unsent' | 'project' | 'sent' | 'flashed')[];
  
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
  getFilteredRoutes: (routes: RouteDoc[], visibleRouteIds?: string[]) => RouteDoc[];
  getActiveFiltersCount: () => number;
}

const defaultFilters: RouteFilters = {
  circuits: [],
  colors: [],
  gradeRange: { min: '', max: '' },
  status: ['active'],
  walls: [],
  sectors: [],
  personalStatus: [],
  tags: [],
  showOnlyVisibleOnMap: true,
};

const defaultSorting: RouteSorting = {
  sortBy: 'distance',
  sortOrder: 'asc',
};

// דרגות טיפוס מסודרות (V-Scale)
const GRADE_ORDER = [
  'VB', 'V0', 'V0+', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10',
  'V11', 'V12', 'V13', 'V14', 'V15', 'V16', 'V17',
];

function compareGrades(gradeA: string, gradeB: string): number {
  const indexA = GRADE_ORDER.indexOf(gradeA);
  const indexB = GRADE_ORDER.indexOf(gradeB);
  
  if (indexA === -1 && indexB === -1) return gradeA.localeCompare(gradeB);
  if (indexA === -1) return 1;
  if (indexB === -1) return -1;
  
  return indexA - indexB;
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

  getFilteredRoutes: (routes, visibleRouteIds) => {
    const { filters, sorting, searchQuery } = get();
    
    let filteredRoutes = routes;

    // סינון לפי מסלולים נראים במפה
    if (filters.showOnlyVisibleOnMap && visibleRouteIds) {
      filteredRoutes = filteredRoutes.filter(route => visibleRouteIds.includes(route.id));
    }

    // סינון לפי חיפוש טקסט
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filteredRoutes = filteredRoutes.filter(route => 
        route.name?.toLowerCase().includes(query) ||
        route.grade.toLowerCase().includes(query) ||
        route.setter?.toLowerCase().includes(query)
      );
    }

    // סינון לפי סטטוס
    if (filters.status.length > 0) {
      filteredRoutes = filteredRoutes.filter(route => 
        filters.status.includes(route.status || 'active')
      );
    }

    // סינון לפי צבעים
    if (filters.colors.length > 0) {
      filteredRoutes = filteredRoutes.filter(route => 
        filters.colors.includes(route.color)
      );
    }

    // סינון לפי דרגות
    if (filters.gradeRange.min || filters.gradeRange.max) {
      filteredRoutes = filteredRoutes.filter(route => {
        const routeGradeIndex = GRADE_ORDER.indexOf(route.grade);
        const minIndex = filters.gradeRange.min ? GRADE_ORDER.indexOf(filters.gradeRange.min) : 0;
        const maxIndex = filters.gradeRange.max ? GRADE_ORDER.indexOf(filters.gradeRange.max) : GRADE_ORDER.length - 1;
        
        return routeGradeIndex >= minIndex && routeGradeIndex <= maxIndex;
      });
    }

    // סינון לפי תגיות
    if (filters.tags.length > 0) {
      filteredRoutes = filteredRoutes.filter(route => 
        route.tags?.some(tag => filters.tags.includes(tag))
      );
    }

    // מיון
    filteredRoutes.sort((a, b) => {
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
          // מיון לפי מרחק ממרכז המסך (יצוין בפונקציה קוראת)
          comparison = 0;
          break;
      }
      
      return sorting.sortOrder === 'desc' ? -comparison : comparison;
    });

    return filteredRoutes;
  },

  getActiveFiltersCount: () => {
    const { filters, searchQuery } = get();
    let count = 0;
    
    if (searchQuery.trim()) count++;
    if (filters.circuits.length > 0) count++;
    if (filters.colors.length > 0) count++;
    if (filters.gradeRange.min || filters.gradeRange.max) count++;
    if (filters.status.length !== 1 || filters.status[0] !== 'active') count++;
    if (filters.walls.length > 0) count++;
    if (filters.sectors.length > 0) count++;
    if (filters.personalStatus.length > 0) count++;
    if (filters.tags.length > 0) count++;
    if (!filters.showOnlyVisibleOnMap) count++;
    
    return count;
  },
}));
