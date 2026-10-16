import React, { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useOptionalMessenger } from '@/modules/messenger/context/useMessengerApi';
import { AppreciationsCard } from '@/modules/workspace/components/profile/AppreciationsCard';
import { ProfileHeader } from '@/modules/workspace/components/profile/ProfileHeader';
import { ProfileInfoCard } from '@/modules/workspace/components/profile/ProfileInfoCard';
import { WorkspacePage } from '@/modules/workspace/components/WorkspacePage';
import { useWorkspace, type WorkspaceUser } from '@/modules/workspace/context/workspaceContext';
import { SendAppreciationDialog } from '../components/SendAppreciationDialog';
import { useAppreciations } from '../hooks/useAppreciations';
import { useDirectory } from '../hooks/useDirectory';
import { useOpenChat } from '../hooks/useOpenChat';

/** Perfil de um colega: dados profissionais, apreciações, mensagem e apreciar. */
const ColleagueProfilePage: React.FC = () => {
  const { userId = '' } = useParams();
  const { basePath, user } = useWorkspace();
  const { byId, isLoading } = useDirectory();
  const messenger = useOptionalMessenger();
  const openChat = useOpenChat();
  const appreciations = useAppreciations({ userId });
  const [isAppreciating, setIsAppreciating] = useState(false);
  const person = byId.get(userId);

  if (userId === user.userId) return <Navigate to={`${basePath}/perfil`} replace />;
  if (isLoading) {
    return <Loader2 className="mx-auto mt-16 h-7 w-7 animate-spin text-rz-primary" />;
  }
  if (!person) {
    return (
      <WorkspacePage width="narrow">
        <p className="rounded-[28px] bg-white p-10 text-center text-rz-muted ring-1 ring-rz-line">
          Este colaborador não existe ou já não faz parte da empresa.
        </p>
      </WorkspacePage>
    );
  }

  // Só contactos da empresa (o diretório não traz email/telefone pessoais nem dados de RH).
  const profile: WorkspaceUser = {
    userId: person.userId,
    employeeId: person.employeeId,
    companyId: user.companyId,
    name: person.name,
    email: person.email ?? '',
    position: person.position,
    department: person.department,
    companyName: user.companyName,
    phone: person.phone ?? null,
    hireDate: null,
  };

  return (
    <WorkspacePage>
      <Link
        to={`${basePath}/pessoas`}
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-rz-muted hover:text-rz-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Colaboradores
      </Link>
      <ProfileHeader
        user={profile}
        isOwn={false}
        isOnline={messenger?.isOnline(person.userId) ?? false}
        onMessage={() => openChat(person.userId)}
        onAppreciate={() => setIsAppreciating(true)}
      />
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_380px]">
        <ProfileInfoCard user={profile} isOwn={false} />
        <AppreciationsCard received={appreciations.received} isOwn={false} />
      </div>
      <SendAppreciationDialog
        open={isAppreciating}
        onOpenChange={setIsAppreciating}
        recipientId={person.userId}
        onSend={appreciations.send}
      />
    </WorkspacePage>
  );
};

export default ColleagueProfilePage;
