export const GRADES = [
  'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12'
] as const;

export type Grade = typeof GRADES[number];

export function getGradeNumber(grade: string): number {
  const match = grade.match(/V(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

export function compareGrades(a: string, b: string): number {
  return getGradeNumber(a) - getGradeNumber(b);
}

export function isValidGrade(grade: string): grade is Grade {
  return GRADES.includes(grade as Grade);
}

export function getGradeColor(grade: string): string {
  const gradeNum = getGradeNumber(grade);
  
  // Color progression from green (easy) to red (hard)
  if (gradeNum <= 2) return '#22c55e'; // green
  if (gradeNum <= 4) return '#eab308'; // yellow
  if (gradeNum <= 6) return '#f97316'; // orange
  if (gradeNum <= 8) return '#ef4444'; // red
  if (gradeNum <= 10) return '#8b5cf6'; // purple
  return '#1f2937'; // dark for V11+
}
