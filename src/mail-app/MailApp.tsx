import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { Loader2, LogOut, Mail } from 'lucide-react';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { mailAppExchange } from '@/modules/webmail/services/mailAppLogin';
import {
  WorkspaceContext,
  type WorkspaceContextValue,
} from '@/modules/workspace/context/workspaceContext';
import { useRzTheme } from '@/modules/workspace/hooks/useRzTheme';
import { MailLoginPage } from './MailLoginPage';

const WebmailPage = lazy(() => import('@/modules/webmail/pages/WebmailPage'));

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 } },
});

const Spinner = () => (
  <div className="flex h-[100dvh] items-center justify-center bg-rz-canvas">
    <Loader2 className="h-7 w-7 animate-spin text-rz-primary" />
  </div>
);

/** Só contas da app de email (as da Realize entram em app.realizeconsultadoria.pt). */
const isMailOnly = (session: Session | null) => session?.user.app_metadata?.mail_only === true;

const EMPTY_USER: WorkspaceContextValue['user'] = {
  userId: '',
  employeeId: '',
  companyId: '',
  name: '',
  email: '',
  position: null,
  department: null,
  companyName: null,
  phone: null,
  hireDate: null,
};

/** Antes de entrar: a página de entrada precisa do contexto (descobre servidores sem sessão). */
const LOGIN_CONTEXT: WorkspaceContextValue = {
  user: EMPTY_USER,
  basePath: '',
  isPreview: false,
  mailOnly: true,
  onLogout: () => undefined,
  onChangePassword: () => undefined,
};

/** O email: barra de cima (nome da app, caixa, Sair) e o Webmail inteiro por baixo. */
const MailShell: React.FC<{ session: Session }> = ({ session }) => {
  const mailbox = String(session.user.app_metadata?.mailbox ?? '');
  const value: WorkspaceContextValue = useMemo(
    () => ({
      user: {
        ...EMPTY_USER,
        userId: session.user.id,
        name: String(session.user.user_metadata?.name ?? mailbox),
        email: mailbox,
      },
      basePath: '',
      isPreview: false,
      mailOnly: true,
      onLogout: () => void supabase.auth.signOut(),
      onChangePassword: () => undefined,
    }),
    [session.user, mailbox]
  );
  return (
    <WorkspaceContext.Provider value={value}>
      <div className="flex h-[100dvh] flex-col bg-rz-canvas">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-rz-line bg-white px-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rz-primary text-white">
            <Mail className="h-5 w-5" />
          </span>
          <span className="text-[16px] font-extrabold">Realize Mail</span>
          <span className="ml-auto hidden truncate text-[13px] text-rz-muted sm:block">
            {mailbox}
          </span>
          <button
            type="button"
            onClick={value.onLogout}
            className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-rz-muted hover:bg-rz-canvas hover:text-rz-ink sm:ml-0"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </header>
        <main className="min-h-0 flex-1">
          <Suspense fallback={<Spinner />}>
            <WebmailPage />
          </Suspense>
        </main>
      </div>
    </WorkspaceContext.Provider>
  );
};

const MailAppContent: React.FC = () => {
  // Cores, letra e tokens da Realize (classe rz-theme no <html>, também nos diálogos)
  useRzTheme();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    // Regresso da Microsoft: ?login=<código> troca-se pela sessão (e sai do endereço)
    const params = new URLSearchParams(window.location.search);
    const code = params.get('login');
    const motivo = params.get('motivo');
    if (code || motivo) window.history.replaceState(null, '', '/');
    if (motivo)
      toast({
        title: 'A Microsoft não deixou entrar',
        description: motivo === 'cancelado' ? 'Cancelou a entrada.' : 'Tente outra vez.',
        variant: 'destructive',
      });
    void (async () => {
      if (code) {
        const error = await mailAppExchange(code);
        if (error)
          toast({ title: 'Não foi possível entrar', description: error, variant: 'destructive' });
      }
      const { data } = await supabase.auth.getSession();
      // Uma sessão da Realize neste browser não serve aqui
      if (data.session && !isMailOnly(data.session)) await supabase.auth.signOut();
      setSession(isMailOnly(data.session) ? data.session : null);
    })();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) =>
      setSession(isMailOnly(next) ? next : null)
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <Spinner />;
  if (!session)
    return (
      <WorkspaceContext.Provider value={LOGIN_CONTEXT}>
        <MailLoginPage />
      </WorkspaceContext.Provider>
    );
  return <MailShell key={session.user.id} session={session} />;
};

export const MailApp: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="rz.theme"
      disableTransitionOnChange
    >
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <MailAppContent />
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);
