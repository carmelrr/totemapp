// constants/roles.ts
import { HoldRole } from '../features/routes/types';
import { HOLD_COLORS } from './colors';

export const HOLD_ROLE_CONFIG = {
  start: {
    color: HOLD_COLORS.start,
    name: 'התחלה',
    icon: '🟢',
    description: 'אחיזת התחלה'
  },
  finish: {
    color: HOLD_COLORS.finish,
    name: 'סיום',
    icon: '🔴',
    description: 'אחיזת סיום'
  },
  hand: {
    color: HOLD_COLORS.hand,
    name: 'יד',
    icon: '⚪',
    description: 'אחיזה ליד בלבד'
  },
  foot: {
    color: HOLD_COLORS.foot,
    name: 'רגל',
    icon: '🔵',
    description: 'אחיזה לרגל בלבד'
  },
  any: {
    color: HOLD_COLORS.any,
    name: 'כל',
    icon: '🟡',
    description: 'אחיזה כללית (יד או רגל)'
  }
} as const;

export const ROLE_ORDER: HoldRole[] = ['start', 'hand', 'foot', 'any', 'finish'];

export const getHoldRoleConfig = (role: HoldRole) => HOLD_ROLE_CONFIG[role];
