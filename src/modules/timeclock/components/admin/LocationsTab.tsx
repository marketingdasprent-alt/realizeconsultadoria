import React, { useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCompanies } from '@/hooks/useCompanies';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/timeclock';
import { useTimeClockLocations } from '../../hooks/useTimeClockLocations';
import {
  timeClockLocationService,
  type TimeClockLocationWithTags,
} from '../../services/timeClockLocationService';
import { LocationCard } from './LocationCard';
import { LocationFormDialog } from './LocationFormDialog';
import { TagCreateDialog } from './TagCreateDialog';

interface LocationsTabProps {
  canManage: boolean;
}

type DialogState =
  | { kind: 'location'; location: TimeClockLocationWithTags | null }
  | { kind: 'tag'; location: TimeClockLocationWithTags }
  | null;

export const LocationsTab: React.FC<LocationsTabProps> = ({ canManage }) => {
  const { toast } = useToast();
  const { companies } = useCompanies();
  const { locations, isLoading, error, refetch } = useTimeClockLocations();
  const [dialog, setDialog] = useState<DialogState>(null);

  const handleDelete = async (location: TimeClockLocationWithTags) => {
    if (
      !window.confirm(`Eliminar o local "${location.name}" e as suas tags? Os registos mantêm-se.`)
    )
      return;
    const { error: deleteError } = await timeClockLocationService.delete(location.id);
    if (deleteError) {
      toast({
        title: 'Erro',
        description: getErrorMessage(deleteError, 'Operação falhou'),
        variant: 'destructive',
      });
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
