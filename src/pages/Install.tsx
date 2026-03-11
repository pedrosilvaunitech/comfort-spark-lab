import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Check, Smartphone, Monitor } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setIsInstalled(true));

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
  };

  if (isInstalled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <Check className="h-16 w-16 mx-auto text-accent mb-4" />
            <CardTitle>App Instalado!</CardTitle>
            <CardDescription>O UniTech já está instalado no seu dispositivo.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.href = "/"} className="w-full">
              Abrir App
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src="/logo.png" alt="UniTechBR" className="h-20 w-auto mx-auto mb-4 object-contain" />
          <CardTitle>Instalar UniTechBR</CardTitle>
          <CardDescription>
            Instale o app no seu dispositivo para acesso rápido e funcionamento offline.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {deferredPrompt ? (
            <Button onClick={handleInstall} className="w-full gap-2" size="lg">
              <Download className="h-5 w-5" />
              Instalar Agora
            </Button>
          ) : isIOS ? (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Para instalar no iPhone/iPad:</p>
              <ol className="list-decimal list-inside space-y-2">
                <li>Toque no botão <strong>Compartilhar</strong> (ícone de quadrado com seta)</li>
                <li>Role e toque em <strong>"Adicionar à Tela de Início"</strong></li>
                <li>Toque em <strong>"Adicionar"</strong></li>
              </ol>
            </div>
          ) : (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Para instalar:</p>
              <ol className="list-decimal list-inside space-y-2">
                <li>Abra o menu do navegador (três pontos)</li>
                <li>Toque em <strong>"Instalar app"</strong> ou <strong>"Adicionar à tela inicial"</strong></li>
              </ol>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Smartphone className="h-4 w-4" />
              <span>Funciona offline</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Monitor className="h-4 w-4" />
              <span>Acesso rápido</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Install;
