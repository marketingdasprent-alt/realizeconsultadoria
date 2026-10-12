import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';
import { ExternalLink, Loader2, MapPinPlus, Maximize2, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { LocationSuggestion } from '@/lib/location-suggestions';
import { formatDistance } from '@/lib/timeclock';

interface LocationSuggestionsCardProps {
  suggestions: LocationSuggestion[];
  canManage: boolean;
  onCreate: (suggestion: LocationSuggestion) => void;
  onEnlarge: (suggestion: LocationSuggestion) => Promise<void>;
}

const mapsUrl = (s: LocationSuggestion) => `https://www.google.com/maps?q=${s.lat},${s.lng}`;

const peopleLabel = (people: string[]) => {
  const first = people.map(p => p.split(' ')[0]);
  return first.length <= 3
    ? first.join(', ')
    : `${first.slice(0, 3).join(', ')} e mais ${first.length - 3}`;
};

/** Sítios onde as picagens falham repetidamente, com a correção a um clique. */
export const LocationSuggestionsCard: React.FC<LocationSuggestionsCardProps> = ({
  suggestions,
  canManage,
  onCreate,
  onEnlarge,
}) => {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  if (suggestions.length === 0) return null;

  const enlarge = async (s: LocationSuggestion, key: string) => {
    setBusyKey(key);
    await onEnlarge(s);
    setBusyKey(null);
  };

  return (
    <Card className="border-amber-300 bg-amber-50/60 shadow-card dark:bg-amber-900/10">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TriangleAlert className="h-5 w-5 text-amber-600" /> Locais em falta ({suggestions.length}
          )
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Sítios onde várias picagens foram recusadas por estarem fora de qualquer local nos últimos
          30 dias. Quase sempre é um local de trabalho por configurar ou um raio demasiado pequeno.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {suggestions.map(s => {
          const key = `${s.lat},${s.lng}`;
          return (
            <div
              key={key}
              className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3 sm:flex-row sm:items-center"
            >
              <div className="flex-1 space-y-1 text-sm">
                <p className="font-medium">
                  {s.kind === 'radius' && s.nearest
                    ? `Mesmo ao lado de ${s.nearest.name} (a ${formatDistance(s.nearest.distanceM)}, raio de ${s.nearest.radiusM} m)`
                    : s.nearest
                      ? `Sítio sem local: a ${formatDistance(s.nearest.distanceM)} de ${s.nearest.name}`
                      : 'Sítio sem local configurado'}
                </p>
                <p className="text-muted-foreground">
                  {s.people.length} {s.people.length === 1 ? 'pessoa' : 'pessoas'} (
                  {peopleLabel(s.people)}) · {s.attempts} tentativas · última{' '}
                  {formatDistanceToNow(new Date(s.lastAt), { addSuffix: true, locale: pt })}
                </p>
                <a
                  href={mapsUrl(s)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary underline"
                >
                  Ver no mapa <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              {canManage &&
                (s.kind === 'radius' && s.suggestedRadiusM ? (
                  <Button
                    variant="outline"
                    disabled={busyKey === key}
                    onClick={() => enlarge(s, key)}
                  >
                    {busyKey === key ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Maximize2 className="h-4 w-4 mr-2" />
                    )}
                    Aumentar raio para {s.suggestedRadiusM} m
                  </Button>
                ) : (
                  <Button onClick={() => onCreate(s)}>
                    <MapPinPlus className="h-4 w-4 mr-2" /> Criar local aqui
                  </Button>
                ))}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
