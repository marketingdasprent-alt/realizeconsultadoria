import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Mail, Lock, Eye, EyeOff, Smartphone } from "lucide-react";
import { motion } from "framer-motion";
import logo from "@/assets/logo-realize.png";
import { useDeviceDetect } from "@/hooks/useDeviceDetect";
import { usePWAInstall } from "@/hooks/usePWAInstall";

const EmployeeLoginPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);
  const device = useDeviceDetect();
  const { isInstalled } = usePWAInstall();

  // Check session and redirect
  const checkSessionAndRedirect = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: employee } = await supabase
        .from("employees")
        .select("id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (employee) {
        localStorage.setItem("auth_preference", "employee");
        navigate("/colaborador");
        return true;
      }
    }
    return false;
  };

  useEffect(() => {
    // Check on initial load
    checkSessionAndRedirect();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          setTimeout(() => checkSessionAndRedirect(), 0);
        }
      }
    );

    // iOS PWA: Check session when app becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkSessionAndRedirect();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password,
      });

      if (error) {
        console.error("Auth error details:", error);
        let errorMessage = "Email ou senha incorretos.";
        
        if (error.message.includes("Invalid login credentials")) {
          errorMessage = "Email ou senha incorretos.";
        } else if (error.message.includes("Email not confirmed")) {
          errorMessage = "Email não confirmado. Por favor, contacte o suporte.";
        } else if (error.status === 400 || error.status === 422) {
          // Show more detailed error for debugging if it's not a generic failure
          errorMessage = `Erro: ${error.message}`;
        }
        
        toast({
          title: "Erro de autenticação",
          description: errorMessage,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Verify the user is an employee
      const { data: employee } = await supabase
        .from("employees")
        .select("id")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (!employee) {
        await supabase.auth.signOut();
        toast({
          title: "Acesso negado",
          description: "Esta conta não está associada a um colaborador.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      localStorage.setItem("auth_preference", "employee");
      toast({
        title: "Bem-vindo!",
        description: "Login efetuado com sucesso.",
      });
      
      navigate("/colaborador");
    } catch (error: any) {
      console.error("Login error:", error);
      toast({
        title: "Erro",
        description: "Não foi possível efetuar o login. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotPasswordLoading(true);

    try {
      const { error } = await supabase.functions.invoke("recover-password", {
        body: {
          email: forgotPasswordEmail.trim().toLowerCase(),
          redirectTo: `${window.location.origin}/auth/set-password?mode=employee`,
        }
      });

      if (error) {
        toast({
          title: "Erro",
          description: "Não foi possível enviar o email. Verifique o endereço.",
          variant: "destructive",
        });
        setForgotPasswordLoading(false);
        return;
      }

      setForgotPasswordSent(true);
      toast({
        title: "Email enviado",
        description: "Verifique a sua caixa de correio para redefinir a senha.",
      });
    } catch (error: any) {
      console.error("Forgot password error:", error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar o email. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setForgotPasswordLoading(false);
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
            onClick={() => showForgotPassword ? setShowForgotPassword(false) : navigate("/")}
            className="mb-8 -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {showForgotPassword ? "Voltar ao login" : "Voltar"}
          </Button>

          <div className="flex items-center gap-4 mb-8">
            <img src={logo} alt="Realize Logo" className="h-12 w-auto" />
          </div>

          {showForgotPassword ? (
            // Forgot Password Form
            <>
              <h1 className="text-3xl font-bold mb-2">Recuperar Senha</h1>
              <p className="text-muted-foreground mb-8">
                Insira o seu email para receber um link de recuperação.
              </p>

              {forgotPasswordSent ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-8"
                >
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Mail className="h-8 w-8 text-green-600" />
                  </div>
                  <h2 className="text-xl font-semibold mb-2">Email Enviado!</h2>
                  <p className="text-muted-foreground mb-6">
                    Verifique a sua caixa de correio em <strong>{forgotPasswordEmail}</strong> para redefinir a senha.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setForgotPasswordSent(false);
                      setForgotPasswordEmail("");
                    }}
                  >
                    Voltar ao login
                  </Button>
                </motion.div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="forgot-email"
                        type="email"
                        value={forgotPasswordEmail}
                        onChange={(e) => setForgotPasswordEmail(e.target.value)}
                        placeholder="colaborador@empresa.pt"
                        className="pl-10"
                        required
                        disabled={forgotPasswordLoading}
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full" variant="gold" disabled={forgotPasswordLoading}>
                    {forgotPasswordLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        A enviar...
                      </>
                    ) : (
                      "Enviar Link de Recuperação"
                    )}
                  </Button>
                </form>
              )}
            </>
          ) : (
            // Login Form
            <>
              <h1 className="text-3xl font-bold mb-2">Portal do Colaborador</h1>
              <p className="text-muted-foreground mb-8">
                Insira as suas credenciais para aceder ao portal.
              </p>

              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="colaborador@empresa.pt"
                      className="pl-10"
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pl-10 pr-10"
                      required
                      disabled={isLoading}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isLoading}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="link"
                    className="px-0 text-sm text-muted-foreground hover:text-gold"
                    onClick={() => {
                      setShowForgotPassword(true);
                      setForgotPasswordEmail(email);
                    }}
                  >
                    Esqueceu a senha?
                  </Button>
                </div>

                <Button type="submit" className="w-full" variant="gold" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      A entrar...
                    </>
                  ) : (
                    "Entrar"
                  )}
                </Button>

                {/* PWA Install Link - visible on mobile when not installed */}
                {device.isMobile && !isInstalled && (
                  <div className="text-center pt-4 border-t border-border mt-6">
                    <Link 
                      to="/instalar" 
                      className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-gold transition-colors"
                    >
                      <Smartphone className="h-4 w-4" />
                      Instalar App no telemóvel
                    </Link>
                  </div>
                )}
              </form>
            </>
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
            Portal Seguro
          </h2>
          <p className="text-primary-foreground/80 text-lg max-w-md">
            Aceda ao seu portal de colaborador com as credenciais fornecidas pela sua empresa.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default EmployeeLoginPage;
