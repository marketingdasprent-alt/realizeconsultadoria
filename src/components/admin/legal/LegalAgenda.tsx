import React, { useState, useEffect } from 'react';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { pt } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Info, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { LegalClient } from './LegalClientModal';

// Simplified Portuguese Holidays calculator for common fixed dates
const getFixedHolidays = (year: number) => [
  { name: "Ano Novo", date: new Date(year, 0, 1) },
  { name: "Dia da Liberdade", date: new Date(year, 3, 25) },
  { name: "Dia do Trabalhador", date: new Date(year, 4, 1) },
  { name: "Dia de Portugal", date: new Date(year, 5, 10) },
  { name: "Assunção de N. Sra.", date: new Date(year, 7, 15) },
  { name: "Implantação da República", date: new Date(year, 9, 5) },
  { name: "Todos os Santos", date: new Date(year, 10, 1) },
  { name: "Restauração da Indep.", date: new Date(year, 11, 1) },
  { name: "Imaculada Conceição", date: new Date(year, 11, 8) },
  { name: "Natal", date: new Date(year, 11, 25) },
  // 2026 variable (Easter)
  { name: "Sexta-feira Santa", date: new Date(2026, 3, 3) },
  { name: "Páscoa", date: new Date(2026, 3, 5) },
  { name: "Corpo de Deus", date: new Date(2026, 5, 4) },
];

interface LegalAgendaProps {
  clients: LegalClient[];
}

interface AgendaEvent {
  id?: string;
  title: string;
  event_date: string;
  description?: string;
}

