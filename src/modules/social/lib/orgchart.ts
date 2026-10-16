// Organograma a partir do diretório: empresa → direção → departamentos → pessoas.
// A BD não guarda chefias; usamos o departamento e o cargo de cada colaborador.
import { canonicalLabels, compareText, fold, matchesText } from '@/lib/text';
import type { DirectoryPerson } from '@/modules/messenger/types';

export const NO_DEPARTMENT = 'Outros';

/** Cargos de chefia aparecem primeiro dentro do departamento. */
const LEAD_PATTERN =
  /\b(ceo|cfo|coo|cto|administrador|administradora|diretor|diretora|director|directora|gerente|gestor|gestora|respons[aá]vel|coordenador|coordenadora|chefe|head|manager|supervisor|supervisora)\b/i;

/** Departamentos que ficam no topo, entre a empresa e os restantes. */
const BOARD_PATTERN = /^(dire[cç][aã]o|administra[cç][aã]o|ger[eê]ncia|board)/i;

export interface OrgDepartment {
  name: string;
  people: DirectoryPerson[];
}

export interface OrgChart {
  board: OrgDepartment | null;
  departments: OrgDepartment[];
  total: number;
}

export const isLead = (person: Pick<DirectoryPerson, 'position'>) =>
  !!person.position && LEAD_PATTERN.test(person.position);

const matches = (person: DirectoryPerson, term: string) =>
  matchesText(term, person.name, person.position, person.department);

/**
 * Agrupa por departamento (chefias primeiro, depois por nome). Com pesquisa, ficam só as
 * pessoas que correspondem — ou o departamento inteiro, se o nome dele corresponder.
 */
export const buildOrgChart = (people: DirectoryPerson[], search = ''): OrgChart => {
  const term = search.trim();
  // "contabilidade" e "Contabilidade" são o mesmo departamento.
  const labels = canonicalLabels(people.map(p => p.department));
  const groups = new Map<string, DirectoryPerson[]>();
  for (const person of people) {
    const name = labels.get(fold(person.department)) ?? NO_DEPARTMENT;
    groups.set(name, [...(groups.get(name) ?? []), person]);
  }

  const departments: OrgDepartment[] = [];
  for (const [name, members] of groups) {
    const visible =
      !term || matchesText(term, name) ? members : members.filter(p => matches(p, term));
    if (!visible.length) continue;
    departments.push({
      name,
      people: [...visible].sort(
        (a, b) => Number(isLead(b)) - Number(isLead(a)) || compareText(a.name, b.name)
      ),
    });
  }
  departments.sort((a, b) =>
    a.name === NO_DEPARTMENT ? 1 : b.name === NO_DEPARTMENT ? -1 : compareText(a.name, b.name)
  );

  const boardIndex = departments.findIndex(d => BOARD_PATTERN.test(d.name));
  const board = boardIndex >= 0 ? departments.splice(boardIndex, 1)[0] : null;
  const total = (board?.people.length ?? 0) + departments.reduce((n, d) => n + d.people.length, 0);
  return { board, departments, total };
};
