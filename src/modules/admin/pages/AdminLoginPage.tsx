import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Building2, ClipboardList, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { ROUTES, ERROR_MESSAGES } from '@/lib/constants';
import { BrandMark } from '@/modules/workspace/components/BrandMark';
import { useRzTheme } from '@/modules/workspace/hooks/useRzTheme';
import { AdminLoginForm } from '../components/AdminLoginForm';
import { AdminForgotPasswordForm } from '../components/AdminForgotPasswordForm';

const HIGHLIGHTS = [
  { icon: Users, text: 'Colaboradores, documentos e equipamentos' },
  { icon: ClipboardList, text: 'Pedidos de férias, ausências e ponto' },
  { icon: Building2, text: 'Empresas, acessos e jurídico' },
];

const AdminLoginPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { login, isLoading, isAuthenticated, role } = useAuth();
  const [email, setEmail] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  useRzTheme();

  // Se já está logado como admin, redirecionar
  useEffect(() => {
    if (isAuthenticated && role === 'admin') {
      navigate(ROUTES.ADMIN.DASHBOARD);
    }
  }, [isAuthenticated, role, navigate]);

  const handleLoginSubmit = async (e: React.FormEvent, password: string) => {
    e.preventDefault();

    if (!email || !password) {
      toast({
        title: 'Erro',
        description: 'Email e password são obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await login(email, password);
      toast({
        title: 'Login efetuado',
        description: 'Bem-vindo ao painel de administração.',
      });
      navigate(ROUTES.ADMIN.DASHBOARD);
    } catch (error: unknown) {
      toast({
        title: 'Erro no login',
        description: error instanceof Error ? error.message : ERROR_MESSAGES.AUTH.UNEXPECTED,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex min-h-screen bg-rz-aurora font-jakarta text-rz-ink">
      {/* Lado esquerdo: marca e o que se gere aqui, sobre a aurora */}
      <div className="hidden flex-1 flex-col justify-between p-12 lg:flex">
        <BrandMark subtitle="Admin" />
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-md"
        >
          <h2 className="text-[40px] font-extrabold leading-tight text-white">
            Painel de Administração
          </h2>
          <p className="mt-3 text-[16px] text-white/65">
            Tudo o que os RH precisam, num único lugar.
          </p>
          <ul className="mt-8 space-y-3">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-[14.5px] text-white/80">
                <span className="rz-glass flex h-9 w-9 items-center justify-center rounded-xl">
                  <Icon className="h-[18px] w-[18px] text-[#F3D9A4]" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </motion.div>
        <p className="text-[12px] text-white/35">Realize Consultadoria</p>
      </div>

      {/* Lado direito: o formulário num painel claro e arredondado */}
      <div className="flex flex-1 items-center justify-center p-4 sm:p-8 lg:p-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex w-full max-w-md flex-col rounded-[28px] bg-white p-7 shadow-rz-panel sm:p-10 lg:h-full lg:max-w-none lg:items-center lg:justify-center"
        >
          <div className="w-full max-w-sm">
            <div className="mb-8 flex items-center justify-between">
              <button
                type="button"
                onClick={() => (showForgotPassword ? setShowForgotPassword(false) : navigate('/'))}
                className="-ml-2 inline-flex items-center gap-2 rounded-xl px-2 py-1.5 text-[13.5px] font-medium text-rz-muted transition-colors hover:bg-rz-canvas hover:text-rz-ink"
              >
                <ArrowLeft className="h-4 w-4" />
                {showForgotPassword ? 'Voltar ao login' : 'Voltar'}
              </button>
              <span className="lg:hidden">
                <span className="inline-flex rounded-2xl bg-rz-ink px-3 py-2">
                  <BrandMark withName={false} />
                </span>
              </span>
            </div>

            {showForgotPassword ? (
              <AdminForgotPasswordForm initialEmail={email} />
            ) : (
              <AdminLoginForm
                email={email}
                setEmail={setEmail}
                isLoading={isLoading}
                onSubmit={handleLoginSubmit}
                onForgotPasswordClick={() => setShowForgotPassword(true)}
              />
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AdminLoginPage;
