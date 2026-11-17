import React from 'react';
import { ShieldCheck, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useCompanyViewers } from '../../hooks/useSharing';
import { viewerKindLabel, type CompanyViewer } from '../../lib/sharing';
import { QueryState } from './QueryState';

const Person: React.FC<{ viewer: CompanyViewer }> = ({ viewer }) => (
  // min-w-0: sem isto, um email comprido alargava o cartão para lá do ecrã (grelha e flex).
  // No telemóvel a etiqueta fica por baixo do nome; a partir de sm, ao lado.
  <li className="flex min-w-0 flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:gap-3">
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
        aria-hidden
      >
        {viewer.kind === 'super_admin' ? (
          <ShieldCheck className="h-5 w-5" />
        ) : (
          <UserRound className="h-5 w-5" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium" title={viewer.name}>
          {viewer.name}
        </p>
        <p className="truncate text-xs text-muted-foreground" title={viewer.email}>
          {viewer.email}
        </p>
      </div>
    </div>
    <Badge
      variant={viewer.kind === 'super_admin' ? 'default' : 'secondary'}
      className="self-start whitespace-nowrap sm:shrink-0 sm:self-center"
    >
      {viewerKindLabel(viewer.kind)}
    </Badge>
  </li>
);

/**
 * "Quem pode ver esta empresa": a transparência de quem tem poder sobre os dados dela. A equipa
 * da plataforma (Super Admin) vê todas as empresas, para gestão e suporte; cada abertura de outra
 * empresa fica registada. Só se mostram nomes e emails, nunca dados sensíveis.
 */
export const ViewersPanel: React.FC<{ company: string; name: string }> = ({ company, name }) => {
  const query = useCompanyViewers(company);
  const viewers = query.data ?? [];
  const platform = viewers.filter(viewer => viewer.kind === 'super_admin');
  const own = viewers.filter(viewer => viewer.kind !== 'super_admin');

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Estas são as pessoas que podem ver os dados de <strong>{name}</strong>. A equipa da
        plataforma vê todas as empresas, para gestão e suporte, e cada acesso fica registado.
      </p>
      <QueryState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={viewers.length === 0}
        emptyTitle="Não há ninguém para mostrar"
        emptyHint="Quando houver administradores ou gestores nesta empresa, aparecem aqui."
        onRetry={() => query.refetch()}
      >
        {own.length > 0 && (
          <section aria-labelledby="viewers-own" className="space-y-2">
            <h2 id="viewers-own" className="text-sm font-semibold">
              Na empresa
            </h2>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {own.map(viewer => (
                <Person key={viewer.user_id} viewer={viewer} />
              ))}
            </ul>
          </section>
        )}
        {platform.length > 0 && (
          <section aria-labelledby="viewers-platform" className="space-y-2">
            <h2 id="viewers-platform" className="text-sm font-semibold">
              Equipa da plataforma (todas as empresas)
            </h2>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {platform.map(viewer => (
                <Person key={viewer.user_id} viewer={viewer} />
              ))}
            </ul>
          </section>
        )}
      </QueryState>
    </div>
  );
};
