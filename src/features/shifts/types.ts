/**
 * @fileoverview Shift Management Types
 * @description Type definitions for the shift management system
 */

/**
 * Shift role - a type of work position at the climbing wall
 * (separate from UserRole which are app-level permissions)
 */
export interface ShiftRole {
  id: string;
  name: string;           // Hebrew name (e.g., "עובד דלפק")
  nameEn: string;         // English name (e.g., "Desk Worker")
  description: string;    // Hebrew description
  color: string;          // Badge color
  icon: string;           // Emoji icon
  isActive: boolean;      // Whether the role is currently in use
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Association between a user and shift roles they can fill
 */
export interface UserShiftRole {
  id: string;             // Firestore doc ID
  userId: string;
  userName: string;       // Display name (for quick display)
  shiftRoleIds: string[]; // Which shift roles this user can fill
  isActive: boolean;      // Whether user is active as a worker
  isShiftManager: boolean; // Can manage shifts (revoke/reassign)
  createdAt: Date;
  updatedAt: Date;
  updatedBy: string;      // Admin who last updated
}

/**
 * Shift status lifecycle
 */
export type ShiftStatus = 
  | 'open'            // Open for registration
  | 'closed'          // Registration closed, pending assignment
  | 'assigned'        // Workers assigned
  | 'completed'       // Shift completed
  | 'cancelled';      // Shift cancelled

/**
 * Recurrence pattern for recurring shifts
 */
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';

export interface RecurrencePattern {
  type: RecurrenceType;
  /** Days of week (0=Sunday, 6=Saturday) for weekly/biweekly */
  daysOfWeek?: number[];
  /** Day of month for monthly */
  dayOfMonth?: number;
  /** End date for recurrence */
  endDate?: Date;
  /** Number of occurrences (alternative to endDate) */
  occurrences?: number;
}

/**
 * A single shift instance
 */
export interface Shift {
  id: string;
  /** Which shift roles are needed */
  requiredRoleIds: string[];
  /** Display title (optional override) */
  title?: string;
  /** Description / notes */
  description?: string;
  /** Shift start time */
  startTime: Date;
  /** Shift end time */
  endTime: Date;
  /** Maximum number of workers needed */
  maxWorkers: number;
  /** Minimum workers needed (optional) */
  minWorkers?: number;
  /** Current status */
  status: ShiftStatus;
  /** Recurrence pattern */
  recurrence: RecurrencePattern;
  /** Parent recurring shift ID (if this is an instance of a recurring shift) */
  parentShiftId?: string;
  /** Assigned worker IDs */
  assignedWorkerIds: string[];
  /** Created by admin */
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Shift registration status
 */
export type RegistrationStatus = 
  | 'pending'         // Waiting for admin approval
  | 'approved'        // Approved and assigned
  | 'rejected'        // Rejected by admin
  | 'waitlisted'      // On the wait list
  | 'cancelled';      // Cancelled by user or admin

/**
 * Worker registration for a shift
 */
export interface ShiftRegistration {
  id: string;
  shiftId: string;
  userId: string;
  userName: string;     // Display name snapshot
  /** Which of the user's shift roles they're registering with */
  shiftRoleId: string;
  status: RegistrationStatus;
  /** Optional note from worker */
  note?: string;
  /** Admin note (reason for rejection, etc.) */
  adminNote?: string;
  /** Waitlist position (if waitlisted) */
  waitlistPosition?: number;
  createdAt: Date;
  updatedAt: Date;
  /** Admin who handled the registration */
  handledBy?: string;
}

/**
 * Shift history log entry
 */
export interface ShiftHistoryEntry {
  id: string;
  shiftId: string;
  action: ShiftHistoryAction;
  performedBy: string;
  performedByName: string;
  targetUserId?: string;
  targetUserName?: string;
  details?: string;
  timestamp: Date;
}

export type ShiftHistoryAction =
  | 'shift_created'
  | 'shift_updated'
  | 'shift_cancelled'
  | 'shift_completed'
  | 'status_changed'
  | 'registration_submitted'
  | 'registration_approved'
  | 'registration_rejected'
  | 'registration_waitlisted'
  | 'registration_cancelled'
  | 'worker_assigned'
  | 'worker_removed'
  | 'swap_requested'
  | 'swap_accepted'
  | 'swap_rejected';

/**
 * Swap request status
 */
export type SwapRequestStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

/**
 * A request from one worker to another to swap/take over a shift
 */
export interface ShiftSwapRequest {
  id: string;
  shiftId: string;
  registrationId: string;
  /** User requesting to give away the shift */
  requesterId: string;
  requesterName: string;
  /** User being asked to take the shift */
  targetUserId: string;
  targetUserName: string;
  /** The shift role for this swap */
  shiftRoleId: string;
  status: SwapRequestStatus;
  /** Optional message from requester */
  message?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Calendar view mode
 */
export type CalendarViewMode = 'day' | 'week' | 'month';

/**
 * Shift filter options
 */
export interface ShiftFilter {
  roleId?: string;
  status?: ShiftStatus;
  dateFrom?: Date;
  dateTo?: Date;
  userId?: string;
  showOnlyMyShifts?: boolean;
}

/**
 * Shift with computed display data
 */
export interface ShiftWithDetails extends Shift {
  /** Resolved role objects */
  roles: ShiftRole[];
  /** Number of approved registrations */
  approvedCount: number;
  /** Number of pending registrations */
  pendingCount: number;
  /** Whether current user has registered */
  userRegistration?: ShiftRegistration;
}
