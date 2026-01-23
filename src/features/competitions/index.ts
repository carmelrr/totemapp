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
export { CompetitionRoutesService } from './services/CompetitionRoutesService';

// Hooks
export {
  useCompetition,
  useActiveCompetitions,
  useAllCompetitions,
  useOpenRegistrationCompetitions,
  useCompletedCompetitionsWithResults,
  useCompetitionLeaderboard,
  useParticipantResult,
  useParticipants,
  useCompetitionRoutes,
  useCompetitionTimer,
  useCompetitionData,
} from './hooks/useCompetition';

// Components
export { ActiveCompetitionBanner, OpenRegistrationBanner, CompletedCompetitionBanner, CompetitionLeaderboard } from './components';

// Screens
export {
  CompetitionsListScreen,
  CreateCompetitionScreen,
  ManageCompetitionScreen,
  ManageParticipantsScreen,
  ManageCategoriesScreen,
  ManageCompetitionRoutesScreen,
  JudgeEntryScreen,
  CompetitionRegistrationScreen,
} from './screens';
