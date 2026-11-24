/**
 * Avisa quando a conta do separador muda (outra conta a entrar, ou a sessão a terminar).
 * Devolve a função a chamar a cada evento de sessão com o id da conta (null = sem sessão).
 * A primeira conta e a mesma conta a renovar a sessão não contam; entrar com uma conta depois
 * de ter terminado a sessão também não (já se limpou ao terminar).
 */
export const createAccountWatcher = (onChange: (newUserId: string | null) => void) => {
  let owner: string | null = null;
  return (userId: string | null): void => {
    if (owner !== null && owner !== userId) onChange(userId);
    owner = userId;
  };
};
