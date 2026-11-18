// Erros ao gravar uma ficha de colaborador. O gatilho que mantém as pertenças (employees_sync_membership)
// pode chocar com o índice "um colaborador, uma empresa ativa": o Postgres dá 23505 e o nome do índice.

export const ONE_COMPANY_INDEX = 'company_memberships_one_active_employee_uq';

export const ONE_COMPANY_MESSAGE =
  'Esta pessoa já é colaborador ativo noutra empresa. Mova-a ou desative a outra ficha.';

interface DbErrorLike {
  code?: string;
  message?: string;
  details?: string | null;
}

/** É o 23505 do índice "um colaborador, uma empresa ativa" (e não outro duplicado, como o email). */
export const isOneCompanyViolation = (error: unknown): boolean => {
  const e = error as DbErrorLike | null;
  return (
    !!e && e.code === '23505' && `${e.message ?? ''} ${e.details ?? ''}`.includes(ONE_COMPANY_INDEX)
  );
};

/**
 * Devolve um erro com a frase clara em português (sem código) para a regra "uma só empresa";
 * qualquer outro erro passa como estava.
 */
export const friendlyEmployeeWriteError = (error: unknown): unknown =>
  isOneCompanyViolation(error) ? new Error(ONE_COMPANY_MESSAGE) : error;
