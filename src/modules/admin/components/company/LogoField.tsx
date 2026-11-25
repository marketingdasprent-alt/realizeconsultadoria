import React, { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { CompanyLogo } from '@/components/admin/CompanyLogo';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { LOGO_ACCEPTED_TYPES, logoErrorText, prepareLogo } from '@/lib/logoImage';
import { companyLogoService } from '../../services/companyLogoService';

const RETRY_TEXT = 'Tente outra vez dentro de instantes.';

/** A mensagem do servidor quando existe (os erros do Supabase são objetos simples). */
const serverMessage = (error: unknown): string => {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === 'string' && message.trim() ? message.trim() : RETRY_TEXT;
};

interface LogoFieldProps {
  company: { id: string; name: string; logo_path: string | null };
  /** Chamado com o caminho novo, ou null quando a logo foi retirada. */
  onChanged: (logoPath: string | null) => void;
}

/**
 * Escolher, trocar e retirar a logo da empresa. Grava logo ao escolher (não espera pelo botão Guardar
 * do formulário): a imagem é reduzida no navegador antes de ser enviada.
 */
export const LogoField: React.FC<LogoFieldProps> = ({ company, onChanged }) => {
  const { toast } = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const hasLogo = !!company.logo_path;

  const fail = (description: string) =>
    toast({ title: 'Não foi possível guardar a logo', description, variant: 'destructive' });

  const choose = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || busy) return;
    setBusy(true);
    try {
      const logo = await prepareLogo(file);
      const { data, error } = await companyLogoService.upload(company.id, logo, company.logo_path);
      if (error || !data) return fail(serverMessage(error));
      onChanged(data);
      toast({ title: 'Logo atualizada' });
    } catch (error) {
      fail(logoErrorText(error));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!company.logo_path || busy) return;
    setBusy(true);
    try {
      const { error } = await companyLogoService.remove(company.id, company.logo_path);
      if (error) return fail(serverMessage(error));
      onChanged(null);
      toast({ title: 'Logo retirada' });
    } catch (error) {
      fail(serverMessage(error));
    } finally {
      // Nunca deixa o botão ocupado nem o diálogo preso
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <CompanyLogo name={company.name} logoPath={company.logo_path} size="lg" />
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <ImagePlus className="mr-2 h-4 w-4" aria-hidden />
            )}
            {hasLogo ? 'Trocar logo' : 'Carregar logo'}
          </Button>
          {hasLogo && (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => setConfirming(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" aria-hidden /> Retirar
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">PNG, JPG, WebP ou SVG, até 5 MB.</p>
        <input
          ref={input}
          type="file"
          accept={LOGO_ACCEPTED_TYPES.join(',')}
          className="sr-only"
          tabIndex={-1}
          aria-label="Ficheiro da logo"
          onChange={choose}
        />
      </div>
      <AlertDialog open={confirming} onOpenChange={next => !busy && setConfirming(next)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Retirar a logo?</AlertDialogTitle>
            <AlertDialogDescription>
              A empresa passa a mostrar as iniciais. Pode carregar outra logo quando quiser.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={event => {
                event.preventDefault();
                void remove();
              }}
            >
              Retirar logo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
