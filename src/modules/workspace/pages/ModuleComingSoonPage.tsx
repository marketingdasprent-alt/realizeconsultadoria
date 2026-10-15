import React from 'react';
import { Check, Hammer } from 'lucide-react';
import { ModuleIcon } from '../components/ModuleIcon';
import { WorkspacePage } from '../components/WorkspacePage';
import { getModule, type ModuleKey } from '../lib/navigation';

interface ModuleComingSoonPageProps {
  moduleKey: ModuleKey;
}

/** Módulo planeado mas ainda por construir: o que vai trazer e em que fase. */
const ModuleComingSoonPage: React.FC<ModuleComingSoonPageProps> = ({ moduleKey }) => {
  const module = getModule(moduleKey);
  return (
    <WorkspacePage width="narrow">
      <div className="relative overflow-hidden rounded-[32px] bg-white p-6 shadow-rz-soft ring-1 ring-rz-line md:p-10">
        <div
          className={`pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br opacity-20 blur-3xl ${module.tint}`}
          aria-hidden
        />
        <ModuleIcon module={module} size="xl" />
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-extrabold">{module.label}</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
            <Hammer className="h-3.5 w-3.5" /> Em construção
            {module.phase !== undefined && ` · Fase ${module.phase}`}
          </span>
        </div>
        <p className="mt-2 max-w-xl text-[15px] text-rz-muted">{module.description}</p>

        {module.planned && module.planned.length > 0 && (
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {module.planned.map(item => (
              <li
                key={item}
                className="flex items-start gap-3 rounded-2xl bg-rz-canvas p-4 text-[14px] font-medium"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-rz-primary shadow-sm">
                  <Check className="h-3.5 w-3.5 stroke-[3]" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>
    </WorkspacePage>
  );
};

export default ModuleComingSoonPage;
