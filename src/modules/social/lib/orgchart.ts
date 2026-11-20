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

// ─── Árvore pela chefia real (responsável direto) ────────────────────────────────────────────

export interface OrgNode {
  person: DirectoryPerson;
  children: OrgNode[];
  /** Pessoas abaixo (diretas e indiretas). */
  teamSize: number;
}

export interface OrgTree {
  /** Topo: quem chefia alguém e não tem responsável direto (no diretório). */
  roots: OrgNode[];
  /** Sem responsável direto e sem ninguém abaixo. */
  unassigned: DirectoryPerson[];
  total: number;
}

/** Há chefia preenchida: pelo menos uma pessoa tem o responsável no diretório. */
export const hasManagerChain = (people: DirectoryPerson[]): boolean => {
  const ids = new Set(people.map(p => p.employeeId));
  return people.some(p => !!p.managerEmployeeId && ids.has(p.managerEmployeeId));
};

/**
 * Árvore do organograma pelo responsável direto. Com pesquisa ficam as pessoas que correspondem
 * e quem está acima delas (para se perceber onde estão). Resiste a ciclos.
 */
export const buildOrgTree = (people: DirectoryPerson[], search = ''): OrgTree => {
  const term = search.trim();
  const byId = new Map(people.map(p => [p.employeeId, p]));
  const managerOf = (p: DirectoryPerson) =>
    p.managerEmployeeId && p.managerEmployeeId !== p.employeeId && byId.has(p.managerEmployeeId)
      ? p.managerEmployeeId
      : null;

  // Com pesquisa: quem corresponde e a sua cadeia acima.
  let keep: Set<string> | null = null;
  if (term) {
    keep = new Set();
    for (const person of people) {
      if (!matches(person, term)) continue;
      let id: string | null = person.employeeId;
      while (id && !keep.has(id)) {
        keep.add(id);
        id = managerOf(byId.get(id)!);
      }
    }
  }
  const visible = keep ? people.filter(p => keep!.has(p.employeeId)) : people;

  const childrenOf = new Map<string, DirectoryPerson[]>();
  for (const person of visible) {
    const manager = managerOf(person);
    if (manager) childrenOf.set(manager, [...(childrenOf.get(manager) ?? []), person]);
  }

  const seen = new Set<string>();
  const build = (person: DirectoryPerson): OrgNode => {
    seen.add(person.employeeId);
    const children = (childrenOf.get(person.employeeId) ?? [])
      .filter(child => !seen.has(child.employeeId))
      .sort((a, b) => compareText(a.name, b.name))
      .map(build);
    return {
      person,
      children,
      teamSize: children.reduce((n, child) => n + 1 + child.teamSize, 0),
    };
  };

  const tops = visible.filter(p => !managerOf(p)).sort((a, b) => compareText(a.name, b.name));
  const roots = tops.filter(p => childrenOf.has(p.employeeId)).map(build);
  const unassigned = tops.filter(p => !childrenOf.has(p.employeeId));
  // Ciclos (A chefia B e B chefia A) ficam fora das raízes: entram como raiz para não sumirem.
  for (const person of visible)
    if (!seen.has(person.employeeId) && !unassigned.includes(person)) roots.push(build(person));
  // Mais grandes primeiro: o topo da empresa abre o organograma.
  roots.sort((a, b) => b.teamSize - a.teamSize || compareText(a.person.name, b.person.name));

  return { roots, unassigned, total: visible.length };
};
