import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Lock, Mail, Smartphone } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ForgotPasswordPanel } from '@/components/auth/ForgotPasswordPanel';
import { ServiceUnavailableNotice } from '@/components/ServiceUnavailableNotice';
import { useToast } from '@/hooks/use-toast';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { isAdminHost } from '@/lib/app-manifest';
import { ROUTES } from '@/lib/constants';
import { loginRedirect } from '@/lib/login-redirect';
import { BrandMark } from '@/modules/workspace/components/BrandMark';
import { useRzTheme } from '@/modules/workspace/hooks/useRzTheme';

const INPUT =
  'h-11 w-full rounded-2xl bg-rz-canvas pl-10 text-[14px] outline-none ring-1 ring-rz-line focus:ring-2 focus:ring-rz-primary disabled:opacity-60';

const loginError = (message: string) =>
  message.includes('Invalid login credentials')
    ? 'Email ou palavra-passe incorretos.'
    : message.includes('Email not confirmed')
      ? 'Email ainda não confirmado. Fale com os RH.'
      : 'Não foi possível entrar. Tente outra vez.';

/**
 * Login único (/): colaboradores e administradores entram aqui e cada conta vai para a sua área
 * (Workspace ou admin). O papel vem só do AuthContext — o mesmo que o ProtectedRoute usa.
 */
const LoginPage: React.FC = () => {
  useRzTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { isInstalled } = usePWAInstall();
  const { login, logout, role, isAuthenticated, isLoading, isServiceUnavailable } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);

  // Já com sessão (ou acabou de entrar, ou a BD voltou): segue para a área da conta.
  useEffect(() => {
    if (!isLoading && isAuthenticated && role) {
      navigate(loginRedirect(role, location.state), { replace: true });
    }
  }, [isLoading, isAuthenticated, role, navigate, location.state]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const lookup = await login(email.trim().toLowerCase(), password);
      if (lookup.unavailable) {
        toast({
          title: 'Serviço indisponível',
          description: 'A tentar de novo… entra sozinho assim que o servidor responder.',
        });
      } else if (!lookup.role) {
        await logout();
        toast({ title: 'Esta conta ainda não tem acesso', variant: 'destructive' });
      }
    } catch (error: unknown) {
      toast({
        title: loginError(error instanceof Error ? error.message : ''),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-rz-aurora px-4 py-10 font-jakarta text-rz-ink">
      <BrandMark
        subtitle={isAdminHost(window.location.hostname) ? 'Admin' : 'Workplace'}
        className="mb-8"
      />
      <main className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-rz-soft sm:p-8">
        {forgot ? (
          <ForgotPasswordPanel initialEmail={email} onBack={() => setForgot(false)} />
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <h1 className="text-[24px] font-extrabold">Entrar</h1>
              <p className="mt-1 text-[14px] text-rz-muted">Com o seu email e palavra-passe.</p>
            </div>
            {isServiceUnavailable && <ServiceUnavailableNotice className="rounded-2xl p-3" />}
            <label className="relative block">
              <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-rz-muted" />
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="o.seu@email.pt"
                className={`${INPUT} pr-3`}
                disabled={busy}
                aria-label="Email"
              />
            </label>
            <label className="relative block">
              <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-rz-muted" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="Palavra-passe"
                className={`${INPUT} pr-11`}
                disabled={busy}
                aria-label="Palavra-passe"
              />
              <button
                type="button"
                onClick={() => setShowPassword(value => !value)}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-rz-muted hover:text-rz-ink"
                aria-label={showPassword ? 'Esconder palavra-passe' : 'Mostrar palavra-passe'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </label>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setForgot(true)}
                className="text-[13px] font-semibold text-rz-primary"
              >
                Esqueceu a palavra-passe?
              </button>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-rz-primary text-[15px] font-bold text-white shadow-rz-soft hover:bg-rz-primary/90 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Entrar
            </button>
          </form>
        )}
      </main>
      {!isInstalled && (
        <Link
          to={ROUTES.PUBLIC.INSTALL}
          className="mt-6 inline-flex items-center gap-2 text-[13.5px] font-semibold text-white/70 hover:text-white"
        >
          <Smartphone className="h-4 w-4" /> Instalar a app
        </Link>
      )}
    </div>
  );
};

export default LoginPage;
