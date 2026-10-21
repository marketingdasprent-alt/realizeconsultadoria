import React from 'react';
import { cn } from '@/lib/utils';
import { installStepsFor, type InstallPlatform } from '@/lib/install-steps';

interface InstallStepsProps {
  platform: InstallPlatform;
  appName: string;
  /** O browser deixa instalar com o botão (não é preciso seguir os passos). */
  canInstall: boolean;
  browser: string;
}

/** Passos para instalar à mão em cada sistema (quando não há o botão "Instalar"). */
export const InstallSteps: React.FC<InstallStepsProps> = ({
  platform,
  appName,
  canInstall,
  browser,
}) => {
  const { steps, note } = installStepsFor(platform, appName, browser);
  return (
    <div className="space-y-3">
      {canInstall && (
        <p className="rounded-2xl bg-rz-primary-soft px-3 py-2 text-[13px] font-medium text-rz-primary">
          Neste browser basta o botão “Instalar” acima. Os passos ficam aqui se preferir.
        </p>
      )}
      <ol className="space-y-2.5">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-3">
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold',
                'bg-rz-primary text-white'
              )}
            >
              {index + 1}
            </span>
            <span className="pt-0.5 text-[14px] leading-snug text-rz-ink">{step}</span>
          </li>
        ))}
      </ol>
      {note && <p className="px-1 text-[12.5px] text-rz-muted">{note}</p>}
    </div>
  );
};
