// Organograma a partir do diretório: empresa → direção → departamentos → pessoas.
// A BD não guarda chefias; usamos o departamento e o cargo de cada colaborador.
import { canonicalLabels, compareText, fold, matchesText } from '@/lib/text';
import type { DirectoryPerson } from '@/modules/messenger/types';

export const NO_DEPARTMENT = 'Outros';

/** Direção: CEO, administradores e diretores (o topo de um departamento). */
const DIRECTOR_PATTERN =
  /\b(ceo|cfo|coo|cto|administrador|administradora|diretor|diretora|director|directora|head)\b/i;

/** Chefias intermédias: respondem à direção do departamento, quando existe. */
const MANAGER_PATTERN =
  /\b(gerente|gestor|gestora|respons[aá]vel|coordenador|coordenadora|chefe|manager|supervisor|supervisora)\b/i;

/** Departamentos que ficam no topo, entre a empresa e os restantes. */
const BOARD_PATTERN = /^(dire[cç][aã]o|administra[cç][aã]o|ger[eê]ncia|board)/i;

export interface OrgDepartment {
  name: string;
  /** Por nível (direção, chefias, restantes) e depois por nome. */
  people: DirectoryPerson[];
  /** Quem chefia o departamento (leva a coroa): a direção ou, sem diretor, a chefia (ex.: Chefe de Oficina). */
  leads: string[];
}

export interface OrgChart {
  board: OrgDepartment | null;
  departments: OrgDepartment[];
  total: number;
}

/** Nível do cargo: 2 direção, 1 chefia intermédia, 0 restantes. */
export const rankOf = (position: string | null | undefined): number =>
  !position ? 0 : DIRECTOR_PATTERN.test(position) ? 2 : MANAGER_PATTERN.test(position) ? 1 : 0;

/** Cargo de chefia (direção ou chefia intermédia). */
export const isLead = (person: Pick<DirectoryPerson, 'position'>) => rankOf(person.position) > 0;

const topLeads = (people: DirectoryPerson[]): string[] => {
  const top = Math.max(0, ...people.map(p => rankOf(p.position)));
  return top ? people.filter(p => rankOf(p.position) === top).map(p => p.userId) : [];
};

const matches = (person: DirectoryPerson, term: string) =>
  matchesText(term, person.name, person.position, person.department);

/**
 * Agrupa por departamento (direção, chefias e restantes, depois por nome). Com pesquisa,
 * ficam só as pessoas que correspondem — ou o departamento inteiro, se o nome corresponder.
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
        (a, b) => rankOf(b.position) - rankOf(a.position) || compareText(a.name, b.name)
      ),
      // Coroa para o nível mais alto do departamento: com diretor, só ele (o Gestor TVDE fica
      // por baixo, sem coroa); sem diretor, a chefia (Chefe de Oficina, Gestor de Frota).
      leads: topLeads(visible),
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
