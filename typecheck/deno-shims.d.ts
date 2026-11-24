// Só para o `pnpm run type-check`: os testes em src/ importam código de supabase/functions, que
// corre em Deno. Estas declarações evitam falsos erros ali (Deno não existe no browser) sem mexer
// nas funções. O specifier https://esm.sh/@supabase/supabase-js@2 mapeia-se para o pacote local
// em tsconfig.app.json (paths). Não entra no bundle da app.
declare const Deno: {
  env: { get(name: string): string | undefined };
};
