import React from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Briefcase, Building2, CalendarCheck, Lock, Mail, Phone, Users } from 'lucide-react';
import type { WorkspaceUser } from '../../context/workspaceContext';

interface ProfileInfoCardProps {
  user: WorkspaceUser;
  isOwn: boolean;
}

interface Row {
  icon: React.ElementType;
  label: string;
  value: string | null;
  href?: string;
  /** Só o próprio vê (dados de RH não ficam públicos por estarem no perfil). */
  privateField?: boolean;
}

/** Informação profissional; a data de admissão só aparece no próprio perfil. */
export const ProfileInfoCard: React.FC<ProfileInfoCardProps> = ({ user, isOwn }) => {
  const rows: Row[] = [
    { icon: Mail, label: 'Email', value: user.email, href: `mailto:${user.email}` },
    {
      icon: Phone,
      label: 'Telefone',
      value: user.phone,
      href: user.phone ? `tel:${user.phone}` : undefined,
    },
    { icon: Building2, label: 'Empresa', value: user.companyName },
    { icon: Users, label: 'Departamento', value: user.department },
    { icon: Briefcase, label: 'Cargo', value: user.position },
    {
      icon: CalendarCheck,
      label: 'Data de admissão',
      value: user.hireDate
        ? format(new Date(user.hireDate), "d 'de' MMMM 'de' yyyy", { locale: pt })
        : null,
      privateField: true,
    },
  ];

  return (
    <section className="rounded-[28px] bg-white p-5 shadow-rz-soft ring-1 ring-rz-line md:p-6">
      <h2 className="text-[17px] font-bold">Informação profissional</h2>
      <dl className="mt-4 grid gap-2 sm:grid-cols-2">
        {rows
          .filter(row => isOwn || (!row.privateField && row.value))
          .map(row => {
            const Icon = row.icon;
            return (
              <div key={row.label} className="flex items-center gap-3 rounded-2xl bg-rz-canvas p-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-rz-primary shadow-sm">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0">
                  <dt className="flex items-center gap-1 text-xs font-semibold text-rz-muted">
                    {row.label}
                    {row.privateField && (
                      <Lock className="h-3 w-3" aria-label="Só visível para si" />
                    )}
                  </dt>
                  <dd className="truncate text-[14px] font-semibold">
                    {row.value ? (
                      row.href ? (
                        <a href={row.href} className="hover:text-rz-primary">
                          {row.value}
                        </a>
                      ) : (
                        row.value
                      )
                    ) : (
                      <span className="font-normal text-rz-muted">Por preencher</span>
                    )}
                  </dd>
                </div>
              </div>
            );
          })}
      </dl>
    </section>
  );
};
