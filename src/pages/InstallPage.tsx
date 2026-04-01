import { useNavigate } from "react-router-dom";
import { useDeviceDetect } from "@/hooks/useDeviceDetect";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Smartphone, 
  Share, 
  PlusSquare, 
  MoreVertical, 
  Download,
  CheckCircle2,
  ArrowRight,
  Monitor,
  Apple
} from "lucide-react";
import logoRealize from "@/assets/logo-realize.png";

const InstallPage = () => {
  const navigate = useNavigate();
  const device = useDeviceDetect();
  const { canInstall, isInstalled, promptInstall } = usePWAInstall();

  const handleInstallClick = async () => {
    if (canInstall) {
      const success = await promptInstall();
      if (success) {
        // Redirect to login after successful install
        setTimeout(() => navigate("/colaborador/login"), 1000);
      }
    }
  };

  if (isInstalled) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4">
              <img src={logoRealize} alt="Realize" className="h-12 mx-auto" />
            </div>
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-xl">App Instalada!</CardTitle>
            <CardDescription>
              A aplicação Realize já está instalada no seu dispositivo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/colaborador/login")} className="w-full">
              Ir para Login
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <img src={logoRealize} alt="Realize" className="h-12 mx-auto" />
          </div>
          <CardTitle className="text-xl">Instalar Aplicação</CardTitle>
          <CardDescription>
            Instale a app Realize para acesso rápido ao portal de colaborador
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Device-specific instructions */}
          {device.isIOS && <IOSInstructions browser={device.browser} />}
          {device.isAndroid && (
            <AndroidInstructions 
              browser={device.browser} 
              canInstall={canInstall}
              onInstall={handleInstallClick}
            />
          )}
          {device.isDesktop && (
            <DesktopInstructions 
              browser={device.browser}
              canInstall={canInstall}
              onInstall={handleInstallClick}
            />
          )}

          {/* Benefits */}
          <div className="pt-4 border-t">
            <p className="text-sm font-medium text-muted-foreground mb-3">Vantagens:</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Acesso rápido a partir do ecrã inicial
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Experiência em ecrã completo
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Funciona mesmo offline
              </li>
            </ul>
          </div>

          {/* Go to login button */}
          <Button 
            variant="outline" 
            onClick={() => navigate("/colaborador/login")} 
            className="w-full"
          >
            Continuar para Login
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

interface InstructionsProps {
  browser: string;
  canInstall?: boolean;
  onInstall?: () => void;
}

const IOSInstructions = ({ browser }: { browser: string }) => (
  <div className="space-y-4">
    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
      <Apple className="h-8 w-8 text-primary" />
      <div>
        <p className="font-medium">iPhone / iPad</p>
        <p className="text-sm text-muted-foreground">
          {browser === 'safari' ? 'Safari detectado' : 'Use o Safari para melhor experiência'}
        </p>
      </div>
    </div>

    {browser !== 'safari' && (
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
        <strong>Nota:</strong> Para instalar no iOS, abra este site no Safari.
      </div>
    )}

    <div className="space-y-3">
      <p className="font-medium text-sm">Passos para instalar:</p>
      
      <div className="flex items-start gap-3 p-3 border rounded-lg">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
          1
        </div>
        <div className="flex-1">
          <p className="font-medium">Toque em Partilhar</p>
          <p className="text-sm text-muted-foreground">
            Toque no ícone <Share className="inline h-4 w-4" /> na barra inferior
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3 p-3 border rounded-lg">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
          2
        </div>
        <div className="flex-1">
          <p className="font-medium">Adicionar ao Ecrã Principal</p>
          <p className="text-sm text-muted-foreground">
            Deslize para baixo e toque em <PlusSquare className="inline h-4 w-4" /> "Adicionar ao Ecrã Principal"
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3 p-3 border rounded-lg">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
          3
        </div>
        <div className="flex-1">
          <p className="font-medium">Confirmar</p>
          <p className="text-sm text-muted-foreground">
            Toque em "Adicionar" no canto superior direito
          </p>
        </div>
      </div>
    </div>
  </div>
);

