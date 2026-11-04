import React from 'react';
import type { AdminPermissions } from '@/hooks/useAdminPermissions';
import { useTimeClockReview } from '../../hooks/useTimeClockReview';
import { HistoryTab } from './HistoryTab';
import { LocationsTab } from './LocationsTab';
import { ReviewTab } from './ReviewTab';
import { TimesheetTab } from './TimesheetTab';
import { TodayTab } from './TodayTab';

interface TimeClockTeamTabsProps {
  tab: 'hoje' | 'folha' | 'revisao' | 'locais' | 'historico';
  permissions: AdminPermissions;
}

/** As partes de gestão do ponto (as mesmas do admin), dentro da página Ponto do Workspace. */
const TimeClockTeamTabs: React.FC<TimeClockTeamTabsProps> = ({ tab, permissions }) => {
  const review = useTimeClockReview(true);
  const canEdit = permissions.canExecuteTopic('timeclock', 'edit');
  const toReview = review.pending.length + review.flagged.length;

  return (
    <div className="space-y-4">
      {tab !== 'revisao' && toReview > 0 && (
        <p className="rounded-2xl bg-amber-50 px-4 py-2.5 text-[13px] font-semibold text-amber-900 ring-1 ring-amber-200">
          {toReview === 1 ? '1 registo' : `${toReview} registos`} à espera de revisão.
        </p>
      )}
      {tab === 'hoje' && <TodayTab />}
      {tab === 'folha' && <TimesheetTab canEdit={canEdit} />}
      {tab === 'revisao' && <ReviewTab canEdit={canEdit} review={review} />}
      {tab === 'locais' && (
        <LocationsTab canManage={permissions.canExecuteTopic('timeclock', 'locations')} />
      )}
      {tab === 'historico' && <HistoryTab />}
    </div>
  );
};

export default TimeClockTeamTabs;
