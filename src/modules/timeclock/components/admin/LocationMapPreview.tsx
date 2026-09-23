import React from 'react';
import { ExternalLink } from 'lucide-react';

interface LocationMapPreviewProps {
  lat: number;
  lng: number;
}

/** Mapa com o pino do local, para confirmar visualmente as coordenadas. */
export const LocationMapPreview: React.FC<LocationMapPreviewProps> = ({ lat, lng }) => {
  const query = `${lat},${lng}`;
  return (
    <div className="space-y-1">
      <iframe
        title="Pré-visualização do local"
        className="h-48 w-full rounded-md border"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        src={`https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=18&output=embed`}
      />
      <a
        href={`https://www.google.com/maps?q=${encodeURIComponent(query)}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs text-primary underline"
      >
        Confirme que o pino está na entrada do local · abrir no Google Maps
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
};
