import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Smartphone, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDeviceDetect } from "@/hooks/useDeviceDetect";
import { usePWAInstall } from "@/hooks/usePWAInstall";

const STORAGE_KEY = "pwa-banner-dismissed";
const DISMISS_DURATION_DAYS = 7;

export const PWAInstallBanner = () => {
  const navigate = useNavigate();
  const device = useDeviceDetect();
  const { isInstalled } = usePWAInstall();
  
  const [dismissed, setDismissed] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const date = new Date(stored);
      const daysPassed = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
      return daysPassed < DISMISS_DURATION_DAYS;
    }
    return false;
  });

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    setDismissed(true);
  };

  // Don't show if already installed or dismissed
  if (isInstalled || dismissed) return null;

  return (
    <div className="bg-gradient-to-r from-gold/10 to-gold/5 border border-gold/20 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gold/10 rounded-lg">
            {device.isMobile ? (
              <Smartphone className="h-5 w-5 text-gold" />
            ) : (
              <Download className="h-5 w-5 text-gold" />
            )}
          </div>
          <div>
            <p className="font-medium text-sm">
              {device.isMobile 
                ? "Instale a app para acesso rápido!" 
                : "Instale a app no seu computador"}
            </p>
            <p className="text-xs text-muted-foreground">
              Aceda mais rápido, mesmo offline
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="gold"
            size="sm"
            onClick={() => navigate("/instalar")}
          >
            Instalar
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallBanner;
