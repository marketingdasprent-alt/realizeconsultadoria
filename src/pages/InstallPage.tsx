import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Download, Laptop, Monitor, Smartphone } from 'lucide-react';
import { useDeviceDetect } from '@/hooks/useDeviceDetect';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { isOtherSite, targetOrigin } from '@/lib/account-switch';
import { appKindFor, applyAppManifest, type AppKind } from '@/lib/app-manifest';
import { ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { InstallSteps } from '@/components/install/InstallSteps';
import { PLATFORM_LABELS, type InstallPlatform } from '@/lib/install-steps';
import { useRzTheme } from '@/modules/workspace/hooks/useRzTheme';

const APPS: Record<AppKind, { name: string; icon: string; what: string; login: string }> = {
  colaborador: {
    name: 'Realize',
    icon: '/pwa-192x192.png',
    what: 'Mensagens, ponto, férias, documentos e recibos.',
    login: ROUTES.EMPLOYEE.LOGIN,
  },
  admin: {
    name: 'Realize Admin',
    icon: '/admin-pwa-192x192.png',
    what: 'O painel de administração: colaboradores, pedidos, ponto e financeiro.',
    login: ROUTES.ADMIN.LOGIN,
  },
};

const PLATFORM_ICONS: Record<InstallPlatform, typeof Smartphone> = {
  android: Smartphone,
  ios: Smartphone,
  windows: Monitor,
  mac: Laptop,
};

/**
 * /instalar: instalar a app deste endereço (app. → Realize, admin. → Realize Admin) em qualquer
 * aparelho. Onde as duas estão no mesmo endereço (localhost) escolhe-se com ?app=admin.
 */
const InstallPage: React.FC = () => {
  useRzTheme();
  const [params] = useSearchParams();
  const asked = params.get('app');
  const site = { hostname: window.location.hostname, origin: window.location.origin };
  const sameSite = !isOtherSite('admin', site) && !isOtherSite('workspace', site);
  const kind: AppKind =
    sameSite && (asked === 'admin' || asked === 'colaborador')
      ? asked
      : appKindFor(ROUTES.PUBLIC.INSTALL, site.hostname);
  const otherKind: AppKind = kind === 'admin' ? 'colaborador' : 'admin';
  const app = APPS[kind];
  const other = APPS[otherKind];
  const otherUrl = sameSite
    ? `${ROUTES.PUBLIC.INSTALL}?app=${otherKind}`
    : `${targetOrigin(otherKind === 'admin' ? 'admin' : 'workspace', site)}${ROUTES.PUBLIC.INSTALL}`;
  // O browser instala o manifest da página: o desta app (no próprio endereço ganha sempre ele).
  useEffect(() => applyAppManifest(kind === 'admin' ? '/admin' : '/colaborador'), [kind]);

  const device = useDeviceDetect();
  const { canInstall, isInstalled, promptInstall } = usePWAInstall();
  const detected: InstallPlatform = device.isIOS
    ? 'ios'
    : device.isAndroid
      ? 'android'
      : /mac/i.test(navigator.userAgent)
        ? 'mac'
        : 'windows';
  const [platform, setPlatform] = useState<InstallPlatform>(detected);
  useEffect(() => setPlatform(detected), [detected]);

  return (
    <div className="min-h-screen bg-rz-aurora px-4 py-8 font-jakarta text-rz-ink sm:py-12">
      <div className="mx-auto w-full max-w-md space-y-4">
        <section className="rounded-[28px] bg-white p-5 text-center shadow-rz-soft sm:p-6">
          <img src={app.icon} alt="" className="mx-auto h-20 w-20 rounded-[22px] shadow-rz-soft" />
          <h1 className="mt-4 text-[22px] font-extrabold">Instalar {app.name}</h1>
          <p className="mt-1 text-[14px] text-rz-muted">{app.what}</p>
          {isInstalled ? (
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-[14px] font-semibold text-emerald-700">
              <CheckCircle2 className="h-5 w-5" /> Já está instalada neste aparelho
            </p>
          ) : (
            canInstall && (
              <button
                type="button"
                onClick={() => void promptInstall()}
                className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-rz-primary text-[15px] font-bold text-white shadow-rz-soft hover:bg-rz-primary/90"
              >
                <Download className="h-5 w-5" /> Instalar
              </button>
            )
          )}
        </section>

        {!isInstalled && (
          <section className="space-y-4 rounded-[28px] bg-white p-5 shadow-rz-soft sm:p-6">
            <div className="grid grid-cols-4 gap-1 rounded-2xl bg-rz-canvas p-1">
              {(Object.keys(PLATFORM_LABELS) as InstallPlatform[]).map(key => {
                const Icon = PLATFORM_ICONS[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPlatform(key)}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11.5px] font-semibold transition-colors',
                      platform === key ? 'bg-white text-rz-primary shadow-rz-soft' : 'text-rz-muted'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {PLATFORM_LABELS[key]}
                  </button>
                );
              })}
            </div>
            <InstallSteps
              platform={platform}
              appName={app.name}
              canInstall={canInstall && platform === detected}
              browser={device.browser}
            />
          </section>
        )}

        <section className="rounded-[28px] bg-white/10 p-4 text-[13px] text-white/80 ring-1 ring-white/15">
          Também é {kind === 'admin' ? 'colaborador' : 'administrador'}? Instale a{' '}
          <a href={otherUrl} className="font-semibold text-white underline underline-offset-2">
            {other.name}
          </a>{' '}
          — fica com um ícone para cada uma.
        </section>

        <Link
          to={app.login}
          className="block py-2 text-center text-[14px] font-semibold text-white/80 hover:text-white"
        >
          Continuar no browser
        </Link>
      </div>
    </div>
  );
};

export default InstallPage;
