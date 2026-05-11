import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import logo from '@/assets/logo-realize.png';
import { ROUTES, ERROR_MESSAGES } from '@/lib/constants';
import { AdminLoginForm } from '../components/AdminLoginForm';
import { AdminForgotPasswordForm } from '../components/AdminForgotPasswordForm';

const AdminLoginPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { login, isLoading, isAuthenticated, role } = useAuth();
  const [email, setEmail] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);

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
    } catch (error: any) {
      toast({
        title: 'Erro no login',
        description: error.message || ERROR_MESSAGES.AUTH.UNEXPECTED,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left side - Form */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 lg:px-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-md w-full mx-auto"
        >
          <Button
            variant="ghost"
            onClick={() => (showForgotPassword ? setShowForgotPassword(false) : navigate('/'))}
            className="mb-8 -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {showForgotPassword ? 'Voltar ao login' : 'Voltar'}
          </Button>

          <div className="flex items-center gap-4 mb-8">
            <img src={logo} alt="Realize Logo" className="h-12 w-auto" />
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
        </motion.div>
      </div>

      {/* Right side - Decorative */}
      <div className="hidden lg:flex flex-1 bg-primary items-center justify-center p-16">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <h2 className="text-4xl font-bold text-primary-foreground mb-4">
            Painel de Administração
          </h2>
          <p className="text-primary-foreground/80 text-lg max-w-md">
            Gerencie empresas, colaboradores e ausências num único lugar.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default AdminLoginPage;
