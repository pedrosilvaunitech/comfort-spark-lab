import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Printer, Usb, Check, X, RefreshCw, Settings, ArrowLeft, Trash2, Wifi, Globe } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  getLocalPrinterConfig,
  saveLocalPrinterConfig,
  clearLocalPrinterConfig,
  type LocalPrinterConfig,
} from "@/lib/local-printer-config";
import { hasWebUsb, pairWebUsbPrinter, isWebUsbPrinterConnected, isAndroid, UsbPrinter } from "@/lib/native-print";

type PrintMode = "android_usb" | "webusb" | "network" | "browser";

const TotemSetup = () => {
  const navigate = useNavigate();
  const [config, setConfig] = useState<LocalPrinterConfig>(getLocalPrinterConfig());
  const [connectionStatus, setConnectionStatus] = useState<"checking" | "connected" | "disconnected">("checking");
  const [webUsbSupported, setWebUsbSupported] = useState(false);
  const [printMode, setPrintMode] = useState<PrintMode>(() => {
    return (localStorage.getItem("unitech_print_mode") as PrintMode) || "webusb";
  });
  const [networkIp, setNetworkIp] = useState(() => localStorage.getItem("unitech_printer_ip") || "");
  const [networkPort, setNetworkPort] = useState(() => localStorage.getItem("unitech_printer_port") || "9100");

  useEffect(() => {
    const supported = hasWebUsb();
    setWebUsbSupported(supported);
    if (!supported && printMode === "webusb") {
      setPrintMode("network");
      localStorage.setItem("unitech_print_mode", "network");
    }
    if (printMode === "webusb") {
      checkConnection();
    } else {
      setConnectionStatus("disconnected");
    }
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
      if (printMode === "webusb") {
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
      } else if (printMode === "network") {
        if (!networkIp) {
          toast.error("Configure o IP da impressora primeiro.");
          return;
        }
        const payload = {
          ticket: {
            displayNumber: "T0001",
            type: "normal",
            patientName: "Teste de Impressão",
            patientCpf: null,
            createdAt: new Date().toISOString(),
          },
          layout: {
            clinicName: "UniTechBR",
            header: "Teste de Impressão",
            footer: "Configurada com sucesso!",
            showDateTime: true,
          },
          printer: {
            connectionType: "network",
            ip: networkIp,
            port: parseInt(networkPort) || 9100,
            autoCut: config.autoCut,
            paperSize: config.paperSize,
            printName: config.printName,
            printCpf: config.printCpf,
          },
        };

        const endpoints = [
          `http://localhost:3001/print`,
          `http://${window.location.hostname}:3001/print`,
        ];

        let printed = false;
        for (const url of endpoints) {
          try {
            const res = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
              signal: AbortSignal.timeout(5000),
            });
            if (res.ok) {
              toast.success("Impressão de teste enviada via rede!");
              printed = true;
              break;
            }
          } catch {
            continue;
          }
        }
        if (!printed) {
          toast.error(`Não foi possível conectar ao servidor de impressão. Verifique se o print server está rodando.`);
        }
      } else {
        // Browser test
        const w = window.open("", "_blank", "width=350,height=400");
        if (w) {
          w.document.write(`<html><body style="font-family:monospace;text-align:center;padding:20px;">
            <h2>UniTechBR</h2><hr/><h1>T0001</h1><p>Teste de Impressão</p>
            <p>${new Date().toLocaleString("pt-BR")}</p><hr/>
            <small>Impressora configurada!</small></body></html>`);
          w.document.close();
          setTimeout(() => { w.print(); setTimeout(() => w.close(), 1000); }, 300);
          toast.success("Janela de impressão aberta!");
        } else {
          toast.error("Popup bloqueado pelo navegador.");
        }
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

  const handlePrintModeChange = (mode: PrintMode) => {
    setPrintMode(mode);
    localStorage.setItem("unitech_print_mode", mode);
    if (mode === "webusb") checkConnection();
  };

  const handleSaveNetwork = () => {
    localStorage.setItem("unitech_printer_ip", networkIp);
    localStorage.setItem("unitech_printer_port", networkPort);
    toast.success("Configuração de rede salva!");
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

        {/* Print Mode Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              Método de Impressão
            </CardTitle>
            <CardDescription>Escolha como este dispositivo vai imprimir</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${printMode === "webusb" ? "border-primary bg-primary/5" : "border-border"}`}
              onClick={() => webUsbSupported && handlePrintModeChange("webusb")}
            >
              <Usb className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="font-medium text-sm">USB Direto (WebUSB)</p>
                <p className="text-xs text-muted-foreground">Impressora conectada por cabo USB</p>
              </div>
              {!webUsbSupported && <Badge variant="secondary" className="text-xs">Indisponível</Badge>}
              {printMode === "webusb" && <Check className="h-4 w-4 text-primary" />}
            </div>

            <div
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${printMode === "network" ? "border-primary bg-primary/5" : "border-border"}`}
              onClick={() => handlePrintModeChange("network")}
            >
              <Wifi className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="font-medium text-sm">Rede IP</p>
                <p className="text-xs text-muted-foreground">Impressora na rede local (requer print server)</p>
              </div>
              {printMode === "network" && <Check className="h-4 w-4 text-primary" />}
            </div>

            <div
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${printMode === "browser" ? "border-primary bg-primary/5" : "border-border"}`}
              onClick={() => handlePrintModeChange("browser")}
            >
              <Globe className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="font-medium text-sm">Navegador (Popup)</p>
                <p className="text-xs text-muted-foreground">Usa o diálogo de impressão do navegador</p>
              </div>
              {printMode === "browser" && <Check className="h-4 w-4 text-primary" />}
            </div>
          </CardContent>
        </Card>

        {/* WebUSB Config */}
        {printMode === "webusb" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Usb className="h-5 w-5" />
                Impressora USB
              </CardTitle>
              <CardDescription>Conecte a impressora térmica POS80 via USB</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!webUsbSupported && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  ⚠️ WebUSB não suportado. Use Chrome no Android ou desktop, fora de iframes.
                </div>
              )}

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
        )}

        {/* Network IP Config */}
        {printMode === "network" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="h-5 w-5" />
                Impressora de Rede
              </CardTitle>
              <CardDescription>Configure o IP da impressora na rede local</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Endereço IP</Label>
                <Input
                  placeholder="192.168.1.100"
                  value={networkIp}
                  onChange={(e) => setNetworkIp(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Porta</Label>
                <Input
                  placeholder="9100"
                  value={networkPort}
                  onChange={(e) => setNetworkPort(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveNetwork} className="flex-1">
                  Salvar Configuração
                </Button>
                <Button onClick={handleTestPrint} variant="outline" className="flex-1 gap-2">
                  <Printer className="h-4 w-4" />
                  Teste
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Requer um print server rodando localmente (porta 3001) para enviar dados à impressora via TCP.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Browser Config */}
        {printMode === "browser" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Impressão via Navegador
              </CardTitle>
              <CardDescription>Usa o diálogo padrão de impressão</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Ao gerar uma senha, o navegador abrirá a janela de impressão. 
                Selecione sua impressora e clique em imprimir.
              </p>
              <Button onClick={handleTestPrint} variant="outline" className="w-full gap-2">
                <Printer className="h-4 w-4" />
                Impressão Teste
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Print Settings */}
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
