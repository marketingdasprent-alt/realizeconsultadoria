import { useState, useEffect } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Aviso {
  id: string;
  title: string;
  message: string;
  created_at: string;
}

interface AvisosSectionProps {
  companyId: string;
  employeeId: string;
}

export function AvisosSection({ companyId, employeeId }: AvisosSectionProps) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    fetchAvisos();
  }, [companyId, employeeId]);

  const fetchAvisos = async () => {
    // Fetch global notices (company_id IS NULL AND employee_id IS NULL)
    // + company notices (company_id = companyId AND employee_id IS NULL)
    // + individual notices (employee_id = employeeId)
    const { data, error } = await supabase
      .from('notifications')
      .select('id, title, message, created_at')
      .eq('is_active', true)
      .or(`and(company_id.is.null,employee_id.is.null),and(company_id.eq.${companyId},employee_id.is.null),employee_id.eq.${employeeId}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar avisos:', error);
      return;
    }

    setAvisos(data || []);
  };

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? avisos.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === avisos.length - 1 ? 0 : prev + 1));
  };

  if (avisos.length === 0) {
    return (
      <Card className="shadow-card bg-red-50 border-red-200">
        <CardHeader className="p-3 lg:p-4 pb-2">
          <CardTitle className="font-display text-base lg:text-lg flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 lg:h-5 lg:w-5 text-red-500 shrink-0" />
            Avisos
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 lg:px-4 pt-0 pb-3 lg:pb-4">
          <p className="text-sm text-muted-foreground">Sem avisos de momento.</p>
        </CardContent>
      </Card>
    );
  }

  const currentAviso = avisos[currentIndex];

  return (
    <Card className="shadow-card bg-red-50 border-red-200">
      <CardHeader className="p-3 lg:p-4 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-base lg:text-lg flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 lg:h-5 lg:w-5 text-red-500 shrink-0" />
            Avisos Importantes
          </CardTitle>
          {avisos.length > 1 && (
            <span className="text-xs text-muted-foreground">
              {currentIndex + 1} de {avisos.length}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-3 lg:px-4 pt-0 pb-3 lg:pb-4">
        <div className="flex items-center gap-2">
          {avisos.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 lg:h-9 lg:w-9 shrink-0"
              onClick={handlePrevious}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="flex-1 p-2 lg:p-3 bg-background border border-red-200 rounded-lg min-w-0">
            <h4 className="font-semibold text-foreground text-sm lg:text-base">{currentAviso.title}</h4>
            <p className="text-xs lg:text-sm text-muted-foreground mt-1 whitespace-pre-wrap break-words">
              {currentAviso.message}
            </p>
          </div>
          {avisos.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 lg:h-9 lg:w-9 shrink-0"
              onClick={handleNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
        {/* Mobile: Dot indicators for multiple avisos */}
        {avisos.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-2 lg:hidden">
            {avisos.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === currentIndex ? 'bg-red-500' : 'bg-red-200'
                }`}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
