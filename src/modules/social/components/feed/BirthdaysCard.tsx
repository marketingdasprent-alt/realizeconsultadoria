import React from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Cake } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/modules/workspace/components/UserAvatar';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { useUpcomingBirthdays } from '../../hooks/useUpcomingBirthdays';

const whenLabel = (date: string, daysUntil: number): string => {
  if (daysUntil === 0) return 'Hoje 🎂';
  if (daysUntil === 1) return 'Amanhã';
  return format(new Date(`${date}T12:00:00`), "EEEE, d 'de' MMM", { locale: pt });
};

/** Cartão do Feed: quem faz anos hoje e nas próximas duas semanas (sem idade). */
export const BirthdaysCard: React.FC<{ className?: string }> = ({ className }) => {
  const { basePath } = useWorkspace();
  const birthdays = useUpcomingBirthdays(14);
  if (birthdays.length === 0) return null;
  return (
    <section
      className={cn('rounded-[28px] bg-white p-5 shadow-rz-soft ring-1 ring-rz-line', className)}
    >
      <h2 className="flex items-center gap-2 text-[15px] font-bold">
        <Cake className="h-4 w-4 text-pink-500" /> Aniversários
      </h2>
      <ul className="mt-3 space-y-1">
        {birthdays.slice(0, 6).map(person => (
          <li key={`${person.userId}-${person.date}`}>
            <Link
              to={`${basePath}/pessoas/${person.userId}`}
              className={cn(
                'flex items-center gap-2.5 rounded-2xl px-2 py-1.5 hover:bg-rz-canvas',
                person.daysUntil === 0 && 'bg-pink-50'
              )}
            >
              <UserAvatar name={person.name} userId={person.userId} size="xs" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold">{person.name}</span>
                <span
                  className={cn(
                    'block text-[12px] first-letter:uppercase',
                    person.daysUntil === 0 ? 'font-bold text-pink-600' : 'text-rz-muted'
                  )}
                >
                  {whenLabel(person.date, person.daysUntil)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};
