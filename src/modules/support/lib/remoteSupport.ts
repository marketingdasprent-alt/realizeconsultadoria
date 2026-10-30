// Instaladores do apoio remoto (MeshCentral em suporte.realizeconsultadoria.pt), um por
// organização: o computador fica no grupo certo para a equipa de TI o encontrar.

export interface RemoteSupportOrg {
  key: string;
  name: string;
  url: string;
  /** Palavras que identificam a organização no nome da empresa da ficha. */
  match: string[];
}

export const REMOTE_SUPPORT_ORGS: RemoteSupportOrg[] = [
  {
    key: 'realize',
    name: 'Realize Consultadoria',
    url: 'https://suporte.realizeconsultadoria.pt/meshagents?id=4&meshid=jraMPY$Faji1CDAzgfmzIrCNAY0zlEGn1gGolTgeiqedrcnOCKTgEiizI$vfKRXu&installflags=0',
    match: ['realize'],
  },
  {
    key: 'premium-ride',
    name: 'Premium Ride',
    url: 'https://suporte.realizeconsultadoria.pt/meshagents?id=4&meshid=cK4KGGNQF@i08yF6i3gh5hcLfUB$T$ojs$vanZvZgFCsiryiZ3LAl99RdA8kKQxD&installflags=0',
    match: ['premium ride'],
  },
  {
    key: 'razao-dinamica',
    name: 'Razão Dinâmica',
    url: 'https://suporte.realizeconsultadoria.pt/meshagents?id=4&meshid=hgshaKFbaLhtXrm$$FUqHGAjT6klkOHSwfgEztUQ7k2358PeIxoZthglKfXmGV6f&installflags=0',
    match: ['razao dinamica'],
  },
];

const fold = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

/** As organizações com a da empresa da pessoa em primeiro (se houver uma que corresponda). */
export const remoteSupportFor = (
  companyName: string | null
): { orgs: RemoteSupportOrg[]; mine: string | null } => {
  const company = fold(companyName ?? '');
  const mine = REMOTE_SUPPORT_ORGS.find(org => org.match.some(word => company.includes(word)));
  return {
    orgs: mine
      ? [mine, ...REMOTE_SUPPORT_ORGS.filter(org => org.key !== mine.key)]
      : REMOTE_SUPPORT_ORGS,
    mine: mine?.key ?? null,
  };
};
