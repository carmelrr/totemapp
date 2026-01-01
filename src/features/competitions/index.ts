/**
 * @fileoverview Competitions Feature - Public Exports
 * @description Main entry point for the competitions feature
 */

// Types
export * from './types';

// Constants
export * from './constants';

// Services
export { CompetitionService } from './services/CompetitionService';
export { ResultsService } from './services/ResultsService';
export { ParticipantService } from './services/ParticipantService';
export { JudgeService, DEFAULT_JUDGE_PERMISSIONS, FULL_JUDGE_PERMISSIONS } from './services/JudgeService';
export { CompetitionRoutesService } from './services/CompetitionRoutesService';

// Hooks
export {
  useCompetition,
  useActiveCompetitions,
  useAllCompetitions,
  useCompetitionLeaderboard,
  useParticipantResult,
  useParticipants,
  useJudges,
  useIsJudge,
  useCompetitionRoutes,
  useCompetitionTimer,
  useCompetitionData,
} from './hooks/useCompetition';

// Components
export { ActiveCompetitionBanner, CompetitionLeaderboard } from './components';

// Screens
export {
  CompetitionsListScreen,
  CreateCompetitionScreen,
  ManageCompetitionScreen,
  ManageParticipantsScreen,
  ManageJudgesScreen,
  ManageCompetitionRoutesScreen,
  JudgeEntryScreen,
} from './screens';
