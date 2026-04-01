import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FolderOpen, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo-realize.png";
import EmployeeDocumentsSection from "@/components/employee/EmployeeDocumentsSection";

interface Employee {
  id: string;
  name: string;
  company_id: string;
  companies: { name: string };
}

const EmployeeDocumentsPage = () => {
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        navigate("/colaborador/login");
        return;
      }

      const { data: employeeData } = await supabase
        .from("employees")
        .select("*, companies(name)")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!employeeData) {
        navigate("/colaborador/login");
        return;
      }

      setEmployee(employeeData);
      setIsLoading(false);
    };

    loadData();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold mx-auto"></div>
          <p className="mt-4 text-muted-foreground">A carregar...</p>
        </div>
      </div>
    );
  }

  if (!employee) return null;

  return (
    <div className="min-h-screen bg-secondary">
      {/* Header */}
      <header className="bg-background border-b border-border sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 lg:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 lg:gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 lg:h-10 lg:w-10"
                onClick={() => navigate("/colaborador")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <img
                src={logo}
                alt="Realize Consultadoria"
                className="h-8 lg:h-12 w-auto hidden sm:block"
              />
              <div>
                <h1 className="font-display text-base lg:text-xl font-semibold flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 lg:h-5 lg:w-5 text-gold" />
                  Meus Documentos
                </h1>
                <p className="text-xs lg:text-sm text-muted-foreground hidden sm:block">
                  Documentos da empresa
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9 lg:h-10 lg:w-10" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-4 lg:py-6">
        <EmployeeDocumentsSection employeeId={employee.id} />
      </main>
    </div>
  );
};

export default EmployeeDocumentsPage;
