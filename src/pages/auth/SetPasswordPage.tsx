import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { Session } from "@supabase/supabase-js";
import logoRealize from "@/assets/logo-realize.png";

const SetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [isValidating, setIsValidating] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Refs to prevent race conditions
  const hasSubmitted = useRef(false);
  const sessionRef = useRef<Session | null>(null);
  const isRedirecting = useRef(false);

  useEffect(() => {
    console.log("[SetPasswordPage] Initializing...");

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        console.log("[SetPasswordPage] Auth event:", event, "hasSubmitted:", hasSubmitted.current);
        
        // Update refs and state
        sessionRef.current = newSession;
        setSession(newSession);
        
        if (newSession) {
          setIsValidating(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      console.log("[SetPasswordPage] Existing session:", !!existingSession);
      sessionRef.current = existingSession;
      setSession(existingSession);
      if (existingSession) {
        setIsValidating(false);
      }
    });

    // Timeout using ref to avoid closure issues
    const timeout = setTimeout(() => {
      if (!sessionRef.current && !hasSubmitted.current) {
        console.log("[SetPasswordPage] Timeout - no session found");
        setValidationError("Link inválido ou expirado. Por favor solicite um novo convite.");
        setIsValidating(false);
      }
    }, 10000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent double submission
    if (hasSubmitted.current || isLoading) {
      console.log("[SetPasswordPage] Already submitted or loading, ignoring");
      return;
    }

    const trimmedPassword = password.trim();
    const trimmedConfirmPassword = confirmPassword.trim();

    if (trimmedPassword.length < 8) {
      toast({
        title: "Erro",
        description: "A palavra-passe deve ter pelo menos 8 caracteres.",
        variant: "destructive",
      });
      return;
    }

    if (trimmedPassword !== trimmedConfirmPassword) {
      toast({
        title: "Erro",
        description: "As palavras-passe não coincidem.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    hasSubmitted.current = true;

    try {
      console.log("[SetPasswordPage] Updating password...");
      
      // Single updateUser call with password + metadata
      const { error: updateError } = await supabase.auth.updateUser({
        password: trimmedPassword,
        data: { must_set_password: false }
      });

      if (updateError) {
        hasSubmitted.current = false;
        // Map common errors to Portuguese messages
        let errorMessage = "Não foi possível definir a palavra-passe.";
        const errorCode = (updateError as any).code || "";
        const errorMsg = updateError.message?.toLowerCase() || "";
        
        if (errorCode === "weak_password" || errorMsg.includes("weak")) {
          errorMessage = "A palavra-passe é considerada fraca. Use pelo menos 8 caracteres com maiúsculas, minúsculas, números e símbolos.";
        } else if (errorMsg.includes("same") || errorMsg.includes("different")) {
          errorMessage = "A nova palavra-passe deve ser diferente da anterior.";
        } else if (updateError.message) {
          errorMessage = updateError.message;
        }
        
        toast({
          title: "Erro",
          description: errorMessage,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Get user for redirect logic
      const { data: { user } } = await supabase.auth.getUser();

      toast({
        title: "Sucesso",
        description: "Palavra-passe definida com sucesso!",
      });

      // Prevent any further auth event handling
      isRedirecting.current = true;

      // Small delay to ensure toast appears and session stabilizes
      await new Promise(resolve => setTimeout(resolve, 500));

      // Determine redirect destination
      const mode = searchParams.get("mode");
      console.log("[SetPasswordPage] Redirecting, mode:", mode);

      if (mode === "admin") {
        window.location.href = "/admin";
        return;
      }

      // Check if user is employee
      if (user) {
        const { data: employee } = await supabase
          .from("employees")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (employee) {
          window.location.href = "/colaborador";
          return;
        }

        // Check if admin
        const { data: adminRole } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();

        if (adminRole) {
          window.location.href = "/admin";
          return;
        }
      }

      // Fallback
      window.location.href = "/";

    } catch (error: any) {
      console.error("[SetPasswordPage] Error:", error);
      hasSubmitted.current = false;
      toast({
        title: "Erro",
        description: error.message || "Não foi possível definir a palavra-passe.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  // Loading state
  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <img src={logoRealize} alt="Realize Consultadoria" className="h-12 mb-6" />
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">A validar o link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (validationError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <img src={logoRealize} alt="Realize Consultadoria" className="h-12 mb-6" />
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-center text-destructive mb-6">{validationError}</p>
            <Button onClick={() => navigate("/admin/login")} variant="outline">
              Voltar ao Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src={logoRealize} alt="Realize Consultadoria" className="h-12 mx-auto mb-4" />
          <CardTitle>Definir Palavra-passe</CardTitle>
          <CardDescription>
            Crie uma palavra-passe segura para a sua conta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova Palavra-passe</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  required
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Palavra-passe</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a palavra-passe"
                  required
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isLoading}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  A processar...
                </>
              ) : (
                "Definir Palavra-passe"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SetPasswordPage;
