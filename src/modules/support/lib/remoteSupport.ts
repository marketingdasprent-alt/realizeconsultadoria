// Instaladores do apoio remoto (MeshCentral em suporte.realizeconsultadoria.pt), um por
// organização: o computador fica no grupo certo para a equipa de TI o encontrar.

export interface RemoteSupportOrg {
  key: string;
  name: string;
  url: string;
}

export const REMOTE_SUPPORT_ORGS: RemoteSupportOrg[] = [
  {
    key: 'realize',
    name: 'Realize Consultadoria',
    url: 'https://suporte.realizeconsultadoria.pt/meshagents?id=4&meshid=jraMPY$Faji1CDAzgfmzIrCNAY0zlEGn1gGolTgeiqedrcnOCKTgEiizI$vfKRXu&installflags=0',
  },
  {
    key: 'premium-ride',
    name: 'Premium Ride',
    url: 'https://suporte.realizeconsultadoria.pt/meshagents?id=4&meshid=cK4KGGNQF@i08yF6i3gh5hcLfUB$T$ojs$vanZvZgFCsiryiZ3LAl99RdA8kKQxD&installflags=0',
  },
  {
    key: 'razao-dinamica',
    name: 'Razão Dinâmica',
    url: 'https://suporte.realizeconsultadoria.pt/meshagents?id=4&meshid=hgshaKFbaLhtXrm$$FUqHGAjT6klkOHSwfgEztUQ7k2358PeIxoZthglKfXmGV6f&installflags=0',
  },
];
