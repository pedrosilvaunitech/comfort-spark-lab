import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Printer, Usb, Check, X, RefreshCw, Settings, ArrowLeft, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  getLocalPrinterConfig,
  saveLocalPrinterConfig,
  clearLocalPrinterConfig,
  type LocalPrinterConfig,
} from "@/lib/local-printer-config";
import { hasWebUsb, pairWebUsbPrinter, isWebUsbPrinterConnected, generateEscPosBytes } from "@/lib/native-print";

const TotemSetup = () => {
  const navigate = useNavigate();
  const [config, setConfig] = useState<LocalPrinterConfig>(getLocalPrinterConfig());
  const [connectionStatus, setConnectionStatus] = useState<"checking" | "connected" | "disconnected">("checking");
  const [webUsbSupported, setWebUsbSupported] = useState(false);

  useEffect(() => {
    setWebUsbSupported(hasWebUsb());
    checkConnection();
  }, []);

  const checkConnection = async () => {
    setConnectionStatus("checking");
    try {
      const status = await isWebUsbPrinterConnected();
      setConnectionStatus(status.connected ? "connected" : "disconnected");
      if (status.connected && status.deviceName) {
        setConfig((prev) => {
          const updated = { ...prev, deviceName: status.deviceName || prev.deviceName };
          saveLocalPrinterConfig(updated);
          return updated;
        });
      }
    } catch {
      setConnectionStatus("disconnected");
    }
  };

  const handlePairPrinter = async () => {
    try {
      const result = await pairWebUsbPrinter();
      if (result.success) {
        const updated = saveLocalPrinterConfig({
          paired: true,
          deviceName: result.deviceName || "Impressora USB",
          vendorId: result.vendorId || 0x0483,
          productId: result.productId || 0x7540,
          pairedAt: new Date().toISOString(),
        });
        setConfig(updated);
        setConnectionStatus("connected");
        toast.success(`Impressora pareada: ${result.deviceName}`);
      } else {
        toast.error("Falha ao parear impressora. Verifique a conexão USB.");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao parear");
    }
  };

  const handleTestPrint = async () => {
    try {
      const { printViaWebUsb } = await import("@/lib/native-print");
      const testTicket = {
        displayNumber: "T0001",
        type: "normal",
        patientName: "Teste de Impressão",
        patientCpf: null,
        createdAt: new Date().toISOString(),
      };
      const layout = {
        clinicName: "UniTechBR",
        header: "Teste de Impressão",
        footer: "Impressora configurada com sucesso!",
        showDateTime: true,
      };
      const printerConfig = {
        autoCut: config.autoCut,
        printName: config.printName,
        printCpf: config.printCpf,
        paperSize: config.paperSize,
      };

      const success = await printViaWebUsb(testTicket, layout, printerConfig);
      if (success) {
        toast.success("Impressão de teste enviada!");
      } else {
        toast.error("Falha na impressão. Verifique a conexão.");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro na impressão de teste");
    }
  };

  const handleUnpair = () => {
    clearLocalPrinterConfig();
    setConfig(getLocalPrinterConfig());
    setConnectionStatus("disconnected");
    toast.success("Impressora desvinculada");
  };

  const updateConfig = (partial: Partial<LocalPrinterConfig>) => {
    const updated = saveLocalPrinterConfig(partial);
    setConfig(updated);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/totem")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Configuração do Totem</h1>
            <p className="text-sm text-muted-foreground">Configuração local da impressora deste dispositivo</p>
          </div>
        </div>

        {/* WebUSB Support Status */}
        {!webUsbSupported && (
          <Card className="border-destructive">
            <CardContent className="p-4">
              <p className="text-sm text-destructive font-medium">
                ⚠️ WebUSB não suportado neste navegador. Use o Chrome no Android para impressão USB direta.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Printer Connection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Usb className="h-5 w-5" />
              Impressora USB
            </CardTitle>
            <CardDescription>Conecte a impressora térmica POS80 via USB</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status:</span>
              <Badge
                variant={connectionStatus === "connected" ? "default" : "secondary"}
                className={connectionStatus === "connected" ? "bg-accent text-accent-foreground" : ""}
              >
                {connectionStatus === "checking" && "Verificando..."}
                {connectionStatus === "connected" && (
                  <span className="flex items-center gap-1"><Check className="h-3 w-3" /> Conectada</span>
                )}
                {connectionStatus === "disconnected" && (
                  <span className="flex items-center gap-1"><X className="h-3 w-3" /> Desconectada</span>
                )}
              </Badge>
            </div>

            {config.paired && config.deviceName && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Dispositivo:</span>
                <span className="font-mono text-foreground">{config.deviceName}</span>
              </div>
            )}

            {config.paired && config.pairedAt && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Pareada em:</span>
                <span className="text-foreground">{new Date(config.pairedAt).toLocaleString("pt-BR")}</span>
              </div>
            )}

            <div className="flex gap-2">
              {!config.paired ? (
                <Button onClick={handlePairPrinter} disabled={!webUsbSupported} className="flex-1 gap-2">
                  <Printer className="h-4 w-4" />
                  Parear Impressora
                </Button>
              ) : (
                <>
                  <Button onClick={checkConnection} variant="outline" size="icon">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button onClick={handleTestPrint} variant="outline" className="flex-1 gap-2">
                    <Printer className="h-4 w-4" />
                    Impressão Teste
                  </Button>
                  <Button onClick={handleUnpair} variant="destructive" size="icon">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Printer Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configurações de Impressão
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Tamanho do papel</Label>
              <Select
                value={config.paperSize}
                onValueChange={(v) => updateConfig({ paperSize: v as "58mm" | "80mm" })}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="80mm">80mm</SelectItem>
                  <SelectItem value="58mm">58mm</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label>Corte automático</Label>
              <Switch checked={config.autoCut} onCheckedChange={(v) => updateConfig({ autoCut: v })} />
            </div>

            <div className="flex items-center justify-between">
              <Label>Imprimir nome</Label>
              <Switch checked={config.printName} onCheckedChange={(v) => updateConfig({ printName: v })} />
            </div>

            <div className="flex items-center justify-between">
              <Label>Imprimir CPF</Label>
              <Switch checked={config.printCpf} onCheckedChange={(v) => updateConfig({ printCpf: v })} />
            </div>
          </CardContent>
        </Card>

        <Button variant="outline" className="w-full" onClick={() => navigate("/totem")}>
          Voltar ao Totem
        </Button>
      </div>
    </div>
  );
};

export default TotemSetup;
