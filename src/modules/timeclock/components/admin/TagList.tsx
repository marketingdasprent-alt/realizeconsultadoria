import React, { useState } from 'react';
import { format } from 'date-fns';
import { KeyRound, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage, type TimeClockTag } from '@/lib/timeclock';
import {
  buildStaticTagUrl,
  timeClockLocationService,
} from '../../services/timeClockLocationService';
import { TagUrlResult } from './TagUrlResult';

interface TagListProps {
  tags: TimeClockTag[];
  canManage: boolean;
  onChanged: () => void;
}

export const TagList: React.FC<TagListProps> = ({ tags, canManage, onChanged }) => {
  const { toast } = useToast();
  const [rotatedUrl, setRotatedUrl] = useState<string | null>(null);

  const run = async (action: Promise<{ success?: boolean; error: unknown }>, done: string) => {
    const { error } = await action;
    if (error) {
      toast({
        title: 'Erro',
        description: getErrorMessage(error, 'Operação falhou'),
        variant: 'destructive',
      });
      return;
    }
    toast({ title: done });
    onChanged();
  };

  const rotate = async (tag: TimeClockTag) => {
    if (
      !window.confirm(`Gerar novo link para "${tag.label}"? A gravação atual deixa de funcionar.`)
    )
      return;
    const { data, error } = await timeClockLocationService.rotateStaticTag(tag.id);
    if (error || !data?.token) {
      toast({
        title: 'Erro',
        description: error?.message ?? 'Operação falhou',
        variant: 'destructive',
      });
      return;
    }
    setRotatedUrl(buildStaticTagUrl(data.token));
  };

  const remove = (tag: TimeClockTag) => {
    if (!window.confirm(`Eliminar a tag "${tag.label}"? Os registos antigos mantêm-se.`)) return;
    run(timeClockLocationService.deleteTag(tag.id), 'Tag eliminada');
  };

  if (tags.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem tags neste local.</p>;
  }

  return (
    <>
      <ul className="divide-y divide-border rounded-md border">
        {tags.map(tag => (
          <li key={tag.id} className="flex flex-wrap items-center gap-2 p-2 text-sm">
            <span className="font-medium">{tag.label}</span>
            <Badge variant={tag.tag_type === 'ntag424' ? 'default' : 'secondary'}>
              {tag.tag_type === 'ntag424' ? 'NTAG 424 DNA' : 'Simples'}
            </Badge>
            {tag.uid && <code className="text-xs text-muted-foreground">{tag.uid}</code>}
            <span className="text-xs text-muted-foreground">
              {tag.last_used_at
                ? `Último uso ${format(new Date(tag.last_used_at), 'dd/MM HH:mm')}`
                : 'Nunca usada'}
            </span>
            {canManage && (
              <div className="ml-auto flex items-center gap-1">
                <Switch
                  checked={tag.is_active}
                  aria-label="Tag ativa"
                  onCheckedChange={checked =>
                    run(
                      timeClockLocationService.updateTag(tag.id, { is_active: checked }),
                      checked ? 'Tag ativada' : 'Tag desativada'
                    )
                  }
                />
                {tag.tag_type === 'static' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Gerar novo link"
                    onClick={() => rotate(tag)}
                  >
                    <KeyRound className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" title="Eliminar" onClick={() => remove(tag)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {rotatedUrl && (
        <Dialog open onOpenChange={open => !open && setRotatedUrl(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Novo link da tag</DialogTitle>
            </DialogHeader>
            <TagUrlResult url={rotatedUrl} />
            <DialogFooter>
              <Button onClick={() => setRotatedUrl(null)}>Concluído</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
