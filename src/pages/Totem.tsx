import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getServiceTypes, generateTicket, getSystemConfig } from "@/lib/ticket-service";
import { printTicket } from "@/lib/print-service";
import { supabase } from "@/integrations/supabase/client";
import type { ServiceType, Ticket } from "@/lib/ticket-service";
import { Printer, User, FileText, Heart, ArrowLeft } from "lucide-react";
import { useScreenConfig } from "@/hooks/use-screen-config";
import { useKioskMode } from "@/lib/kiosk-mode";

type Step = "select_type" | "optional_info" | "ticket_generated";

interface TotemConfig {
  askName: boolean;
  askCpf: boolean;
}

const defaultTotemConfig: TotemConfig = { askName: true, askCpf: true };

const Totem = () => {
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
        selectedType.id,
        ticketType,
        patientName || undefined,
        patientCpf || undefined
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

  return (
    <div className="min-h-screen bg-primary flex flex-col items-center justify-center p-6" style={bgStyle}>
      <div className="text-center mb-8">
        {screenConfig.logoUrl && (
          <img src={screenConfig.logoUrl} alt="Logo" className="h-20 mx-auto mb-4 object-contain" />
        )}
        <h1 className="text-4xl font-bold text-primary-foreground mb-2" style={textStyle}>
          {screenConfig.totemTitle || "Sistema de Senhas"}
        </h1>
        <p className="text-primary-foreground/80 text-lg" style={textStyle ? { ...textStyle, opacity: 0.8 } : {}}>
          {screenConfig.totemSubtitle || "Toque para retirar sua senha"}
        </p>
      </div>

      {step === "select_type" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full">
          {serviceTypes.map((type) => (
            <button key={type.id} onClick={() => handleSelectType(type)} className="group">
              <Card className="h-full transition-all duration-200 hover:scale-105 hover:shadow-xl cursor-pointer border-2 border-transparent hover:border-accent">
                <CardContent className="flex flex-col items-center justify-center p-10 gap-4">
                  <div className="text-primary group-hover:text-accent transition-colors">
                    {iconMap[type.prefix] || <FileText className="h-12 w-12" />}
                  </div>
                  <span className="text-2xl font-bold text-card-foreground">{type.name}</span>
                  {type.description && (
                    <span className="text-sm text-muted-foreground text-center">{type.description}</span>
                  )}
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}

      {step === "optional_info" && (
        <Card className="max-w-md w-full">
          <CardContent className="p-8 space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-bold text-card-foreground mb-1">{selectedType?.name}</h2>
              <p className="text-sm text-muted-foreground">
                {totemConfig.askName || totemConfig.askCpf ? "Informações opcionais (toque em gerar para pular)" : ""}
              </p>
            </div>
            <div className="space-y-4">
              {totemConfig.askName && (
                <div>
                  <Label htmlFor="name" className="flex items-center gap-2">
                    <User className="h-4 w-4" /> Nome (opcional)
                  </Label>
                  <Input id="name" value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Seu nome" className="mt-1" />
                </div>
              )}
              {totemConfig.askCpf && (
                <div>
                  <Label htmlFor="cpf">CPF (opcional)</Label>
                  <Input id="cpf" value={patientCpf} onChange={(e) => setPatientCpf(e.target.value)} placeholder="000.000.000-00" className="mt-1" />
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
        <Card className="max-w-md w-full animate-ticket-pulse">
          <CardContent className="p-10 text-center space-y-4">
            <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Sua senha é</p>
            <div className="text-7xl font-black text-primary tracking-widest">{generatedTicket.display_number}</div>
            <div className="text-lg text-muted-foreground">
              {generatedTicket.ticket_type === "priority" && "🔴 Prioritário"}
              {generatedTicket.ticket_type === "preferential" && "💙 Preferencial"}
              {generatedTicket.ticket_type === "normal" && "Normal"}
            </div>
            <div className="border-t border-border pt-4 mt-4">
              <p className="text-sm text-muted-foreground">Aguarde ser chamado no painel</p>
              <p className="text-xs text-muted-foreground mt-2">{new Date().toLocaleString("pt-BR")}</p>
            </div>
            <Button onClick={handleReset} variant="outline" className="mt-4">Nova Senha</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Totem;
