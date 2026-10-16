import React from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ChevronRight,
  Download,
  FileText,
  FolderLock,
  KeyRound,
  Receipt,
  LogOut,
  ShieldCheck,
  Stethoscope,
  Trash2,
  UserRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/lib/constants';
import { safetyCheckupView } from '@/lib/employee-home';
import type { EmployeeOutletContext } from '@/modules/employee/hooks/useEmployeeOutlet';
import { maskTail } from '@/modules/employee/lib/home-summaries';
import { WorkScheduleCard } from '@/modules/timeclock/components/employee/WorkScheduleCard';
import { MyEquipmentCard } from '../components/MyEquipmentCard';
import { PushCard } from '../components/PushCard';
import { WorkspacePage } from '../components/WorkspacePage';
import { useWorkspace } from '../context/workspaceContext';

const CARD = 'rounded-[28px] bg-white p-5 shadow-rz-soft ring-1 ring-rz-line md:p-6';
const ROW =
  'flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-[14.5px] font-semibold transition-colors hover:bg-rz-canvas';

const Field: React.FC<{ label: string; value: string | null | undefined }> = ({ label, value }) =>
  value ? (
    <div className="flex justify-between gap-4 py-2.5 text-[14px]">
      <span className="text-rz-muted">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  ) : null;

const LinkRow: React.FC<{
  to: string;
  icon: React.ElementType;
  label: string;
  danger?: boolean;
}> = ({ to, icon: Icon, label, danger }) => (
  <Link to={to} className={cn(ROW, danger && 'text-rose-600')}>
    <Icon className={cn('h-5 w-5', danger ? 'text-rose-500' : 'text-rz-primary')} />
    <span className="flex-1">{label}</span>
    <ChevronRight className="h-4 w-4 text-rz-muted" />
  </Link>
);

/** Definições (briefing §23 e §27): os meus dados, medicina do trabalho, conta e privacidade. */
const SettingsPage: React.FC = () => {
  const { user, basePath, isPreview, onChangePassword, onLogout } = useWorkspace();
  // Ficha completa (dados pessoais, só para o próprio); na pré-visualização não existe.
  const outlet = useOutletContext<EmployeeOutletContext | undefined>();
  const employee = outlet?.employee;
  const safety = employee
    ? safetyCheckupView(employee.safety_checkup_date, employee.safety_checkup_renewal_months)
    : null;

  return (
    <WorkspacePage>
      <h1 className="mb-4 text-[26px] font-extrabold">Definições</h1>
      {/* Duas colunas no computador: os meus dados à esquerda, preferências e conta à direita. */}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <section className={CARD}>
            <h2 className="flex items-center gap-2 text-[17px] font-bold">
              <UserRound className="h-5 w-5 text-rz-primary" /> Os meus dados
            </h2>
            <p className="mt-1 text-[13px] text-rz-muted">
              Só você vê estes dados. Para corrigir algum,{' '}
              <Link to={`${basePath}/tickets?novo=1`} className="font-semibold text-rz-primary">
                abra um pedido aos RH
              </Link>
              .
            </p>
            <div className="mt-3 divide-y divide-rz-line">
              <Field label="Nome" value={user.name} />
              <Field label="Empresa" value={user.companyName} />
              <Field label="Cargo" value={user.position} />
              <Field label="Departamento" value={user.department} />
              <Field
                label="Data de entrada"
                value={user.hireDate ? format(new Date(user.hireDate), 'dd/MM/yyyy') : null}
              />
              <Field label="Email" value={user.email} />
              <Field label="Telefone" value={user.phone} />
              <Field label="Nacionalidade" value={employee?.nationality} />
              <Field label="Documento" value={maskTail(employee?.document_number)} />
              <Field label="IBAN" value={maskTail(employee?.iban)} />
            </div>
            {isPreview && (
              <p className="mt-2 text-xs text-rz-muted">Pré-visualização: sem dados pessoais.</p>
            )}
          </section>

          {/* Sempre visível: sem data, diz que ainda não há consulta registada. */}
          {(employee || isPreview) && (
            <section className={cn(CARD, 'flex items-center gap-4')}>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-white">
                <Stethoscope className="h-6 w-6" />
              </span>
              <div className="flex-1">
                <p className="text-[13px] text-rz-muted">
                  Higiene e segurança no trabalho ·{' '}
                  {safety?.kind === 'scheduled' ? 'consulta marcada' : 'próxima consulta prevista'}
                </p>
                <p className="text-[16px] font-bold">
                  {safety ? format(safety.date, 'dd/MM/yyyy') : 'Ainda sem consulta registada'}
                </p>
              </div>
              {safety && safety.daysLeft <= 60 && (
                <span
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-bold',
                    safety.daysLeft < 0
                      ? 'bg-rose-100 text-rose-700'
                      : safety.kind === 'scheduled'
                        ? 'bg-sky-100 text-sky-800'
                        : 'bg-amber-100 text-amber-800'
                  )}
                >
                  {safety.daysLeft < 0
                    ? 'Em atraso'
                    : safety.daysLeft === 0
                      ? 'Hoje'
                      : `daqui a ${safety.daysLeft} dias`}
                </span>
              )}
            </section>
          )}

          <section className={cn(CARD, 'space-y-1 p-3 md:p-3')}>
            <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-rz-muted">
              Os meus documentos
            </p>
            <LinkRow
              to={`${basePath}/definicoes/documentos`}
              icon={FolderLock}
              label="Documentos pessoais"
            />
            <LinkRow
              to={`${basePath}/definicoes/documentos?tab=recibos`}
              icon={Receipt}
              label="Recibos de vencimento"
            />
          </section>

          <MyEquipmentCard />
        </div>
        <div className="space-y-4">
          <WorkScheduleCard />
          <PushCard />

          <section className={cn(CARD, 'space-y-1 p-3 md:p-3')}>
            <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-rz-muted">
              Conta e segurança
            </p>
            <button type="button" onClick={onChangePassword} className={ROW}>
              <KeyRound className="h-5 w-5 text-rz-primary" />
              <span className="flex-1">Alterar palavra-passe</span>
              <ChevronRight className="h-4 w-4 text-rz-muted" />
            </button>
            <LinkRow
              to={ROUTES.PUBLIC.INSTALL}
              icon={Download}
              label="Instalar a app no telemóvel ou computador"
            />
            <button type="button" onClick={onLogout} className={cn(ROW, 'text-rose-600')}>
              <LogOut className="h-5 w-5 text-rose-500" />
              <span className="flex-1">Terminar sessão</span>
            </button>
          </section>

          <section className={cn(CARD, 'space-y-1 p-3 md:p-3')}>
            <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-rz-muted">
              Privacidade
            </p>
            <LinkRow
              to={ROUTES.PUBLIC.PRIVACY}
              icon={ShieldCheck}
              label="Política de privacidade"
            />
            <LinkRow to={ROUTES.PUBLIC.TERMS} icon={FileText} label="Termos e condições" />
            <LinkRow
              to="/eliminar-conta"
              icon={Trash2}
              label="Pedir a eliminação da conta"
              danger
            />
          </section>
        </div>
      </div>
    </WorkspacePage>
  );
};

export default SettingsPage;
