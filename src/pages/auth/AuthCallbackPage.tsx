import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoRealize from "@/assets/logo-realize.png";

const AuthCallbackPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("A processar autenticação...");
  const [showPWAMessage, setShowPWAMessage] = useState(false);
  const [transferToken, setTransferToken] = useState<string | null>(null);
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);
  const hasHandledAuth = useRef(false);
  const isRedirecting = useRef(false);

  // Detectar se está em mobile e não está na PWA
  const isMobileNotPWA = () => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || (navigator as any).standalone === true;
    return isMobile && !isStandalone;
  };

  // Função para associar o user_id ao employee pelo email
  const linkEmployeeToUser = async (userId: string, email: string) => {
    console.log("[AuthCallback] Linking employee to user:", { userId, email });
    
    const { error } = await supabase
      .from("employees")
      .update({ user_id: userId })
      .eq("email", email.toLowerCase())
      .is("user_id", null);
    
    if (error) {
      console.error("[AuthCallback] Error linking employee:", error);
    } else {
      console.log("[AuthCallback] Employee linked successfully");
    }
  };

  useEffect(() => {
    // Check for error in URL
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    if (error) {
      console.error("[AuthCallback] URL error:", error, errorDescription);
      setStatus("Link expirado ou inválido. A redirecionar...");
      
      // Redirect to correct login based on mode/source
      const mode = searchParams.get("mode");
      const source = searchParams.get("source");
      const redirectTo = (mode === "admin" || source === "invite") 
        ? "/admin/login" 
        : "/colaborador/login";
      
      setTimeout(() => {
        if (!isRedirecting.current) {
          isRedirecting.current = true;
          navigate(redirectTo);
        }
      }, 2000);
      return;
    }
  }, [searchParams, navigate]);

  useEffect(() => {
    // Safety timeout - if no session after 15 seconds, redirect
    const timeout = setTimeout(async () => {
      if (hasHandledAuth.current || isRedirecting.current) return;
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log("[AuthCallback] Timeout - no session");
        setStatus("Tempo limite excedido. A redirecionar...");
        isRedirecting.current = true;
        setTimeout(() => navigate("/colaborador/login"), 1500);
      }
    }, 15000);

    return () => clearTimeout(timeout);
  }, [navigate]);

  useEffect(() => {
    const redirectBasedOnRole = async (userId: string, mode: string | null) => {
      if (isRedirecting.current) return;
      
      console.log("[AuthCallback] Redirecting based on role, mode:", mode);
      
      // Se for colaborador em mobile (não PWA), gerar token e mostrar mensagem
      if (mode === "employee" && isMobileNotPWA()) {
        setShowPWAMessage(true);
        // Generate transfer token
        setIsGeneratingToken(true);
        try {
          const { data, error } = await supabase.functions.invoke("create-session-transfer");
          if (!error && data?.token) {
            setTransferToken(data.token);
            console.log("[AuthCallback] Transfer token generated");
          } else {
            console.error("[AuthCallback] Failed to generate transfer token:", error);
          }
        } catch (err) {
          console.error("[AuthCallback] Error generating transfer token:", err);
        } finally {
          setIsGeneratingToken(false);
        }
        return;
      }
      
      isRedirecting.current = true;
      
      try {
        // If mode is employee, redirect to employee dashboard
        if (mode === "employee") {
          window.location.href = "/colaborador";
          return;
        }

        // Check if user is an employee
        const { data: employee } = await supabase
          .from("employees")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();

        if (employee) {
          window.location.href = "/colaborador";
          return;
        }

        // Check if user is admin
        const { data: adminRole } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "admin")
          .maybeSingle();

        if (adminRole) {
          window.location.href = "/admin";
          return;
        }

        // Fallback to home
        window.location.href = "/";
      } catch (error) {
        console.error("[AuthCallback] Error checking role:", error);
        window.location.href = "/";
      }
    };

    const handleAuthCallback = async () => {
      if (hasHandledAuth.current) return;

      console.log("[AuthCallback] Starting auth callback handling...");

      // Check for existing session first
      const { data: { session: existingSession } } = await supabase.auth.getSession();
      
      if (existingSession?.user) {
        console.log("[AuthCallback] Found existing session");
        hasHandledAuth.current = true;
        
        const mode = searchParams.get("mode");
        const source = searchParams.get("source");
        const mustSetPassword = existingSession.user.user_metadata?.must_set_password;
        
        // Só admin precisa definir senha (mode=admin ou source=invite)
        if (mustSetPassword && (mode === "admin" || source === "invite")) {
          console.log("[AuthCallback] Admin needs to set password");
          setStatus("A redirecionar para definir palavra-passe...");
          isRedirecting.current = true;
          window.location.href = "/auth/set-password?mode=admin";
          return;
        }
        
        // Se for colaborador, garantir que user_id está associado
        if (mode === "employee" && existingSession.user.email) {
          await linkEmployeeToUser(existingSession.user.id, existingSession.user.email);
        }
        
        // Colaborador ou admin sem necessidade de senha: vai direto para dashboard
        setStatus("A redirecionar...");
        await redirectBasedOnRole(existingSession.user.id, mode);
        return;
      }

      // Set up auth state listener
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log("[AuthCallback] Auth event:", event, "hasHandled:", hasHandledAuth.current);
          
          if (hasHandledAuth.current || isRedirecting.current) {
            console.log("[AuthCallback] Already handled, ignoring event");
            return;
          }

          // Handle PASSWORD_RECOVERY event (from recovery links - only for admin invites)
          if (event === "PASSWORD_RECOVERY" && session?.user) {
            hasHandledAuth.current = true;
            console.log("[AuthCallback] PASSWORD_RECOVERY event");
            
            const mode = searchParams.get("mode");
            const source = searchParams.get("source");
            const mustSetPassword = session.user.user_metadata?.must_set_password;
            
            // Só admin precisa definir senha
            if (mustSetPassword && (mode === "admin" || source === "invite")) {
              setStatus("A redirecionar para definir palavra-passe...");
              isRedirecting.current = true;
              window.location.href = "/auth/set-password?mode=admin";
              return;
            }
            
            // Colaborador ou admin sem necessidade de senha: vai direto para dashboard
            setStatus("A redirecionar...");
            await redirectBasedOnRole(session.user.id, mode);
            return;
          }

          // Handle SIGNED_IN event
          if (event === "SIGNED_IN" && session?.user) {
            hasHandledAuth.current = true;
            console.log("[AuthCallback] SIGNED_IN event");
            
            const mode = searchParams.get("mode");
            
            // Se for colaborador, associar o user_id ao employee pelo email
            if (mode === "employee" && session.user.email) {
              await linkEmployeeToUser(session.user.id, session.user.email);
            }
            
            setStatus("A redirecionar...");
            await redirectBasedOnRole(session.user.id, mode);
          }
        }
      );

      return () => {
        subscription.unsubscribe();
      };
    };

    handleAuthCallback();
  }, [navigate, searchParams]);

  // Build PWA URL with token
  const getPWAUrl = () => {
    const baseUrl = window.location.origin;
    if (transferToken) {
      return `${baseUrl}/auth/pwa?token=${transferToken}`;
    }
    return `${baseUrl}/colaborador`;
  };

  // Mostrar mensagem para abrir a PWA
  if (showPWAMessage) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-muted p-6">
        <img src={logoRealize} alt="Realize Consultadoria" className="h-12 mb-8" />
        
        <div className="bg-card rounded-xl p-8 shadow-lg max-w-sm w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="bg-green-100 dark:bg-green-900/30 rounded-full p-4">
              <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              Login efetuado com sucesso!
            </h2>
            <p className="text-muted-foreground text-sm">
              {transferToken 
                ? "Toque no botão abaixo para abrir a app e ficar autenticado automaticamente."
                : "Pode agora abrir a app Realize no seu telemóvel."}
            </p>
          </div>

          {transferToken && (
            <Button 
              className="w-full"
              onClick={() => {
                window.location.href = getPWAUrl();
              }}
            >
              <Smartphone className="h-4 w-4 mr-2" />
              Abrir na App Realize
            </Button>
          )}

          {isGeneratingToken && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">A preparar...</span>
            </div>
          )}

          <div className="bg-muted/50 rounded-lg p-4 flex items-center gap-3">
            <Smartphone className="h-8 w-8 text-primary flex-shrink-0" />
            <p className="text-sm text-left text-muted-foreground">
              {transferToken 
                ? "O link expira em 5 minutos. Se não funcionar, faça login diretamente na app."
                : "Se tem a app instalada, abra-a diretamente."}
            </p>
          </div>

          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => {
              isRedirecting.current = true;
              window.location.href = "/colaborador";
            }}
          >
            Continuar no navegador
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <img src={logoRealize} alt="Realize Consultadoria" className="h-12 mb-8" />
      <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
      <p className="text-muted-foreground text-center">{status}</p>
    </div>
  );
};

export default AuthCallbackPage;
