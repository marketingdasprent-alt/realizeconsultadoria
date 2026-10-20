import React, { useMemo, useState } from 'react';
import DeleteConfirmDialog from '@/components/admin/DeleteConfirmDialog';
import { useCredentials } from '../../hooks/useCredentials';
import { useEmailActions } from '../../hooks/useEmailActions';
import type { Credential } from '../../lib/credentials';
import {
  buildEmailRows,
  countStates,
  filterEmailRows,
  withoutPersonalEmail,
  type EmailFilters,
} from '../../lib/emailRows';
import { EmailPeopleDialog } from './EmailPeopleDialog';
import { EmailRow } from './EmailRow';
import { EmailsToolbar } from './EmailsToolbar';
import { MissingPeopleNotice } from './MissingPeopleNotice';
import { AccessPanel } from './panel/AccessPanel';
import type { AccessPanelTarget } from './panel/useAccessForm';

/** Acessos → Emails: cada caixa, de quem é e se está ligada ao Webmail. */
export const EmailsTab: React.FC<{ canManage: boolean }> = ({ canManage }) => {
  const data = useCredentials();
  const actions = useEmailActions(data.refresh);
  const [filters, setFilters] = useState<EmailFilters>({
    search: '',
    companyId: 'all',
    type: 'all',
    state: 'all',
  });
  const [panel, setPanel] = useState<AccessPanelTarget | null>(null);
  const [peopleOf, setPeopleOf] = useState<Credential | null>(null);
  const [toDelete, setToDelete] = useState<Credential | null>(null);

  const rows = useMemo(() => buildEmailRows(data), [data]);
  const scoped = useMemo(
    () => filterEmailRows(rows, { ...filters, state: 'all' }),
    [rows, filters]
  );
  const list = filters.state === 'all' ? scoped : scoped.filter(r => r.state === filters.state);
  const counts = countStates(scoped);
  const missing = withoutPersonalEmail(data, filters.companyId);

  return (
    <div className="space-y-4">
      <MissingPeopleNotice
        people={missing}
        what="com conta na app mas sem email pessoal"
        canManage={canManage}
        onCreate={employee =>
          setPanel({
            kind: 'email_personal',
            companyId: employee.company_id,
            employeeId: employee.id,
          })
        }
      />
      <section className="overflow-hidden rounded-[28px] bg-white shadow-rz-soft ring-1 ring-rz-line">
        <EmailsToolbar
          filters={filters}
          counts={counts}
          companies={data.companies}
          canManage={canManage}
          bulk={actions.bulk}
          onChange={patch => setFilters(current => ({ ...current, ...patch }))}
          onLinkAll={() =>
            void actions.linkAll(scoped.filter(r => r.state === 'pending').map(r => r.credential))
          }
          onNew={() => setPanel({ kind: 'email_personal' })}
        />
        {data.isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3, 4].map(key => (
              <div key={key} className="h-12 animate-pulse rounded-xl bg-rz-canvas" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <p className="px-6 py-12 text-center text-[14px] text-rz-muted">
            {data.isError
              ? 'Não foi possível carregar os emails.'
              : 'Sem emails com estes filtros.'}
          </p>
        ) : (
          <ul className="divide-y divide-rz-line">
            {list.map(row => (
              <EmailRow
                key={row.credential.id}
                {...row}
                linking={actions.linking.has(row.credential.id)}
                canManage={canManage}
                onLink={() => void actions.link(row.credential)}
                onPeople={() => setPeopleOf(row.credential)}
                onEdit={() => setPanel({ credential: row.credential })}
                onDelete={() => setToDelete(row.credential)}
              />
            ))}
          </ul>
        )}
      </section>

      <AccessPanel
        target={panel}
        data={data}
        onClose={() => setPanel(null)}
        onSaved={() => void data.refresh()}
      />
      <EmailPeopleDialog
        credential={peopleOf}
        current={peopleOf ? (data.shares.get(peopleOf.id) ?? []) : []}
        employees={data.employees}
        onClose={() => setPeopleOf(null)}
        onSave={actions.savePeople}
      />
      <DeleteConfirmDialog
        open={!!toDelete}
        onOpenChange={open => !open && setToDelete(null)}
        title="Eliminar email"
        description="O acesso sai da lista e a caixa deixa de aparecer no Webmail de quem a tinha."
        itemName={toDelete?.username}
        onConfirm={async () => {
          if (toDelete) await actions.remove(toDelete);
          setToDelete(null);
        }}
      />
    </div>
  );
};
