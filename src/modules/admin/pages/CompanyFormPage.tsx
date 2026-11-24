import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { ROUTES } from '@/lib/constants';
import type { CreateCompanyWithAdminInput } from '@/lib/schemas';
import { companyService, type Company } from '@/modules/admin/services/companyService';
import { COMPANIES_ACTIVE_KEY } from '../context/CompanyScopeContext';
import { CompanyForm } from '../components/CompanyForm';
import { CompanyAdminsSection } from '../components/CompanyAdminsSection';
import { CompanyEmployeesSection } from '../components/CompanyEmployeesSection';
import { CompanySharing } from '../components/company/CompanySharing';
import { useMyCompanies } from '../hooks/useSharing';
import { parseCompanyTab, type CompanyTab } from '../lib/companyTabs';
import { managesCompany } from '../lib/sharing';

const BackButton = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-rz-muted hover:bg-white hover:text-rz-ink"
    aria-label="Voltar às empresas"
  >
    <ArrowLeft className="h-5 w-5" />
  </button>
);

const SAVE_FAILED = 'Não foi possível guardar a empresa.';

/**
 * Texto do erro ao guardar. O PostgREST responde com "JSON object requested, multiple (or no)
 * rows returned" quando a base não deixa alterar nenhuma linha: isso (ou nada) vira uma mensagem
 * em português; as outras mensagens úteis (ex.: NIF repetido) mantêm-se. Os erros do Supabase são
 * objetos simples, não `Error`.
 */
const saveErrorMessage = (error: unknown): string => {
  const { message, code } = (error ?? {}) as { message?: unknown; code?: unknown };
  const text = typeof message === 'string' ? message.trim() : '';
  if (!text || code === 'PGRST116' || /JSON object requested|multiple \(or no\) rows/i.test(text)) {
    return SAVE_FAILED;
  }
  return text;
};

/** `.single()` sem linhas: a empresa não existe (ou a base não a deixa ver). */
const isNotFound = (error: unknown): boolean =>
  (error as { code?: unknown } | null)?.code === 'PGRST116';

/** O que se leu da base para um id: a empresa, ou o motivo de não a haver. */
type Loaded =
  | { id: string; status: 'ok'; company: Company }
  | { id: string; status: 'not-found' }
  | { id: string; status: 'failed' };

const Page = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const navigate = useNavigate();
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <BackButton onClick={() => navigate(ROUTES.ADMIN.COMPANIES)} />
        <h1 className="text-[26px] font-extrabold leading-tight tracking-tight">{title}</h1>
      </div>
      <Card className="shadow-card">
        <CardContent className="py-8 text-center text-muted-foreground">{children}</CardContent>
      </Card>
    </div>
  );
};

/**
 * Página completa de uma empresa (em vez de um pop-up): dados da empresa e, em edição, os seus
 * administradores. Sem id é a criação; depois de criar abre a página de edição da empresa nova.
 */
const CompanyFormPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const {
    canExecuteTopic,
    canView,
    isSuperAdmin,
    isLoading: permissionsLoading,
  } = useAdminPermissions();
  const canManage = canExecuteTopic('companies', 'manage');

  const isEditMode = !!id;
  const [params, setParams] = useSearchParams();
  const myCompanies = useMyCompanies();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0);
  // "Tentar de novo" na Partilha: o React Query apaga o erro e volta a "a carregar" (sem dados),
  // o que desmontava o aviso e o botão; assim ficam até o pedido acabar.
  const [retryingSharing, setRetryingSharing] = useState(false);
  // Quem está a guardar: "nova" ou o id da empresa (o formulário de outra empresa não fica preso)
  const [savingFor, setSavingFor] = useState<string | null>(null);
  // O estado "a guardar" só chega depois da validação do formulário: este impede o duplo envio
  const savingRef = useRef<string | null>(null);
  // Para a criação só navegar se o utilizador ainda estiver na página "nova"
  const idRef = useRef(id);
  idRef.current = id;
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // O que se leu só vale para o id a que pertence: ao mudar de :id (ou ao passar de "nova" para
  // a empresa acabada de criar) nada da empresa anterior aparece, nem "não encontrada".
  const result = isEditMode && loaded?.id === id ? loaded : null;
  const company = result?.status === 'ok' ? result.company : null;

  // A Partilha só aparece a quem hoje a veria (permissão "sharing") e administra esta empresa.
  const canSeeSharing =
    !!company &&
    canView('sharing') &&
    (myCompanies.data ?? []).some(
      item => item.company_id === company.id && managesCompany(item.role)
    );
  const requestedTab = parseCompanyTab(params.get('tab'));
  // A ler as empresas da conta (1.ª vez, ou a confirmar uma lista que ainda não inclui esta
  // empresa, p.ex. acesso acabado de dar): não decide nem mostra "sem acesso" de relance.
  // Com erro mantém o aviso montado (o botão "Tentar de novo" não desaparece ao clicar).
  const sharingPending =
    requestedTab === 'partilha' &&
    !myCompanies.error &&
    !retryingSharing &&
    (myCompanies.isLoading || (myCompanies.isFetching && !canSeeSharing));
  // Sem direito à Partilha, o endereço com ?tab=partilha abre em Dados (nada de página vazia).
  const sharingBlocked = requestedTab === 'partilha' && !sharingPending && !canSeeSharing;
  const tab: CompanyTab = sharingBlocked ? 'dados' : requestedTab;
  const changeTab = (next: string) =>
    setParams(
      previous => {
        const query = new URLSearchParams(previous);
        if (next === 'dados') query.delete('tab');
        else query.set('tab', next);
        if (next !== 'partilha') query.delete('sub');
        return query;
      },
      { replace: true }
    );

  const goToList = useCallback(() => navigate(ROUTES.ADMIN.COMPANIES), [navigate]);

  useEffect(() => {
    if (!id || permissionsLoading || !canManage) return;
    let cancelled = false;
    const settle = (next: Loaded) => {
      if (!cancelled) setLoaded(next);
    };
    (async () => {
      try {
        const { data, error } = await companyService.getById(id);
        if (data && !error) settle({ id, status: 'ok', company: data });
        else settle(isNotFound(error) ? { id, status: 'not-found' } : { id, status: 'failed' });
      } catch {
        settle({ id, status: 'failed' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, permissionsLoading, canManage, attempt]);

  const retry = () => {
    setLoaded(null);
    setAttempt(value => value + 1);
  };

  const handleSubmit = async (data: CreateCompanyWithAdminInput) => {
    const key = company?.id ?? 'nova';
    if (savingRef.current === key) return;
    savingRef.current = key;
    setSavingFor(key);
    try {
      if (company) {
        const { data: updated, error } = await companyService.update(company.id, data);
        if (error) throw error;
        // Só atualiza se o utilizador ainda estiver nesta empresa (não apaga a que abriu entretanto)
        if (updated) {
          setLoaded(prev =>
            prev?.id === company.id ? { id: company.id, status: 'ok', company: updated } : prev
          );
        }
        // A lista de empresas do seletor do admin passa a ter o nome novo
        void queryClient.invalidateQueries({ queryKey: COMPANIES_ACTIVE_KEY });
        toast({ title: 'Empresa atualizada com sucesso!' });
      } else {
        const { data: created, error, warning } = await companyService.createWithAdmin(data);
        if (error) throw error;
        void queryClient.invalidateQueries({ queryKey: COMPANIES_ACTIVE_KEY });
        toast({
          title: 'Empresa criada com sucesso!',
          ...(warning ? { description: warning } : {}),
        });
        // Só segue para a empresa nova se o utilizador ainda estiver em "nova" (não o arrasta de volta)
        if (mountedRef.current && !idRef.current) {
          if (created?.id) navigate(ROUTES.ADMIN.COMPANY_EDIT.replace(':id', created.id));
          else goToList();
        }
      }
    } catch (error: unknown) {
      toast({
        title: 'Erro',
        description: saveErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      if (savingRef.current === key) savingRef.current = null;
      setSavingFor(current => (current === key ? null : current));
    }
  };

  const waiting = permissionsLoading || (isEditMode && canManage && !result);
  if (waiting) {
    return (
      <div role="status" className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-rz-primary" aria-hidden="true" />
        <span className="sr-only">A carregar…</span>
      </div>
    );
  }

  if (!canManage) {
    return <Page title="Empresa">Não tem permissão para gerir empresas.</Page>;
  }

  if (!isEditMode && !isSuperAdmin) {
    return <Page title="Nova empresa">Só um super administrador cria empresas.</Page>;
  }

  if (result?.status === 'not-found') {
    return <Page title="Empresa não encontrada">Esta empresa não existe ou já foi eliminada.</Page>;
  }

  if (result?.status === 'failed') {
    return (
      <Page title="Empresa">
        <p>Não foi possível carregar a empresa.</p>
        <Button type="button" variant="outline" className="mt-4" onClick={retry}>
          Tentar de novo
        </Button>
      </Page>
    );
  }

  const dataCard = (
    <Card className="max-w-4xl shadow-card">
      <CardHeader>
        <h2 className="text-lg font-semibold leading-none tracking-tight">Dados da empresa</h2>
      </CardHeader>
      <CardContent className="pt-0">
        {/* A chave faz o formulário nascer de novo por empresa (e vazio em "nova") */}
        <CompanyForm
          key={company?.id ?? 'nova'}
          initialData={company}
          onSubmit={handleSubmit}
          onCancel={goToList}
          isLoading={savingFor === (company?.id ?? 'nova')}
        />
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <BackButton onClick={goToList} />
        <div className="min-w-0">
          <h1 className="truncate text-[26px] font-extrabold leading-tight tracking-tight">
            {company ? company.name : 'Nova empresa'}
          </h1>
          <p className="text-[14px] text-rz-muted">
            {company
              ? 'Dados da empresa e quem a administra.'
              : 'A empresa nasce com o seu primeiro administrador.'}
          </p>
        </div>
      </div>

      {company ? (
        <Tabs value={tab} onValueChange={changeTab} className="max-w-4xl">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="administradores">Administradores</TabsTrigger>
            <TabsTrigger value="colaboradores">Colaboradores</TabsTrigger>
            {canSeeSharing && <TabsTrigger value="partilha">Partilha</TabsTrigger>}
          </TabsList>
          {sharingBlocked && (
            <div
              role="alert"
              className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              {canView('sharing') && myCompanies.data === undefined ? (
                <>
                  <span>Não foi possível carregar a Partilha desta empresa.</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={myCompanies.isFetching || retryingSharing}
                    onClick={() => {
                      setRetryingSharing(true);
                      void Promise.resolve(myCompanies.refetch()).finally(() =>
                        setRetryingSharing(false)
                      );
                    }}
                  >
                    {myCompanies.isFetching || retryingSharing ? 'A tentar…' : 'Tentar de novo'}
                  </Button>
                </>
              ) : (
                <span>Não tem acesso à Partilha desta empresa.</span>
              )}
            </div>
          )}
          {/* Dados fica montado: mudar de separador não apaga o que ainda não foi guardado */}
          <TabsContent value="dados" forceMount className="mt-4 data-[state=inactive]:hidden">
            {dataCard}
          </TabsContent>
          <TabsContent value="administradores" className="mt-4">
            <Card className="shadow-card">
              {/* A secção traz o seu próprio título "Administradores" */}
              <CardContent className="pt-6">
                <CompanyAdminsSection company={{ id: company.id, name: company.name }} />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="colaboradores" className="mt-4">
            <Card className="shadow-card">
              {/* A secção traz o seu próprio título "Colaboradores" */}
              <CardContent className="pt-6">
                <CompanyEmployeesSection
                  company={{ id: company.id, name: company.name, isActive: company.is_active }}
                />
              </CardContent>
            </Card>
          </TabsContent>
          {canSeeSharing && (
            <TabsContent value="partilha" className="mt-4">
              <Card className="shadow-card">
                <CardContent className="pt-6">
                  <CompanySharing company={{ id: company.id, name: company.name }} />
                </CardContent>
              </Card>
            </TabsContent>
          )}
          {sharingPending && (
            <div role="status" className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-rz-primary" aria-hidden="true" />
              <span className="sr-only">A carregar…</span>
            </div>
          )}
        </Tabs>
      ) : (
        dataCard
      )}
    </div>
  );
};

export default CompanyFormPage;
