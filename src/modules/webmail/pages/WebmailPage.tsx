import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, MailOpen } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ConnectMailDialog } from '../components/ConnectMailDialog';
import { FolderManageDialogs, type FolderEdit } from '../components/FolderManageDialogs';
import { NewMailFolderDialog } from '../components/NewMailFolderDialog';
import { ContactListsDialog } from '../components/ContactListsDialog';
import { AttachmentPreview, type PreviewTarget } from '../components/AttachmentPreview';
import { MailAccountDialog } from '../components/MailAccountDialog';
import { MailRulesDialog } from '../components/MailRulesDialog';
import { ManageLabelsDialog } from '../components/ManageLabelsDialog';
import type { LabelFilter } from '../components/MailLabelsSection';
import { useLabelActions } from '../hooks/useLabelActions';
import { useLabelCounts } from '../hooks/useLabelCounts';
import { useAllMailLabels } from '../hooks/useMailLabels';
import type { ListMailAction } from '../components/MailContextMenu';
import { printMail } from '../lib/printMail';
import type { RuleDraft } from '../components/MailRuleForm';
import { MailComposer } from '../components/MailComposer';
import { MailList } from '../components/MailList';
import { MailReader, type ReaderAction } from '../components/MailReader';
import type { CustomFolderRef } from '../components/MailCustomFolders';
import { MailSidebar } from '../components/MailSidebar';
import { SidebarResizer } from '../components/SidebarResizer';
import { MailToTaskOrEvent, type MailConversion } from '../components/MailToTaskOrEvent';
import { ProviderGrid } from '../components/ProviderGrid';
import { useContacts } from '../hooks/useContacts';
import { useKeptUnread } from '../hooks/useKeptUnread';
import { useMailAccounts } from '../hooks/useMailAccounts';
import { useMailActions } from '../hooks/useMailActions';
import { useFolderActions, type MoveTarget } from '../hooks/useFolderActions';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { useMailFolders } from '../hooks/useMailFolders';
import type { MailChange } from '../hooks/useMailChanges';
import { useUnreadCounts } from '../hooks/useUnreadCounts';
import {
  useMailbox,
  useMailMessage,
  usePrefetchMessage,
  usePrefetchTop,
} from '../hooks/useMailbox';
import { FOLDERS, draftFrom, mailKey } from '../lib/mailFormat';
import { draftFromSaved } from '../lib/savedDraft';
import { composeSession } from '../lib/composeSession';
import { mailService } from '../services/mailService';
import { readSidebarWidth, saveSidebarWidth } from '../lib/sidebarWidth';
import { providerOf, type MailProvider } from '../lib/providers';
import type { ComposeDraft, MailAccount, MailFolder, MailSummary } from '../types';

