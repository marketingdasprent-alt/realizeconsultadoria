import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import logo from "@/assets/logo-realize.png";

const AdminLoginPage = () => {
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

  useEffect(() => {
    // Check if already logged in as admin
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Check if user must set password first
        if (session.user.user_metadata?.must_set_password === true) {
          navigate("/auth/set-password?mode=admin");
          return;
        }
        
        const { data: hasAdminRole } = await supabase.rpc("has_role", {
          _user_id: session.user.id,
          _role: "admin",
        });
        if (hasAdminRole) {
          navigate("/admin");
        }
      }
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          // Check if user must set password first
          if (session.user.user_metadata?.must_set_password === true) {
            navigate("/auth/set-password?mode=admin");
            return;
          }
          
          const { data: hasAdminRole } = await supabase.rpc("has_role", {
            _user_id: session.user.id,
            _role: "admin",
          });
          if (hasAdminRole) {
            navigate("/admin");
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotPasswordLoading(true);

    try {
      const { error } = await supabase.functions.invoke("recover-password", {
        body: {
          email: forgotPasswordEmail.trim().toLowerCase(),
          redirectTo: `${window.location.origin}/auth/set-password?mode=admin`,
        }
      });

      if (error) {
        toast({
          title: "Erro",
          description: "Não foi possível enviar o email de recuperação. Verifique o endereço inserido.",
          variant: "destructive",
        });
        setForgotPasswordLoading(false);
        return;
      }

      setForgotPasswordSent(true);
      toast({
        title: "Email enviado",
        description: "Verifique a sua caixa de correio para redefinir a palavra-passe.",
      });
    } catch (error: any) {
      console.error("Forgot password error:", error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        toast({
          title: "Erro no login",
          description: error.message === "Invalid login credentials" 
            ? "Email ou password incorretos" 
            : error.message,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      if (data.user) {
        // Check if user has admin role
        const { data: hasAdminRole, error: roleError } = await supabase.rpc("has_role", {
          _user_id: data.user.id,
          _role: "admin",
        });

        if (roleError || !hasAdminRole) {
          await supabase.auth.signOut();
          toast({
            title: "Acesso negado",
            description: "Esta área é exclusiva para administradores.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        localStorage.setItem("auth_preference", "admin");
        toast({
          title: "Login efetuado",
          description: "Bem-vindo ao painel de administração.",
        });
        navigate("/admin");
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
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
            <>
              <h1 className="text-3xl font-bold mb-2">Recuperar Palavra-passe</h1>
              <p className="text-muted-foreground mb-8">
                Insira o seu email de administrador para receber um link de recuperação.
              </p>

              {forgotPasswordSent ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Eye className="h-8 w-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-semibold mb-2">Email Enviado!</h2>
                  <p className="text-muted-foreground mb-6">
                    Verifique a sua caixa de correio em <strong>{forgotPasswordEmail}</strong> para redefinir a palavra-passe.
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
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">Email Administrator</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      value={forgotPasswordEmail}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      placeholder="admin@empresa.pt"
                      required
                      disabled={forgotPasswordLoading}
                    />
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
            <>
              <h1 className="text-3xl font-bold mb-2">Área de Administração</h1>
              <p className="text-muted-foreground mb-8">
                Insira as suas credenciais para aceder ao painel.
              </p>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@empresa.pt"
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotPassword(true);
                        setForgotPasswordEmail(email);
                      }}
                      className="text-sm text-muted-foreground hover:text-gold transition-colors"
                    >
                      Esqueceu-se da password?
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
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
