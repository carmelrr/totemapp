/**
 * @fileoverview Shifts Feature Index
 * @description Export all shift management functionality
 */

// Types
export * from './types';

// Constants
export * from './constants';

// Service
export * from './shiftsService';
export * from './tasksService';

// Hooks
export {
  useShiftRoles,
  useMyShiftRoles,
  useAllUserShiftRoles,
  useShifts,
  useMyVisibleShifts,
  useShiftRegistrations,
  useMyRegistrations,
  useShiftsWithDetails,
  useIncomingSwapRequests,
  useOutgoingSwapRequests,
} from './hooks';
export { useTaskLists, useMyShiftTasks, useShiftTasks } from './tasksHooks';

// Screens
export { ShiftsCalendarScreen } from './screens/ShiftsCalendarScreen';
export { ShiftEditorScreen } from './screens/ShiftEditorScreen';
export { ShiftDetailScreen } from './screens/ShiftDetailScreen';
export { ShiftRolesManagementScreen } from './screens/ShiftRolesManagementScreen';
export { TaskListsManagementScreen } from './screens/TaskListsManagementScreen';
export { MyTasksScreen } from './screens/MyTasksScreen';
