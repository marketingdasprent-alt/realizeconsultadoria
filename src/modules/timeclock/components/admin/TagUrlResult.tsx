import React, { useRef, useState } from 'react';
import { Check, Copy, Loader2, Nfc } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { isWebNfcSupported, writeUrlToTag } from '@/lib/nfc';

interface TagUrlResultProps {
  url: string;
}

/** Mostra o URL a gravar na tag (uma única vez) e permite gravá-lo por Web NFC. */
export const TagUrlResult: React.FC<TagUrlResultProps> = ({ url }) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [isWriting, setIsWriting] = useState(false);
  const controller = useRef<AbortController | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      toast({ title: 'Não foi possível copiar', variant: 'destructive' });
    }
  };

  const write = async () => {
    controller.current = new AbortController();
    setIsWriting(true);
    try {
      await writeUrlToTag(url, controller.current.signal);
      toast({ title: 'Tag gravada', description: 'Teste encostando um telemóvel à tag.' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao gravar';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
    } finally {
      setIsWriting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:bg-amber-900/20">
        Grave agora este link na tag. Por segurança <strong>não volta a ser mostrado</strong> — se o
        perder, gere um novo token.
      </div>
      <code className="block break-all rounded-md bg-muted p-3 text-xs">{url}</code>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="button" variant="outline" onClick={copy}>
          {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
          {copied ? 'Copiado' : 'Copiar link'}
        </Button>
        {isWebNfcSupported() ? (
          isWriting ? (
            <Button type="button" variant="gold" onClick={() => controller.current?.abort()}>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Encoste a tag... (cancelar)
            </Button>
          ) : (
            <Button type="button" variant="gold" onClick={write}>
              <Nfc className="h-4 w-4 mr-2" /> Gravar na tag agora
            </Button>
          )
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {isWebNfcSupported()
          ? 'Use tags NTAG213/215/216. Depois de gravar, pode bloquear a tag (só leitura) com a app "NFC Tools" para ninguém a reescrever.'
          : 'Este dispositivo não grava NFC pelo browser. Abra o painel num Android com Chrome, ou use a app "NFC Tools" → Escrever → URL, e cole o link. Depois bloqueie a tag (só leitura).'}
      </p>
    </div>
  );
};
