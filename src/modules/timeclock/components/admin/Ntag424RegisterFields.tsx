import React, { useRef, useState } from 'react';
import { Loader2, Nfc } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { isWebNfcSupported, parseTagUrl, scanTimeClockTag } from '@/lib/nfc';
import { buildNtag424TemplateUrl } from '../../services/timeClockLocationService';

interface Ntag424RegisterFieldsProps {
  scannedUrl: string;
  onScannedUrlChange: (url: string) => void;
}

/** Leitura (Web NFC) ou colagem do URL gerado por uma NTAG 424 DNA já programada. */
export const Ntag424RegisterFields: React.FC<Ntag424RegisterFieldsProps> = ({
  scannedUrl,
  onScannedUrlChange,
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const parsed = scannedUrl ? parseTagUrl(scannedUrl) : null;

  const scan = async () => {
    setError(null);
    controller.current = new AbortController();
    setIsScanning(true);
    try {
      const result = await scanTimeClockTag(controller.current.signal);
      controller.current.abort();
      onScannedUrlChange(result.url);
    } catch (err: unknown) {
      if (!controller.current?.signal.aborted)
        setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-md bg-muted p-3 text-xs space-y-1">
        <p>
          Programe a tag (NXP TagXplorer / TagWriter) com a chave AES do servidor (
          <code>NTAG424_SDM_KEY</code>), SDM ativo com espelho de UID + contador cifrados em{' '}
          <code>e</code> e CMAC em <code>c</code>, neste URL:
        </p>
        <code className="block break-all">{buildNtag424TemplateUrl()}</code>
      </div>
      {isWebNfcSupported() && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={scan}
          disabled={isScanning}
        >
          {isScanning ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Nfc className="h-4 w-4 mr-2" />
          )}
          {isScanning ? 'Encoste a tag...' : 'Ler a tag agora'}
        </Button>
      )}
      <div className="space-y-1">
        <Label htmlFor="ntag-url">URL lido da tag</Label>
        <Textarea
          id="ntag-url"
          rows={2}
          placeholder="https://…/ponto/nfc?e=…&c=…"
          value={scannedUrl}
          onChange={e => onScannedUrlChange(e.target.value)}
        />
        {scannedUrl && !parsed?.e && (
          <p className="text-xs text-destructive">O URL não contém os parâmetros e= e c=.</p>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
};
