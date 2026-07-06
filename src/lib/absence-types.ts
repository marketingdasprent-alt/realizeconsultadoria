/**
 * Centralized absence type labels in PT-PT
 * Used across all components that display absence types
 */
export const absenceTypeLabels: Record<string, string> = {
  vacation: 'Férias',
  sick_leave: 'Baixa Médica',
  appointment: 'Consultas',
  personal_leave: 'Licença Pessoal',
  maternity: 'Licença Maternidade',
  paternity: 'Licença Paternidade',
  training: 'Formação',
  other: 'Outro',
};

export const trainingModeLabels: Record<string, string> = {
  online: 'Online',
  in_person: 'Presencial',
};

/**
 * Centralized color per absence type — single source of truth reused by the
 * calendar print, the legend and any type badge/chip.
 * Light fill + dark text + medium border, chosen to be distinct and to print
 * well (readable on paper, survives `print-color-adjust: exact`).
 */
export interface AbsenceTypeColor {
  fill: string;
  text: string;
  border: string;
}

export const absenceTypeColors: Record<string, AbsenceTypeColor> = {
  vacation: { fill: '#dbeafe', text: '#1e3a8a', border: '#93c5fd' },
  sick_leave: { fill: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
  appointment: { fill: '#ccfbf1', text: '#115e59', border: '#5eead4' },
  personal_leave: { fill: '#ede9fe', text: '#5b21b6', border: '#c4b5fd' },
  maternity: { fill: '#fce7f3', text: '#9d174d', border: '#f9a8d4' },
  paternity: { fill: '#e0e7ff', text: '#3730a3', border: '#a5b4fc' },
  training: { fill: '#dcfce7', text: '#166534', border: '#86efac' },
  other: { fill: '#f3f4f6', text: '#374151', border: '#d1d5db' },
};

/** Fallback color for unknown/legacy absence types. */
export const defaultAbsenceTypeColor: AbsenceTypeColor = absenceTypeColors.other;
