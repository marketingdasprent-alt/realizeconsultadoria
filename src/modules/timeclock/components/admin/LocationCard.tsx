import React from 'react';
import { ExternalLink, Nfc, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TimeClockLocationWithTags } from '../../services/timeClockLocationService';
import { TagList } from './TagList';

interface LocationCardProps {
  location: TimeClockLocationWithTags;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAddTag: () => void;
  onChanged: () => void;
}

export const LocationCard: React.FC<LocationCardProps> = ({
  location,
  canManage,
  onEdit,
  onDelete,
  onAddTag,
  onChanged,
}) => (
  <Card className={`shadow-card ${location.is_active ? '' : 'opacity-60'}`}>
    <CardHeader className="pb-2 flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
      <div>
        <CardTitle className="text-base lg:text-lg">{location.name}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {location.company?.name}
          {location.address && ` · ${location.address}`}
        </p>
      </div>
      {canManage && (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" title="Editar" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title="Eliminar" onClick={onDelete}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      )}
    </CardHeader>
    <CardContent className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        <a
          href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-primary underline"
        >
          {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}{' '}
          <ExternalLink className="h-3 w-3" />
        </a>
        <Badge variant="outline">Raio {location.radius_m} m</Badge>
        <Badge variant="outline">GPS ≤ {location.max_accuracy_m} m</Badge>
        <Badge variant={location.allow_manual ? 'secondary' : 'default'}>
          {location.allow_manual ? 'NFC ou GPS' : 'Só NFC'}
        </Badge>
        {location.block_vpn && <Badge variant="destructive">Bloqueia VPN</Badge>}
        {location.trusted_ips.length > 0 && (
          <Badge variant="outline">{location.trusted_ips.length} IP(s) da rede</Badge>
        )}
        {!location.is_active && <Badge variant="outline">Inativo</Badge>}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Tags NFC</span>
        {canManage && (
          <Button variant="outline" size="sm" onClick={onAddTag}>
            <Nfc className="h-4 w-4 mr-1" /> Nova tag
          </Button>
        )}
      </div>
      <TagList tags={location.tags} canManage={canManage} onChanged={onChanged} />
    </CardContent>
  </Card>
);
