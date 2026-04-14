/**
 * Centralized absence type labels in PT-PT
 * Used across all components that display absence types
 */
export const absenceTypeLabels: Record<string, string> = {
  vacation: "Férias",
  sick_leave: "Baixa Médica",
  appointment: "Consultas",
  personal_leave: "Licença Pessoal",
  maternity: "Licença Maternidade",
  paternity: "Licença Paternidade",
  training: "Formação",
  other: "Outro",
};

export const trainingModeLabels: Record<string, string> = {
  online: "Online",
  in_person: "Presencial",
};
