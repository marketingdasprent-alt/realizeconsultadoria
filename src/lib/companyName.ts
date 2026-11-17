// Nomes de empresas: para mostrar e ordenar. Há nomes na base com um espaço no início (por
// exemplo " Razão Dinâmica, Lda"), e o servidor ordena pelo texto tal como está.

/** O nome para mostrar: sem espaços a mais. */
export const companyLabel = (name: string): string => name.replace(/\s+/g, ' ').trim();

/** Compara por nome (ignora espaços a mais, acentos e maiúsculas). */
export const compareCompanyNames = (a: string, b: string): number =>
  companyLabel(a).localeCompare(companyLabel(b), 'pt-PT', { sensitivity: 'base' });

/** As empresas por ordem alfabética. */
export const sortCompanies = <T extends { name: string }>(companies: readonly T[]): T[] =>
  [...companies].sort((a, b) => compareCompanyNames(a.name, b.name));
