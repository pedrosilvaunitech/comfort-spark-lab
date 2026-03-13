import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getServiceTypes, generateTicket, getSystemConfig } from "@/lib/ticket-service";
import { printTicket } from "@/lib/print-service";
import { supabase } from "@/integrations/supabase/client";
import type { ServiceType, Ticket } from "@/lib/ticket-service";
import { Printer, User, FileText, Heart, ArrowLeft } from "lucide-react";
import { isAndroid } from "@/lib/native-print";
import { useScreenConfig } from "@/hooks/use-screen-config";
import { useKioskMode } from "@/lib/kiosk-mode";
import { useNavigate } from "react-router-dom";
import { isLocalPrinterPaired, getLocalPrinterConfig } from "@/lib/local-printer-config";
import { autoConnectWebUsbPrinter } from "@/lib/native-print";

type Step = "select_type" | "optional_info" | "ticket_generated";

interface TotemConfig {
  askName: boolean;
  askCpf: boolean;
}

const defaultTotemConfig: TotemConfig = { askName: true, askCpf: true };

const Totem = () => {
  const navigate = useNavigate();
  useKioskMode();
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [step, setStep] = useState<Step>("select_type");
  const [selectedType, setSelectedType] = useState<ServiceType | null>(null);
  const [ticketType, setTicketType] = useState<"normal" | "priority" | "preferential">("normal");
  const [patientName, setPatientName] = useState("");
  const [patientCpf, setPatientCpf] = useState("");
  const [generatedTicket, setGeneratedTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(false);
  const [totemConfig, setTotemConfig] = useState<TotemConfig>(defaultTotemConfig);
  const { config: screenConfig } = useScreenConfig();

  const loadServiceTypes = useCallback(() => {
    getServiceTypes().then(setServiceTypes).catch(console.error);
  }, []);

  useEffect(() => {
    loadServiceTypes();
    getSystemConfig("totem_config").then((data) => {
      if (data) setTotemConfig(data as unknown as TotemConfig);
    });

    // Only try WebUSB auto-connect on non-Android platforms
    if (!isAndroid()) {
      const localConfig = getLocalPrinterConfig();
      if (localConfig.paired) {
        autoConnectWebUsbPrinter(localConfig.vendorId, localConfig.productId)
          .then((connected) => {
            if (connected) console.log("[Totem] WebUSB printer auto-connected");
            else console.warn("[Totem] WebUSB printer not found");
          });
      }
    }

    const channel = supabase
      .channel("totem-service-types")
      .on("postgres_changes", { event: "*", schema: "public", table: "service_types" }, () => loadServiceTypes())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadServiceTypes]);

  const handleSelectType = (type: ServiceType) => {
    setSelectedType(type);
    if (!totemConfig.askName && !totemConfig.askCpf) {
      handleGenerateDirect(type);
    } else {
      setStep("optional_info");
    }
  };

  const handleGenerateDirect = async (type: ServiceType) => {
    setLoading(true);
    try {
      const ticket = await generateTicket(type.id, ticketType);
      setGeneratedTicket(ticket);
      setStep("ticket_generated");
      printTicket(ticket).catch(console.error);
    } catch (err) {
      console.error("Erro ao gerar senha:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedType) return;
    setLoading(true);
    try {
      const ticket = await generateTicket(
        selectedType.id, ticketType,
        patientName || undefined, patientCpf || undefined
      );
      setGeneratedTicket(ticket);
      setStep("ticket_generated");
      printTicket(ticket).catch(console.error);
    } catch (err) {
      console.error("Erro ao gerar senha:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep("select_type");
    setSelectedType(null);
    setTicketType("normal");
    setPatientName("");
    setPatientCpf("");
    setGeneratedTicket(null);
  };

  useEffect(() => {
    if (step === "ticket_generated") {
      const timer = setTimeout(handleReset, 8000);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const iconMap: Record<string, React.ReactNode> = {
    N: <FileText className="h-12 w-12" />,
    P: <Heart className="h-12 w-12" />,
    E: <Printer className="h-12 w-12" />,
  };

  const bgStyle = screenConfig.totemBgColor ? { backgroundColor: screenConfig.totemBgColor } : {};
  const textStyle = screenConfig.totemTextColor ? { color: screenConfig.totemTextColor } : {};
  const fontStyle = screenConfig.totemFontFamily ? { fontFamily: screenConfig.totemFontFamily } : {};
  const buttonStyle: React.CSSProperties = {
    ...(screenConfig.totemButtonBgColor ? { backgroundColor: screenConfig.totemButtonBgColor } : {}),
    ...(screenConfig.totemButtonTextColor ? { color: screenConfig.totemButtonTextColor } : {}),
    ...(screenConfig.totemButtonRadius ? { borderRadius: `${screenConfig.totemButtonRadius}px` } : {}),
  };
  const logoSize = screenConfig.totemLogoSize || "8";

  // Long-press on title to open setup
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleTitleTouchStart = () => {
    longPressTimer.current = setTimeout(() => navigate("/totem/setup"), 3000);
  };
  const handleTitleTouchEnd = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };

  const printerPaired = isAndroid() || isLocalPrinterPaired();

  return (
    <div className="min-h-screen min-h-[100dvh] bg-primary flex flex-col items-center justify-center p-[3vw]" style={{ ...bgStyle, ...fontStyle }}>
      <div className="text-center mb-[3vh]">
        {screenConfig.totemShowLogo !== false && screenConfig.logoUrl && (
          <img src={screenConfig.logoUrl} alt="Logo" className="mx-auto mb-[2vh] object-contain" style={{ height: `${logoSize}vh` }} />
        )}
        <h1
          className="text-[clamp(1.5rem,4vw,3.5rem)] font-bold text-primary-foreground mb-[0.5vh] select-none"
          style={{ ...textStyle, ...fontStyle }}
          onTouchStart={handleTitleTouchStart}
          onTouchEnd={handleTitleTouchEnd}
          onMouseDown={handleTitleTouchStart}
          onMouseUp={handleTitleTouchEnd}
          onMouseLeave={handleTitleTouchEnd}
        >
          {screenConfig.totemTitle || "Sistema de Senhas"}
        </h1>
        <p className="text-[clamp(0.9rem,2vw,1.5rem)] text-primary-foreground/80" style={textStyle ? { ...textStyle, opacity: 0.8, ...fontStyle } : fontStyle}>
          {screenConfig.totemSubtitle || "Toque para retirar sua senha"}
        </p>
      </div>

      {step === "select_type" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[2vw] w-full max-w-[90vw]">
          {serviceTypes.map((type) => (
            <button key={type.id} onClick={() => handleSelectType(type)} className="group">
              <Card
                className="h-full transition-all duration-200 hover:scale-105 hover:shadow-xl cursor-pointer border-2 border-transparent hover:border-accent overflow-hidden"
                style={buttonStyle}
              >
                <CardContent className="flex flex-col items-center justify-center p-[clamp(1rem,2.5vw,2.5rem)] gap-[1vh]">
                  <div className="transition-colors" style={screenConfig.totemButtonTextColor ? { color: screenConfig.totemButtonTextColor } : {}}>
                    {iconMap[type.prefix] || <FileText className="h-[clamp(1.5rem,3vw,3rem)] w-[clamp(1.5rem,3vw,3rem)]" />}
                  </div>
                  <span className="text-[clamp(0.85rem,2vw,1.6rem)] font-bold leading-tight text-center break-words max-w-full" style={screenConfig.totemButtonTextColor ? { color: screenConfig.totemButtonTextColor } : {}}>
                    {type.name}
                  </span>
                  {type.description && (
                    <span className="text-[clamp(0.6rem,1vw,0.85rem)] text-center opacity-70 break-words max-w-full leading-snug">{type.description}</span>
                  )}
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}

      {step === "optional_info" && (
        <Card className="w-full max-w-[min(28rem,90vw)]">
          <CardContent className="p-[clamp(1.5rem,3vw,3rem)] space-y-[2vh]">
            <div className="text-center">
              <h2 className="text-[clamp(1rem,2.5vw,1.5rem)] font-bold text-card-foreground mb-1">{selectedType?.name}</h2>
              <p className="text-[clamp(0.75rem,1.2vw,0.9rem)] text-muted-foreground">
                {totemConfig.askName || totemConfig.askCpf ? "Informações opcionais (toque em gerar para pular)" : ""}
              </p>
            </div>
            <div className="space-y-4">
              {totemConfig.askName && (
                <div>
                  <Label htmlFor="name" className="flex items-center gap-2"><User className="h-4 w-4" /> Nome (opcional)</Label>
                  <Input id="name" value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Seu nome" className="mt-1 text-[clamp(0.9rem,1.5vw,1.1rem)]" />
                </div>
              )}
              {totemConfig.askCpf && (
                <div>
                  <Label htmlFor="cpf">CPF (opcional)</Label>
                  <Input id="cpf" value={patientCpf} onChange={(e) => setPatientCpf(e.target.value)} placeholder="000.000.000-00" className="mt-1 text-[clamp(0.9rem,1.5vw,1.1rem)]" />
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("select_type")} className="flex-1">
                <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
              </Button>
              <Button onClick={handleGenerate} disabled={loading} className="flex-1" size="lg">
                {loading ? "Gerando..." : "Gerar Senha"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "ticket_generated" && generatedTicket && (
        <Card className="w-full max-w-[min(28rem,90vw)] animate-ticket-pulse">
          <CardContent className="p-[clamp(1.5rem,4vw,3.5rem)] text-center space-y-[2vh]">
            <p className="text-[clamp(0.75rem,1.2vw,1rem)] text-muted-foreground font-medium uppercase tracking-wider">Sua senha é</p>
            <div className="text-[clamp(2.5rem,8vw,6rem)] font-black text-primary tracking-widest whitespace-nowrap">{generatedTicket.display_number}</div>
            <div className="text-[clamp(0.9rem,1.5vw,1.3rem)] text-muted-foreground">
              {generatedTicket.ticket_type === "priority" && "🔴 Prioritário"}
              {generatedTicket.ticket_type === "preferential" && "💙 Preferencial"}
              {generatedTicket.ticket_type === "normal" && "Normal"}
            </div>
            <div className="border-t border-border pt-[2vh] mt-[2vh]">
              <p className="text-[clamp(0.75rem,1.2vw,1rem)] text-muted-foreground">Aguarde ser chamado no painel</p>
              <p className="text-[clamp(0.6rem,1vw,0.8rem)] text-muted-foreground mt-2">{new Date().toLocaleString("pt-BR")}</p>
            </div>
            <Button onClick={handleReset} variant="outline" className="mt-4">Nova Senha</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Totem;
