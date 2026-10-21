import { useEffect, useState } from 'react';
import {
  categoryForKind,
  emailDomainFor,
  fullAddress,
  isValidEmail,
  kindOfCategory,
  localPart,
  type AccessKind,
  type Credential,
} from '../../../lib/credentials';
import { credentialService, type CredentialsData } from '../../../services/credentialService';

/** O que o painel abre: um acesso para editar, ou um novo (com tipo/empresa/pessoa já escolhidos). */
export interface AccessPanelTarget {
  credential?: Credential | null;
  kind?: AccessKind;
  companyId?: string;
  employeeId?: string;
  categoryId?: string;
  title?: string;
}

export interface AccessForm {
  kind: AccessKind;
  companyId: string;
  categoryId: string;
  /** Email: a parte antes do @ (ou o endereço todo); outros: o utilizador. */
  local: string;
  password: string;
  title: string;
  url: string;
  notes: string;
  employeeId: string;
  people: string[];
}

export type Outcome = { tone: 'ok' | 'warn' | 'error'; message: string } | null;
export type Phase = 'form' | 'saving' | 'linking' | 'done';

const isEmailKind = (kind: AccessKind) => kind === 'email_personal' || kind === 'email_department';

const initialForm = (target: AccessPanelTarget | null, data: CredentialsData): AccessForm => {
  const credential = target?.credential;
  if (credential) {
    const kind = kindOfCategory(credential.access_categories?.name);
    const domain = emailDomainFor(credential.company_id, data.companies, data.credentials);
    return {
      kind,
      companyId: credential.company_id,
      categoryId: credential.category_id ?? '',
      local: isEmailKind(kind) ? localPart(credential.username, domain) : credential.username,
      // Cifrada na BD: ao editar, vazio = fica a que está.
      password: '',
      title: credential.title,
      url: credential.url ?? '',
      notes: credential.notes ?? '',
      employeeId: credential.employee_id ?? '',
      people: data.shares.get(credential.id) ?? [],
    };
  }
  return {
    kind: target?.kind ?? 'email_personal',
    companyId: target?.companyId ?? '',
    categoryId: target?.categoryId ?? '',
    local: '',
    password: '',
    title: target?.title ?? '',
    url: '',
    notes: '',
    employeeId: target?.employeeId ?? '',
    people: [],
  };
};

/** Estado e gravação do painel de acesso (incluindo ligar a caixa ao Webmail). */
export const useAccessForm = (
  open: boolean,
  target: AccessPanelTarget | null,
  data: CredentialsData,
  onSaved: () => void
) => {
  const [form, setForm] = useState<AccessForm>(() => initialForm(target, data));
  // A categoria que o acesso já tinha (Base de Dados, Servidor…) fica enquanto não mudar o tipo.
  const [originKind, setOriginKind] = useState<AccessKind>(form.kind);
  const [errors, setErrors] = useState<Partial<Record<keyof AccessForm, string>>>({});
  const [phase, setPhase] = useState<Phase>('form');
  const [outcome, setOutcome] = useState<Outcome>(null);
  // Depois de criar, "Guardar outra vez" atualiza o mesmo acesso.
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const initial = initialForm(target, data);
    setForm(initial);
    setOriginKind(initial.kind);
    setErrors({});
    setPhase('form');
    setOutcome(null);
    setSavedId(null);
    // Só ao abrir: os dados que chegam depois não apagam o que se está a escrever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target]);

  const update = (patch: Partial<AccessForm>) => {
    setForm(current => ({ ...current, ...patch }));
    setErrors(current => {
      const next = { ...current };
      for (const key of Object.keys(patch)) delete next[key as keyof AccessForm];
      return next;
    });
  };

  const isEmail = isEmailKind(form.kind);
  const domain = form.companyId
    ? emailDomainFor(form.companyId, data.companies, data.credentials)
    : null;
  const employee = data.employees.find(e => e.id === form.employeeId) ?? null;

  const save = async () => {
    const username = isEmail ? fullAddress(form.local, domain) : form.local.trim();
    const editingId = target?.credential?.id ?? savedId ?? undefined;
    const found: typeof errors = {};
    if (!form.companyId) found.companyId = 'Escolha a empresa.';
    if (isEmail && !isValidEmail(username)) found.local = 'Endereço de email inválido.';
    if (!isEmail && !username) found.local = 'Indique o utilizador.';
    if (!form.password && !editingId) found.password = 'Indique a palavra-passe.';
    if (!isEmail && !form.title.trim()) found.title = 'Dê um nome ao acesso.';
    if (Object.keys(found).length > 0) return setErrors(found);

    const category =
      form.categoryId && form.kind === originKind
        ? (data.categories.find(c => c.id === form.categoryId) ?? null)
        : categoryForKind(form.kind, data.categories);
    const title =
      form.title.trim() ||
      (form.kind === 'email_personal' && employee ? `Email ${employee.name}` : username);

    setPhase('saving');
    if (isEmail && (await credentialService.isDuplicateEmail(username, editingId))) {
      setPhase('form');
      return setErrors({ local: 'Este email já é a caixa de outro acesso de email.' });
    }
    const { data: id, error } = await credentialService.save(
      {
        title,
        username,
        ...(form.password ? { password: form.password } : {}),
        url: form.url.trim() || null,
        notes: form.notes.trim() || null,
        company_id: form.companyId,
        category_id: category?.id ?? null,
        employee_id: form.kind === 'email_department' ? null : form.employeeId || null,
      },
      editingId
    );
    if (error || !id) {
      setPhase('form');
      return setOutcome({ tone: 'error', message: 'Não foi possível guardar o acesso.' });
    }
    setSavedId(id);
    onSaved();
    if (!isEmail) {
      setPhase('done');
      return setOutcome({ tone: 'ok', message: 'Acesso guardado.' });
    }
    setPhase('linking');
    setOutcome(await linkOutcome(id, form, data, employee));
    setPhase('done');
    onSaved();
  };

  return { form, update, errors, phase, outcome, isEmail, domain, save };
};

/** Liga a caixa a quem a deve ter e explica o resultado. */
const linkOutcome = async (
  id: string,
  form: AccessForm,
  data: CredentialsData,
  employee: CredentialsData['employees'][number] | null
): Promise<Outcome> => {
  // Quem já tem acesso (as pessoas escolhem-se na janela das pessoas, na lista).
  const shared = data.shares.get(id) ?? form.people;
  const receivers = data.employees.filter(
    e =>
      e.is_active &&
      e.user_id &&
      (shared.includes(e.id) || (form.kind === 'email_personal' && e.id === employee?.id))
  );
  if (receivers.length === 0) {
    const message =
      employee && form.kind === 'email_personal'
        ? `Guardado. ${employee.name} ainda não tem conta na app — a caixa liga quando tiver.`
        : 'Guardado. Para a caixa aparecer no Webmail, escolha as pessoas no ícone de pessoas da lista.';
    return { tone: 'warn', message };
  }
  const { members, error } = await credentialService.linkMailbox(id);
  if (error) return { tone: 'error', message: `Guardado, mas a caixa não ligou: ${error}` };
  return {
    tone: 'ok',
    message: `Guardado e ligado ao Webmail de ${members} ${members === 1 ? 'pessoa' : 'pessoas'}.`,
  };
};
