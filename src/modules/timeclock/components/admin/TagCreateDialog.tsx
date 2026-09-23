import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { parseTagUrl } from '@/lib/nfc';
import {
  buildStaticTagUrl,
  timeClockLocationService,
} from '../../services/timeClockLocationService';
import { Ntag424RegisterFields } from './Ntag424RegisterFields';
import { TagUrlResult } from './TagUrlResult';

interface TagCreateDialogProps {
  locationId: string;
  locationName: string;
  onClose: () => void;
  onCreated: () => void;
}

type TagKind = 'static' | 'ntag424';

export const TagCreateDialog: React.FC<TagCreateDialogProps> = ({
  locationId,
  locationName,
  onClose,
  onCreated,
}) => {
  const { toast } = useToast();
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<TagKind>('static');
  const [scannedUrl, setScannedUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [staticUrl, setStaticUrl] = useState<string | null>(null);

  const submit = async () => {
    if (label.trim().length < 2) {
      toast({ title: 'Indique um nome para a tag', variant: 'destructive' });
      return;
    }
    const sun = parseTagUrl(scannedUrl);
    if (kind === 'ntag424' && (!sun?.e || !sun?.c)) {
      toast({ title: 'Leia a tag primeiro', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    const { data, error } =
      kind === 'static'
        ? await timeClockLocationService.createStaticTag(locationId, label.trim())
        : await timeClockLocationService.registerNtag424(
            locationId,
            label.trim(),
            sun?.e ?? '',
            sun?.c ?? ''
          );
    setIsSaving(false);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return;
    }
    onCreated();
    if (kind === 'static' && data?.token) {
      setStaticUrl(buildStaticTagUrl(data.token));
    } else {
      toast({ title: 'Tag NTAG 424 registada' });
      onClose();
    }
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova tag NFC</DialogTitle>
          <DialogDescription>{locationName}</DialogDescription>
        </DialogHeader>

        {staticUrl ? (
          <>
            <TagUrlResult url={staticUrl} />
            <DialogFooter>
              <Button onClick={onClose}>Concluído</Button>
            </DialogFooter>
          </>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="tag-label">Nome da tag *</Label>
              <Input
                id="tag-label"
                placeholder="Ex.: Receção - entrada"
                value={label}
                onChange={e => setLabel(e.target.value)}
              />
            </div>
            <RadioGroup
              value={kind}
              onValueChange={v => setKind(v as TagKind)}
              className="space-y-2"
            >
              <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer">
                <RadioGroupItem value="static" className="mt-1" />
                <span>
                  <span className="font-medium">Tag simples (NTAG213/215/216)</span>
                  <span className="block text-xs text-muted-foreground">
                    Barata e fácil de gravar. O link é fixo: pode ser copiado, por isso o GPS e os
                    alertas antifraude são a proteção principal.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer">
                <RadioGroupItem value="ntag424" className="mt-1" />
                <span>
                  <span className="font-medium">Tag segura (NTAG 424 DNA) — recomendada</span>
                  <span className="block text-xs text-muted-foreground">
                    Gera um código cifrado novo a cada toque: não pode ser clonada nem reutilizada.
                  </span>
                </span>
              </label>
            </RadioGroup>
            {kind === 'ntag424' && (
              <Ntag424RegisterFields scannedUrl={scannedUrl} onScannedUrlChange={setScannedUrl} />
            )}
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button onClick={submit} disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {kind === 'static' ? 'Criar e gerar link' : 'Registar tag'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
