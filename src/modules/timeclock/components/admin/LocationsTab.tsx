import React, { useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCompanies } from '@/hooks/useCompanies';
import { useToast } from '@/hooks/use-toast';
import type { LocationSuggestion } from '@/lib/location-suggestions';
import type { TimeClockLocationInput } from '@/lib/schemas';
import { getErrorMessage } from '@/lib/timeclock';
import { useLocationSuggestions } from '../../hooks/useLocationSuggestions';
import { useTimeClockLocations } from '../../hooks/useTimeClockLocations';
import {
  timeClockLocationService,
  type TimeClockLocationWithTags,
} from '../../services/timeClockLocationService';
import { LocationCard } from './LocationCard';
import { LocationFormDialog } from './LocationFormDialog';
import { LocationSuggestionsCard } from './LocationSuggestionsCard';
import { TagCreateDialog } from './TagCreateDialog';

interface LocationsTabProps {
  canManage: boolean;
}

type DialogState =
  | {
      kind: 'location';
      location: TimeClockLocationWithTags | null;
      initial?: Partial<TimeClockLocationInput>;
    }
  | { kind: 'tag'; location: TimeClockLocationWithTags }
  | null;

export const LocationsTab: React.FC<LocationsTabProps> = ({ canManage }) => {
  const { toast } = useToast();
  const { companies } = useCompanies();
  const { locations, isLoading, error, refetch } = useTimeClockLocations();
  const suggestions = useLocationSuggestions(locations, canManage);
  const [dialog, setDialog] = useState<DialogState>(null);

  const fail = (err: unknown) => {
    toast({
      title: 'Erro',
      description: getErrorMessage(err, 'Operação falhou'),
      variant: 'destructive',
    });
  };

  const createFromSuggestion = (s: LocationSuggestion) =>
    setDialog({
      kind: 'location',
      location: null,
      initial: { company_id: s.companyId ?? '', latitude: s.lat, longitude: s.lng, radius_m: 50 },
    });

  const enlargeRadius = async (s: LocationSuggestion) => {
    if (!s.nearest || !s.suggestedRadiusM) return;
    const { error: updateError } = await timeClockLocationService.update(s.nearest.id, {
      radius_m: s.suggestedRadiusM,
    });
    if (updateError) {
      fail(updateError);
      return;
    }
    toast({ title: `Raio de ${s.nearest.name} aumentado para ${s.suggestedRadiusM} m` });
    refetch();
  };

  const handleDelete = async (location: TimeClockLocationWithTags) => {
    if (
      !window.confirm(`Eliminar o local "${location.name}" e as suas tags? Os registos mantêm-se.`)
    )
      return;
    const { error: deleteError } = await timeClockLocationService.delete(location.id);
    if (deleteError) {
      fail(deleteError);
      return;
    }
    toast({ title: 'Local eliminado' });
    refetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Cada local tem coordenadas e um raio. O colaborador só consegue registar ponto dentro do
          raio de um local ativo da sua empresa.
        </p>
        {canManage && (
          <Button onClick={() => setDialog({ kind: 'location', location: null })}>
            <Plus className="h-4 w-4 mr-2" /> Novo local
          </Button>
        )}
      </div>

      <LocationSuggestionsCard
        suggestions={suggestions.suggestions}
        canManage={canManage}
        onCreate={createFromSuggestion}
        onEnlarge={enlargeRadius}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : locations.length === 0 ? (
        <p className="text-center text-muted-foreground py-10">Ainda não há locais de ponto.</p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {locations.map(location => (
            <LocationCard
              key={location.id}
              location={location}
              canManage={canManage}
              onEdit={() => setDialog({ kind: 'location', location })}
              onDelete={() => handleDelete(location)}
              onAddTag={() => setDialog({ kind: 'tag', location })}
              onChanged={refetch}
            />
          ))}
        </div>
      )}

      {dialog?.kind === 'location' && (
        <LocationFormDialog
          location={dialog.location}
          initial={dialog.initial}
          companies={companies.map(c => ({ id: c.id, name: c.name }))}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            refetch();
          }}
        />
      )}
      {dialog?.kind === 'tag' && (
        <TagCreateDialog
          locationId={dialog.location.id}
          locationName={dialog.location.name}
          onClose={() => setDialog(null)}
          onCreated={refetch}
        />
      )}
    </div>
  );
};