/** Webmail (briefing §9): caixas ligadas, caixa unificada, ler, escrever e organizar. */
const WebmailPage: React.FC = () => {
  const mail = useMailAccounts();
  const prefetch = usePrefetchMessage();
  const [params, setParams] = useSearchParams();
  const [scope, setScope] = useState<string | null>(null);
  const [folder, setFolder] = useState<MailFolder>('inbox');
  // Pasta criada pela pessoa no Outlook/Gmail (em vez de uma das fixas).
  const [custom, setCustom] = useState<CustomFolderRef | null>(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<MailSummary | null>(null);
  // Uma mensagem que ficou a meio ao sair do Email volta, minimizada.
  const [draft, setDraftState] = useState<ComposeDraft | null>(() => composeSession.get());
  const [composerMinimized, setComposerMinimized] = useState(() => !!composeSession.get());
  useEffect(() => {
    if (!draft) composeSession.set(null);
  }, [draft]);
  // Com uma mensagem já aberta (ou minimizada) não se abre outra por cima: volta-se a ela.
  const setDraft = (next: ComposeDraft | null) => {
    if (next && draft) {
      setComposerMinimized(false);
      toast({
        title: 'Já tem uma mensagem aberta',
        description: 'Envie-a ou descarte-a primeiro.',
      });
      return;
    }
    setComposerMinimized(false);
    setDraftState(next);
  };
  const [connect, setConnect] = useState<MailProvider | null>(null);
  const [settings, setSettings] = useState<MailAccount | null>(null);
  const [conversion, setConversion] = useState<MailConversion | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [listsOpen, setListsOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(readSidebarWidth);

  const accounts = mail.accounts;
  const customFolders = useMailFolders(accounts);
  const labels = useAllMailLabels(accounts);
  const labelCounts = useLabelCounts(accounts);
  const [labelFilter, setLabelFilter] = useState<LabelFilter | null>(null);
  const [manageLabels, setManageLabels] = useState<{ accountId: string | null } | null>(null);
  const people = useContacts(accounts);
  const unread = useUnreadCounts(accounts);
  // Caixa escolhida que deixou de existir (ex.: acabou de ser desligada): volta ao normal.
  const chosen = scope === 'all' || accounts.some(a => a.id === scope) ? scope : null;
  const current = chosen ?? (accounts.length > 1 ? 'all' : (accounts[0]?.id ?? 'all'));
  const customOpen = custom && custom.accountId === current ? custom : null;
  // Os "por ler" contam só a Entrada: numa pasta da pessoa não se acertam à mão.
  const actions = useMailActions(customOpen ? undefined : folder);
  const folderActions = useFolderActions(customOpen ? undefined : folder);
  const labelActions = useLabelActions(customOpen ? undefined : folder);
  const { isPreview } = useWorkspace();
  const [rulesDialog, setRulesDialog] = useState<{
    accountId: string | null;
    prefill: Partial<RuleDraft> | null;
  } | null>(null);
  const [folderEdit, setFolderEdit] = useState<FolderEdit | null>(null);
  const [newFolder, setNewFolder] = useState<{
    accountId: string | null;
    parentId: string | null;
  } | null>(null);
  const box = useMailbox(accounts, current, folder, query, customOpen?.id ?? null, labelFilter);
  // Em "Não lidos" o email aberto fica na lista até se sair da pasta ou atualizar.
  const list = useKeptUnread(folder, current, query, box.messages);
  usePrefetchTop(list.messages);
  // Chegou email novo (o total de não lidos subiu): a lista atualiza-se logo, sem esperar.
  // E se a lista da Entrada mostra mais por ler do que o fornecedor conta (lidos noutro sítio,
  // ex. no Outlook ou no telemóvel), também se atualiza: as bolinhas não ficam presas.
  const lastTotal = useRef<number | null>(null);
  useEffect(() => {
    const grew = lastTotal.current !== null && unread.total > lastTotal.current;
    lastTotal.current = unread.total;
    const stale =
      !customOpen &&
      folder === 'inbox' &&
      Object.entries(unread.counts).some(
        ([accountId, count]) =>
          list.messages.filter(m => m.accountId === accountId && m.unread).length > count
      );
    if (grew || stale) void box.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só quando os números chegam
  }, [unread.counts]);
  const selected = active
    ? (list.messages.find(m => mailKey(m) === mailKey(active)) ?? active)
    : null;
  const {
    message,
    isLoading: messageLoading,
    isError: messageError,
    retry: retryMessage,
  } = useMailMessage(active);
  // Marca como lido só depois de o email abrir: nas caixas IMAP as operações vão em fila na
  // mesma ligação, e marcar primeiro atrasava a abertura.
  const readMarked = useRef<string | null>(null);
  useEffect(() => {
    if (!active || !message || message.id !== active.id) return;
    const key = mailKey(active);
    if (readMarked.current === key) return;
    readMarked.current = key;
    void actions.setRead(active, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só quando o email aberto carrega
  }, [message, active]);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search), 400);
    return () => window.clearTimeout(timer);
  }, [search]);

  // "Abrir em nova janela": ?conta=…&email=… abre o Webmail já com esse email aberto.
  const viewAccount = params.get('conta');
  const viewMail = params.get('email');
  useEffect(() => {
    if (!viewAccount || !viewMail || mail.isLoading) return;
    setParams({}, { replace: true });
    if (!accounts.some(a => a.id === viewAccount)) return;
    void mailService.get(viewAccount, viewMail).then(({ data }) => {
      if (!data) {
        toast({ title: 'Não foi possível abrir o email', variant: 'destructive' });
        return;
      }
      setScope(viewAccount);
      setFolder('inbox');
      setCustom(null);
      setActive(data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao chegar com ?conta=&email=
  }, [viewAccount, viewMail, mail.isLoading]);

  // Regresso da autorização do Google/Microsoft (?mail=ligada | erro).
  const result = params.get('mail');
  useEffect(() => {
    if (!result) return;
    if (result === 'ligada') toast({ title: 'Caixa de correio ligada' });
    else
      toast({
        title: 'A caixa não foi ligada',
        description: 'Tente novamente.',
        variant: 'destructive',
      });
    setParams({}, { replace: true });
    void mail.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao chegar com ?mail=
  }, [result]);

  // Na pasta Rascunhos, abrir um email continua-o no compositor.
  const openSavedDraft = async (summary: MailSummary) => {
    const loading = toast({ title: 'A abrir o rascunho…' });
    const { data, error } = await mailService.get(summary.accountId, summary.id);
    loading.dismiss();
    if (error || !data)
      return void toast({ title: 'O rascunho não abriu', variant: 'destructive' });
    setDraft(draftFromSaved(data));
  };

  const open = (summary: MailSummary) => {
    if (folder === 'drafts' && !customOpen) return void openSavedDraft(summary);
    setActive(summary);
    if (summary.unread) list.keep(summary);
  };
  // Lixo pela lista (um ou vários): se o email aberto for um deles, o leitor fecha.
  const closeIfAmong = (mails: MailSummary[]) => {
    if (active && mails.some(m => mailKey(m) === mailKey(active))) setActive(null);
  };
  const moveMails = (mails: MailSummary[], target: MoveTarget) => {
    closeIfAmong(mails);
    list.drop(mails);
    void folderActions.move(mails, target);
  };
  const bulk = (mails: MailSummary[], kind: MailChange) => {
    if (kind === 'trash') {
      closeIfAmong(mails);
      list.drop(mails);
    }
    void actions.bulk(mails, kind);
  };
  const choose = (next: () => void) => {
    next();
    setActive(null);
    setMenuOpen(false);
  };
  const onAction = (action: ReaderAction) => {
    if (!selected) return;
    const email = accounts.find(a => a.id === selected.accountId)?.email ?? '';
    if (action === 'star') return void actions.toggleStar(selected);
    if (action === 'trash' || action === 'unread') {
      if (action === 'trash') list.drop([selected]);
      void (action === 'trash' ? actions.trash(selected) : actions.setRead(selected, false));
      return setActive(null);
    }
    // Imprimir é tratado no próprio leitor.
    if (!message || action === 'print') return;
    if (action === 'task' || action === 'event') return setConversion({ kind: action, message });
    setDraft(draftFrom(message, action, email));
  };

  // Ação pedida no menu do clique direito (responder, tarefa…): abre o email e, quando ele
  // carrega, faz a ação.
  const [pending, setPending] = useState<{ key: string; action: ListMailAction } | null>(null);
  const fromList = (target: MailSummary, action: ListMailAction) => {
    open(target);
    setPending({ key: mailKey(target), action });
  };
  useEffect(() => {
    if (!pending) return;
    if (!active || mailKey(active) !== pending.key) return setPending(null);
    if (!message || message.id !== active.id) return;
    setPending(null);
    if (pending.action === 'print') printMail(message);
    else onAction(pending.action);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só quando o email pedido carrega
  }, [pending, active, message]);

  if (mail.isLoading)
    return <Loader2 className="mx-auto mt-24 h-7 w-7 animate-spin text-rz-primary" />;

  const connectDialog = (
    <ConnectMailDialog
      provider={connect}
      onClose={() => setConnect(null)}
      onOAuth={provider => mail.startOAuth(provider.key)}
      onImap={mail.connectImap}
      onSwitch={setConnect}
    />
  );
  if (!accounts.length || params.get('ligar'))
    return (
      <>
        <ProviderGrid
          onPick={setConnect}
          onBack={accounts.length ? () => setParams({}) : undefined}
        />
        {connectDialog}
      </>
    );

  const sidebar = (className: string, style?: React.CSSProperties) => (
    <MailSidebar
      accounts={accounts}
      scope={current}
      folder={folder}
      unread={unread.counts}
      unreadTotal={unread.total}
      onReorder={ids => void mail.reorder(ids)}
      onScope={id =>
        choose(() => {
          setScope(id);
          setCustom(null);
        })
      }
      onFolder={key =>
        choose(() => {
          setFolder(key);
          setCustom(null);
        })
      }
      customFolders={customFolders.byAccount}
      customFolder={customOpen}
      onRules={
        isPreview
          ? undefined
          : accountId => {
              setMenuOpen(false);
              setRulesDialog({
                accountId: accountId ?? (current === 'all' ? null : current),
                prefill: null,
              });
            }
      }
      onDropToFolder={
        isPreview
          ? undefined
          : (mails, folder) => moveMails(mails, { id: folder.id, name: folder.name })
      }
      onDropToLabel={
        isPreview
          ? undefined
          : (mails, label) => {
              const missing = mails.filter(mail => !mail.labelIds?.includes(label.id));
              if (missing.length) void labelActions.toggle(missing, label);
            }
      }
      onRenameFolder={
        isPreview
          ? undefined
          : folder =>
              setFolderEdit({
                kind: 'rename',
                accountId: folder.accountId,
                folderId: folder.id,
                name: folder.name,
              })
      }
      onDeleteFolder={
        isPreview
          ? undefined
          : folder =>
              setFolderEdit({
                kind: 'delete',
                accountId: folder.accountId,
                folderId: folder.id,
                name: folder.name,
              })
      }
      labels={isPreview ? undefined : labels.byAccount}
      labelFilter={labelFilter}
      labelCounts={labelCounts}
      onLabelFilter={isPreview ? undefined : setLabelFilter}
      onManageLabels={isPreview ? undefined : accountId => setManageLabels({ accountId })}
      onNewFolder={
        isPreview ? undefined : (accountId, parentId) => setNewFolder({ accountId, parentId })
      }
      onCustomFolder={picked =>
        choose(() => {
          setScope(picked.accountId);
          setFolder('inbox');
          setCustom(picked);
        })
      }
      onCompose={() => {
        setMenuOpen(false);
        setDraft({ accountId: current === 'all' ? undefined : current });
      }}
      onConnect={() => setParams({ ligar: '1' })}
      onSettings={setSettings}
      onLists={() => {
        setMenuOpen(false);
        setListsOpen(true);
      }}
      className={className}
      style={style}
    />
  );

  return (
    <div className="flex h-full">
      {sidebar('hidden shrink-0 lg:flex', { width: sidebarWidth })}
      <SidebarResizer width={sidebarWidth} onChange={setSidebarWidth} onCommit={saveSidebarWidth} />
      <MailList
        title={customOpen?.name ?? FOLDERS.find(f => f.key === folder)?.label ?? 'Email'}
        messages={
          labelFilter
            ? list.messages.filter(
                m =>
                  m.accountId === labelFilter.accountId && m.labelIds?.includes(labelFilter.labelId)
              )
            : list.messages
        }
        labelsById={isPreview ? undefined : labels.byId}
        labelsByAccount={isPreview ? undefined : labels.byAccount}
        onLabel={isPreview ? undefined : (mails, label) => void labelActions.toggle(mails, label)}
        onManageLabels={accountId => setManageLabels({ accountId })}
        accounts={accounts}
        activeKey={active ? mailKey(active) : null}
        showAccount={current === 'all'}
        selectionKey={`${current}|${customOpen?.id ?? folder}|${query}`}
        search={search}
        onSearch={setSearch}
        onOpen={open}
        onToggleStar={actions.toggleStar}
        onTrash={target => {
          closeIfAmong([target]);
          void actions.trash(target);
        }}
        onBulk={bulk}
        onMove={moveMails}
        onAction={isPreview ? undefined : fromList}
        onRule={
          isPreview
            ? undefined
            : target =>
                setRulesDialog({
                  accountId: target.accountId,
                  prefill: { fromContains: target.from?.email ?? '' },
                })
        }
        onHover={prefetch}
        onRefresh={() => {
          list.clear();
          void box.refetch();
        }}
        onMenu={() => setMenuOpen(true)}
        isLoading={box.isLoading}
        isRefreshing={box.isRefreshing}
        hasMore={box.hasMore}
        isLoadingMore={box.isLoadingMore}
        onLoadMore={() => void box.loadMore()}
        errors={box.errors}
        className={cn(
          'w-full border-r border-rz-line md:w-[340px] xl:w-[400px]',
          active && 'hidden md:flex'
        )}
      />
      <div className={cn('min-w-0 flex-1', active ? 'flex' : 'hidden md:flex')}>
        {selected ? (
          <MailReader
            summary={selected}
            message={message}
            isLoading={messageLoading}
            isError={messageError}
            onRetry={retryMessage}
            onBack={() => setActive(null)}
            onAction={onAction}
            onDownload={(mail, id) => void actions.download(mail, id)}
            onOpenAttachment={(mail, attachment) =>
              setPreview({ accountId: mail.accountId, messageId: mail.id, attachment })
            }
            onWrite={address => setDraft({ accountId: selected.accountId, to: address.email })}
            accounts={accounts}
            onMove={moveMails}
            labelsById={isPreview ? undefined : labels.byId}
            labels={labels.byAccount[selected.accountId]}
            onLabel={
              isPreview ? undefined : (mails, label) => void labelActions.toggle(mails, label)
            }
            onManageLabels={accountId => setManageLabels({ accountId })}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-rz-muted">
            <span className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-rz-primary-soft text-rz-primary">
              <MailOpen className="h-8 w-8" />
            </span>
            <p className="text-sm">Escolha um email para ler.</p>
          </div>
        )}
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-[290px] border-0 p-0">
          <SheetTitle className="sr-only">Caixas e pastas</SheetTitle>
          {sidebar('h-full pt-12')}
        </SheetContent>
      </Sheet>
      <ManageLabelsDialog
        open={!!manageLabels}
        onClose={() => setManageLabels(null)}
        accounts={accounts}
        accountId={manageLabels?.accountId ?? (current === 'all' ? null : current)}
      />
      <MailRulesDialog
        open={!!rulesDialog}
        onClose={() => setRulesDialog(null)}
        accounts={accounts}
        accountId={rulesDialog?.accountId ?? null}
        prefill={rulesDialog?.prefill}
      />
      <FolderManageDialogs
        edit={folderEdit}
        onClose={() => setFolderEdit(null)}
        onRename={async (edit, name) => {
          const error = await folderActions.rename(edit.accountId, edit.folderId, name);
          // Nas caixas IMAP o id da pasta é o caminho: muda com o nome, a vista volta à Entrada
          if (!error && custom?.accountId === edit.accountId && custom.id === edit.folderId)
            setCustom(null);
          return error;
        }}
        onDelete={async edit => {
          const error = await folderActions.remove(edit.accountId, edit.folderId);
          if (!error && custom?.accountId === edit.accountId) setCustom(null);
          return error;
        }}
      />
      <NewMailFolderDialog
        open={!!newFolder}
        onClose={() => setNewFolder(null)}
        accounts={accounts}
        accountId={newFolder?.accountId ?? null}
        parentId={newFolder?.parentId ?? null}
        onCreate={async (accountId, name, parentId) => {
          const result = await folderActions.create(accountId, name, parentId);
          return result.error;
        }}
      />
      <MailComposer
        draft={draft}
        accounts={accounts}
        contacts={people.contacts}
        lists={people.lists}
        onClose={() => setDraft(null)}
        minimized={composerMinimized}
        onMinimize={() => setComposerMinimized(true)}
        onRestore={() => setComposerMinimized(false)}
        onSend={async input => {
          const ok = await actions.send(input);
          // Falhou: o rascunho volta a abrir como estava (os anexos têm de ser escolhidos outra vez).
          if (!ok)
            setDraftState({
              accountId: input.accountId,
              to: input.to.join(', '),
              cc: input.cc.join(', '),
              bcc: input.bcc.join(', '),
              subject: input.subject,
              body: input.text,
              inReplyTo: input.inReplyTo,
              restored: true,
              // Continua o mesmo rascunho guardado (os anexos voltam a juntar-se).
              saved: input.draft
                ? { messageId: input.draft.id, accountId: input.draft.accountId, attachments: [] }
                : undefined,
              // Os anexos do email original (reencaminhar) voltam a ficar no email
              attach: input.remoteAttachments
                ? {
                    accountId: input.remoteAttachments.accountId,
                    messageId: input.remoteAttachments.messageId,
                    attachments: input.remoteAttachments.items,
                  }
                : undefined,
            });
          return ok;
        }}
        toBase64={actions.toBase64}
      />
      <ContactListsDialog
        open={listsOpen}
        onClose={() => setListsOpen(false)}
        lists={people.lists}
        team={people.team}
        contacts={people.contacts}
        onSave={people.saveList}
        onDelete={people.deleteList}
      />
      <MailAccountDialog
        account={settings}
        onClose={() => setSettings(null)}
        onSave={mail.update}
        onSaveSignatures={mail.saveSignatures}
        onReconnect={account => mail.startOAuth(providerOf(account.provider).key)}
        onDisconnect={account => mail.disconnect(account.id)}
      />
      <AttachmentPreview
        target={preview}
        onClose={() => setPreview(null)}
        onNewEmail={target => {
          setPreview(null);
          setDraft({
            accountId: target.accountId,
            attach: {
              accountId: target.accountId,
              messageId: target.messageId,
              attachments: [target.attachment],
            },
          });
        }}
        onDownload={target =>
          void actions.download(
            { accountId: target.accountId, id: target.messageId } as MailSummary,
            target.attachment.id
          )
        }
      />
      <MailToTaskOrEvent value={conversion} onClose={() => setConversion(null)} />
      {connectDialog}
    </div>
  );
};

export default WebmailPage;