export default function LegalAgenda({ clients }: LegalAgendaProps) {
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [manualEvents, setManualEvents] = useState<AgendaEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Day dialog state
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isDayOpen, setIsDayOpen] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState("");

  const forceStartOfDay = (d: Date) => {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy;
  };

  const fetchManualEvents = async () => {
    setIsLoading(true);
    try {
      // Get all manual events from Supabase for current month view
      const startStr = format(startOfMonth(currentDate), 'yyyy-MM-dd');
      const endStr = format(endOfMonth(currentDate), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('legal_agenda_events')
        .select('*')
        .gte('event_date', startStr)
        .lte('event_date', endStr);
        
      if (error) {
        // Table might not exist yet, suppress error silently in UI but log to console
        console.warn("Could not fetch agenda events, matching table might not exist yet:", error.message);
      } else {
        setManualEvents(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchManualEvents();
  }, [currentDate]);

  // Derived Client Events
  const getClientEventsForDate = (date: Date) => {
    const dTime = forceStartOfDay(date).getTime();
    const evts: { title: string, type: 'deadline' | 'installment' }[] = [];
    
    clients.forEach(c => {
      if (c.status === 'Resolvido' || c.status === 'Inativo') return;
      
      // Global deadline
      if (c.deadline_date) {
        const [y, m, d] = c.deadline_date.split('-').map(Number);
        if (forceStartOfDay(new Date(y, m - 1, d)).getTime() === dTime) {
          evts.push({ title: `${c.name} (Data Limite)`, type: 'deadline' });
        }
      }

      // Installments
      if (c.legal_installments) {
        c.legal_installments.forEach((inst: any) => {
           if (inst.status === 'Pendente' && inst.due_date) {
             const [y, m, d] = inst.due_date.split('-').map(Number);
             if (forceStartOfDay(new Date(y, m - 1, d)).getTime() === dTime) {
               evts.push({ title: `${c.name} (Parcela: ${Number(inst.amount) || 0}€)`, type: 'installment' });
             }
           }
        });
      }
    });
    return evts;
  };

  const getDayTags = (date: Date) => {
    const dTime = forceStartOfDay(date).getTime();
    
    const clientEvts = getClientEventsForDate(date);
    const hasClientEvents = clientEvts.length > 0;
    
    const holidays = getFixedHolidays(date.getFullYear());
    const holiday = holidays.find(h => forceStartOfDay(h.date).getTime() === dTime);
    
    const dStr = format(date, 'yyyy-MM-dd');
    const dbEvents = manualEvents.filter(e => e.event_date === dStr);
    
    return {
      clientEvts,
      holiday,
      dbEvents
    };
  };

  const handleDayClick = (d: Date) => {
    setSelectedDate(d);
    setIsDayOpen(true);
  };

  const handleAddManualEvent = async () => {
    if (!selectedDate || !newEventTitle.trim()) return;
    
    const event_date = format(selectedDate, 'yyyy-MM-dd');
    const { error } = await supabase.from('legal_agenda_events').insert([
      { title: newEventTitle, event_date }
    ]);
    
    if (error) {
      toast({
        title: "Erro",
        description: "A tabela 'legal_agenda_events' poderá ainda não ter sido criada no Supabase. Execute o script fornecido.",
        variant: "destructive"
      });
    } else {
      toast({ title: "Evento adicionado com sucesso." });
      setNewEventTitle("");
      fetchManualEvents();
    }
  };

  const handleDeleteManualEvent = async (id: string | undefined) => {
    if (!id) return;
    
    const { error } = await supabase.from('legal_agenda_events').delete().eq('id', id);
    
    if (error) {
      toast({ title: "Erro ao apagar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Evento apagado da agenda." });
      fetchManualEvents();
    }
  };

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  // Render Calendar Grid
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  return (
    <>
      <Card className="mt-6 mb-6">
        <CardHeader className="flex flex-row items-center justify-between py-4 bg-muted/30">
          <CardTitle className="text-xl font-display flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Agenda Mensal
          </CardTitle>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold text-lg capitalize min-w-[120px] text-center">
              {format(currentDate, 'MMMM yyyy', { locale: pt })}
            </span>
            <Button variant="outline" size="icon" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-b">
            {weekDays.map(day => (
              <div key={day} className="text-center py-2 text-sm font-semibold text-muted-foreground border-r last:border-r-0">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day, idx) => {
              const acts = getDayTags(day);
              const isCurrentMonth = isSameMonth(day, monthStart);
              const isToday = isSameDay(day, new Date());
              
              return (
                <div 
                  key={day.toString()} 
                  onClick={() => handleDayClick(day)}
                  className={`min-h-[100px] border-r border-b last:border-r-0 p-2 cursor-pointer transition-colors hover:bg-muted/50 flex flex-col gap-1
                    ${!isCurrentMonth ? 'bg-gray-100 dark:bg-gray-900/60 text-gray-500' : 'bg-background'}
                    ${isToday ? 'ring-2 ring-primary ring-inset' : ''}
                  `}
                >
                  <div className="flex justify-between items-start">
                    <span className={`text-sm font-medium ${isToday ? 'bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center' : ''}`}>
                      {format(day, 'd')}
                    </span>
                  </div>
                  
                  <div className="flex flex-col gap-1 mt-1 flex-1 overflow-y-auto w-full no-scrollbar">
                    {acts.holiday && (
                      <div className="text-[10px] bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-1 py-0.5 rounded border border-green-200 truncate">
                        {acts.holiday.name}
                      </div>
                    )}
                    {acts.clientEvts.map((ce, i) => (
                      <div key={i} className="text-[10px] bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 px-1 py-0.5 rounded border border-red-200 truncate" title={ce.title}>
                         € {ce.title.split(' ')[0]}
                      </div>
                    ))}
                    {acts.dbEvents.map((de, i) => (
                      <div key={i} className="text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 px-1 py-0.5 rounded border border-blue-200 truncate" title={de.title}>
                        {de.title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDayOpen} onOpenChange={setIsDayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">Agenda: {selectedDate ? format(selectedDate, 'EEEE, d MMMM yyyy', { locale: pt }) : ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedDate && (() => {
              const acts = getDayTags(selectedDate);
              const isEmpty = !acts.holiday && acts.clientEvts.length === 0 && acts.dbEvents.length === 0;

              return (
                <div className="space-y-3">
                  {acts.holiday && (
                    <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-100">
                      <Info className="h-4 w-4 text-green-600" />
                      <span className="font-semibold text-green-700">{acts.holiday.name} (Feriado)</span>
                    </div>
                  )}
                  {acts.clientEvts.map((c, i) => (
                    <div key={`c-${i}`} className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-100">
                      <Badge variant="destructive">Pendente</Badge>
                      <span className="text-sm font-medium">{c.title}</span>
                    </div>
                  ))}
                  {acts.dbEvents.map((d, i) => (
                    <div key={`d-${i}`} className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-100 group">
                       <Badge className="bg-blue-500 hover:bg-blue-600 text-white border-transparent">Manual</Badge>
                       <span className="text-sm font-medium flex-1">{d.title}</span>
                       <Button 
                         size="icon" 
                         variant="ghost" 
                         className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" 
                         onClick={() => handleDeleteManualEvent(d.id)}
                       >
                         <Trash2 className="h-4 w-4 text-red-500" />
                       </Button>
                    </div>
                  ))}
                  
                  {isEmpty && (
                    <p className="text-sm text-muted-foreground italic">Não existem eventos associados a este dia.</p>
                  )}
                </div>
              )
            })()}

            <div className="pt-4 border-t space-y-2 mt-4">
              <span className="text-sm font-semibold">Adicionar Evento Manual</span>
              <div className="flex gap-2">
                <Input 
                  placeholder="Nome do evento (ex: Reunião, Férias Tribunal...)" 
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddManualEvent()}
                />
                <Button onClick={handleAddManualEvent}>Gravar</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