const AndroidInstructions = ({ browser, canInstall, onInstall }: InstructionsProps) => (
  <div className="space-y-4">
    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
      <Smartphone className="h-8 w-8 text-primary" />
      <div>
        <p className="font-medium">Android</p>
        <p className="text-sm text-muted-foreground">
          {browser === 'chrome' ? 'Chrome detectado' : 
           browser === 'samsung' ? 'Samsung Internet detectado' : 
           'Browser detectado'}
        </p>
      </div>
    </div>

    {canInstall && (
      <Button onClick={onInstall} className="w-full" size="lg">
        <Download className="mr-2 h-5 w-5" />
        Instalar Aplicação
      </Button>
    )}

    {!canInstall && (
      <div className="space-y-3">
        <p className="font-medium text-sm">Passos para instalar:</p>
        
        <div className="flex items-start gap-3 p-3 border rounded-lg">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
            1
          </div>
          <div className="flex-1">
            <p className="font-medium">Abrir Menu</p>
            <p className="text-sm text-muted-foreground">
              Toque no ícone <MoreVertical className="inline h-4 w-4" /> no canto superior direito
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3 border rounded-lg">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
            2
          </div>
          <div className="flex-1">
            <p className="font-medium">Instalar aplicação</p>
            <p className="text-sm text-muted-foreground">
              Toque em "Instalar aplicação" ou "Adicionar ao ecrã inicial"
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3 border rounded-lg">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
            3
          </div>
          <div className="flex-1">
            <p className="font-medium">Confirmar</p>
            <p className="text-sm text-muted-foreground">
              Toque em "Instalar" para confirmar
            </p>
          </div>
        </div>
      </div>
    )}
  </div>
);

const DesktopInstructions = ({ browser, canInstall, onInstall }: InstructionsProps) => (
  <div className="space-y-4">
    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
      <Monitor className="h-8 w-8 text-primary" />
      <div>
        <p className="font-medium">Computador</p>
        <p className="text-sm text-muted-foreground">
          {browser === 'chrome' ? 'Chrome detectado' : 
           browser === 'edge' ? 'Edge detectado' :
           browser === 'firefox' ? 'Firefox detectado' :
           'Browser detectado'}
        </p>
      </div>
    </div>

    {canInstall && (
      <Button onClick={onInstall} className="w-full" size="lg">
        <Download className="mr-2 h-5 w-5" />
        Instalar Aplicação
      </Button>
    )}

    {!canInstall && (
      <div className="space-y-3">
        <p className="font-medium text-sm">Passos para instalar:</p>
        
        {(browser === 'chrome' || browser === 'edge') && (
          <>
            <div className="flex items-start gap-3 p-3 border rounded-lg">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                1
              </div>
              <div className="flex-1">
                <p className="font-medium">Procure o ícone de instalação</p>
                <p className="text-sm text-muted-foreground">
                  Na barra de endereço, procure o ícone <Download className="inline h-4 w-4" /> ou <PlusSquare className="inline h-4 w-4" />
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 border rounded-lg">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                2
              </div>
              <div className="flex-1">
                <p className="font-medium">Clique para instalar</p>
                <p className="text-sm text-muted-foreground">
                  Clique no ícone e depois em "Instalar"
                </p>
              </div>
            </div>
          </>
        )}

        {browser === 'firefox' && (
          <div className="p-3 bg-muted rounded-lg text-sm">
            <p>O Firefox não suporta instalação de PWAs diretamente.</p>
            <p className="mt-2 text-muted-foreground">
              Recomendamos usar Chrome ou Edge para instalar a aplicação.
            </p>
          </div>
        )}

        {browser === 'safari' && (
          <div className="p-3 bg-muted rounded-lg text-sm">
            <p>O Safari no Mac ainda não suporta PWAs completamente.</p>
            <p className="mt-2 text-muted-foreground">
              Recomendamos usar Chrome para instalar a aplicação.
            </p>
          </div>
        )}
      </div>
    )}
  </div>
);

export default InstallPage;
