import React, { useCallback, useState } from 'react';
import {
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
} from 'react-hook-form';
import { Crosshair, Loader2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { TimeClockLocationInput } from '@/lib/schemas';
import { COORDINATES_HOW_TO, useCoordinateResolver } from '../../hooks/useCoordinateResolver';
import { LocationMapPreview } from './LocationMapPreview';

interface LocationCoordinatesFieldProps {
  register: UseFormRegister<TimeClockLocationInput>;
  control: Control<TimeClockLocationInput>;
  errors: FieldErrors<TimeClockLocationInput>;
  setValue: UseFormSetValue<TimeClockLocationInput>;
}

/** Coordenadas do local a partir de um link do Google Maps, texto "lat, lng" ou GPS. */
export const LocationCoordinatesField: React.FC<LocationCoordinatesFieldProps> = ({
  register,
  control,
  errors,
  setValue,
}) => {
  const [mapsInput, setMapsInput] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const [lat, lng] = useWatch({ control, name: ['latitude', 'longitude'] });

  const apply = useCallback(
    (coords: { lat: number; lng: number }, message: string | null) => {
      const options = { shouldValidate: true, shouldDirty: true };
      setValue('latitude', Number(coords.lat.toFixed(7)), options);
      setValue('longitude', Number(coords.lng.toFixed(7)), options);
      setHint(message);
    },
    [setValue]
  );
  const { busy, resolveInput, resolveCurrentPosition } = useCoordinateResolver(apply);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

  return (
    <div className="space-y-2 rounded-md border p-3">
      <Label htmlFor="loc-maps">Localização *</Label>
      <div className="flex gap-2">
        <Input
          id="loc-maps"
          placeholder="Cole o link do Google Maps ou as coordenadas"
          value={mapsInput}
          onChange={e => setMapsInput(e.target.value)}
          onPaste={e => resolveInput(e.clipboardData.getData('text'))}
          onKeyDown={e => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            resolveInput(mapsInput);
          }}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => resolveInput(mapsInput)}
          disabled={busy !== null}
        >
          {busy === 'link' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MapPin className="h-4 w-4" />
          )}
          <span className="ml-1 hidden sm:inline">Obter</span>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Google Maps → escolha o local → <strong>Partilhar → Copiar link</strong>.{' '}
        {COORDINATES_HOW_TO}
      </p>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="px-0"
        onClick={resolveCurrentPosition}
        disabled={busy !== null}
      >
        {busy === 'gps' ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Crosshair className="h-4 w-4 mr-2" />
        )}
        Ou usar a minha localização atual (estando no local)
      </Button>
      {hint && <p className="text-xs text-amber-700 dark:text-amber-400">{hint}</p>}

      <div className="grid grid-cols-2 gap-2">
        <Input
          aria-label="Latitude"
          placeholder="Latitude"
          type="number"
          step="any"
          className="h-8 text-xs"
          {...register('latitude', { valueAsNumber: true })}
        />
        <Input
          aria-label="Longitude"
          placeholder="Longitude"
          type="number"
          step="any"
          className="h-8 text-xs"
          {...register('longitude', { valueAsNumber: true })}
        />
      </div>
      {(errors.latitude || errors.longitude) && (
        <p className="text-xs text-destructive">Indique a localização do local.</p>
      )}
      {hasCoords && <LocationMapPreview lat={lat as number} lng={lng as number} />}
    </div>
  );
};
