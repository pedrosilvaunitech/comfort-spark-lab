import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getSystemConfig,
  updateSystemConfig,
  getTodayTickets,
  getPrintLogs,
  getPendingPrints,
  resetCalledTickets,
} from "@/lib/ticket-service";
import { printViaBrowser, printViaPrintServer, printViaCloud } from "@/lib/print-service";
import type { PrintConfig, TicketLayout } from "@/lib/print-service";
import { useAuth } from "@/hooks/use-auth";
import { UserManagement } from "@/components/admin/UserManagement";
import { CounterManagement } from "@/components/admin/CounterManagement";
import { ServiceTypeManagement } from "@/components/admin/ServiceTypeManagement";
import { Reports } from "@/components/admin/Reports";
import { VoiceConfig } from "@/components/admin/VoiceConfig";
import { QueueManagement } from "@/components/admin/QueueManagement";
import { TotemConfig } from "@/components/admin/TotemConfig";
import { ScreenConfigPanel } from "@/components/admin/ScreenConfig";
import { PriorityConfig } from "@/components/admin/PriorityConfig";
import { LicenseIndicator } from "@/components/admin/LicenseIndicator";
import { toast } from "sonner";
import { Link, Navigate } from "react-router-dom";
import {
  Printer, Settings, FileText, History, RefreshCw, Save, TestTube,
  LayoutTemplate, Users, Monitor, BarChart3, LogOut, Trash2, Volume2,
  ListOrdered, Tablet, Palette, ShieldAlert, Menu, X, ChevronRight,
  Home, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

type AdminSection =
  | "queue" | "counters" | "services" | "priority" | "users"
  | "totem" | "screens" | "printer" | "voice"
  | "reports" | "logs";

interface NavItem {
  id: AdminSection;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: "queue", label: "Fila de Atendimento", icon: <ListOrdered className="h-4 w-4" /> },
  { id: "counters", label: "Guichês", icon: <Monitor className="h-4 w-4" />, adminOnly: true },
  { id: "services", label: "Tipos de Serviço", icon: <FileText className="h-4 w-4" />, adminOnly: true },
  { id: "priority", label: "Prioridade", icon: <ShieldAlert className="h-4 w-4" />, adminOnly: true },
  { id: "users", label: "Usuários", icon: <Users className="h-4 w-4" />, adminOnly: true },
  { id: "totem", label: "Config. Totem", icon: <Tablet className="h-4 w-4" />, adminOnly: true },
  { id: "screens", label: "Aparência das Telas", icon: <Palette className="h-4 w-4" />, adminOnly: true },
  { id: "printer", label: "Impressão & Layout", icon: <Printer className="h-4 w-4" />, adminOnly: true },
  { id: "voice", label: "Configuração de Voz", icon: <Volume2 className="h-4 w-4" />, adminOnly: true },
  { id: "reports", label: "Relatórios", icon: <BarChart3 className="h-4 w-4" /> },
  { id: "logs", label: "Histórico / Logs", icon: <History className="h-4 w-4" />, adminOnly: true },
];

const Admin = () => {
  const { user, loading: authLoading, isAdmin, isGestor, signOut } = useAuth();
  const [activeSection, setActiveSection] = useState<AdminSection>("queue");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [printerConfig, setPrinterConfig] = useState<PrintConfig>({
    enabled: false, connectionType: "network", ip: "192.168.1.100", port: 9100,
    usbVendorId: "", usbProductId: "", serialPort: "COM1", serialBaudrate: 9600,
    autoCut: true, printLogo: false, printQrCode: true, printCpf: true,
    printName: true, printMode: "detailed", paperSize: "80mm",
  });
  const [layoutConfig, setLayoutConfig] = useState<TicketLayout>({
    clinicName: "Clínica Exemplo", header: "Bem-vindo!", footer: "Aguarde ser chamado no painel",
    customMessage: "", lgpdNotice: "Seus dados são protegidos conforme LGPD",
    showDateTime: true, fontSize: "large", alignment: "center", lineSpacing: 1,
  });
  const [todayTickets, setTodayTickets] = useState<any[]>([]);
  const [printLogs, setPrintLogs] = useState<any[]>([]);
  const [pendingPrints, setPendingPrints] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (user) { loadConfigs(); loadData(); } }, [user]);

  const loadConfigs = async () => {
    const [printer, layout] = await Promise.all([getSystemConfig("printer"), getSystemConfig("ticket_layout")]);
    if (printer) setPrinterConfig(printer as unknown as PrintConfig);
    if (layout) setLayoutConfig(layout as unknown as TicketLayout);
  };

  const loadData = async () => {
    const [tickets, logs, pending] = await Promise.all([getTodayTickets(), getPrintLogs(), getPendingPrints()]);
    setTodayTickets(tickets || []); setPrintLogs(logs || []); setPendingPrints(pending || []);
  };

  const handleSavePrinter = async () => {
    setSaving(true);
    try { await updateSystemConfig("printer", printerConfig as any); toast.success("Configuração salva!"); }
    catch { toast.error("Erro ao salvar"); } finally { setSaving(false); }
  };

  const handleSaveLayout = async () => {
    setSaving(true);
    try { await updateSystemConfig("ticket_layout", layoutConfig as any); toast.success("Layout salvo!"); }
    catch { toast.error("Erro ao salvar"); } finally { setSaving(false); }
  };

  const handleTestPrint = async (method: "browser" | "print_server" | "cloud") => {
    const mockTicket = {
      id: "test", display_number: "N0001", ticket_type: "normal" as const,
      ticket_number: "test", status: "waiting" as const, patient_name: "Teste de Impressão",
      patient_cpf: "000.000.000-00", created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(), service_type_id: null, counter_id: null,
      called_at: null, completed_at: null, operator_id: null, custom_voice_text: null,
    };
    toast.info(`Testando impressão via ${method}...`);
    let success = false;
    if (method === "browser") success = await printViaBrowser(mockTicket);
    else if (method === "print_server") success = await printViaPrintServer(mockTicket);
    else success = await printViaCloud(mockTicket);
    if (success) toast.success("Teste enviado!"); else toast.error("Falha no teste");
  };

  const handleReprocessPending = async () => {
    toast.info("Reprocessando..."); for (const p of pendingPrints) { if (p.tickets) await printViaBrowser(p.tickets); }
    loadData(); toast.success("Reprocessamento concluído");
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">Carregando...</p></div>;
  if (!user) return <Navigate to="/login" />;
  if (!isAdmin && !isGestor) return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-destructive">Acesso restrito a administradores e gestores</p></div>;

  const filteredNav = NAV_ITEMS.filter(item => !item.adminOnly || isAdmin);
  const activeItem = NAV_ITEMS.find(i => i.id === activeSection);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-dvh flex flex-col transition-all duration-300 ease-in-out",
        "bg-sidebar text-sidebar-foreground border-r border-sidebar-border",
        sidebarOpen ? "w-64" : "w-16",
        mobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Sidebar Header */}
        <div className={cn(
          "flex items-center h-14 border-b border-sidebar-border px-3 shrink-0",
          sidebarOpen ? "justify-between" : "justify-center"
        )}>
          {sidebarOpen && (
            <div className="flex items-center gap-2 min-w-0">
              <Settings className="h-5 w-5 text-sidebar-primary shrink-0" />
              <span className="font-bold text-sm truncate">Administração</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent shrink-0"
            onClick={() => {
              setSidebarOpen(!sidebarOpen);
              setMobileSidebarOpen(false);
            }}
          >
            {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-2">
          <nav className="space-y-0.5 px-2">
            {filteredNav.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveSection(item.id);
                  setMobileSidebarOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 rounded-md text-sm transition-colors",
                  sidebarOpen ? "px-3 py-2.5" : "px-0 py-2.5 justify-center",
                  activeSection === item.id
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
                title={!sidebarOpen ? item.label : undefined}
              >
                <span className="shrink-0">{item.icon}</span>
                {sidebarOpen && <span className="truncate">{item.label}</span>}
              </button>
            ))}
          </nav>
        </ScrollArea>

        {/* Sidebar Footer */}
        <div className={cn(
          "border-t border-sidebar-border p-2 space-y-1 shrink-0",
          !sidebarOpen && "flex flex-col items-center"
        )}>
          {sidebarOpen ? (
            <>
              <div className="grid grid-cols-4 gap-1">
                <Link to="/">
                  <Button variant="ghost" size="sm" className="w-full text-sidebar-foreground/70 hover:bg-sidebar-accent text-xs h-8">
                    <Home className="h-3 w-3 mr-1" /> Início
                  </Button>
                </Link>
                <Link to="/totem">
                  <Button variant="ghost" size="sm" className="w-full text-sidebar-foreground/70 hover:bg-sidebar-accent text-xs h-8">
                    <Tablet className="h-3 w-3 mr-1" /> Totem
                  </Button>
                </Link>
                <Link to="/panel">
                  <Button variant="ghost" size="sm" className="w-full text-sidebar-foreground/70 hover:bg-sidebar-accent text-xs h-8">
                    <Monitor className="h-3 w-3 mr-1" /> Painel
                  </Button>
                </Link>
                <Link to="/counter">
                  <Button variant="ghost" size="sm" className="w-full text-sidebar-foreground/70 hover:bg-sidebar-accent text-xs h-8">
                    <ExternalLink className="h-3 w-3 mr-1" /> Guichê
                  </Button>
                </Link>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 text-sidebar-foreground/70 hover:bg-sidebar-accent text-xs h-8 justify-start"
                  onClick={signOut}
                >
                  <LogOut className="h-3 w-3 mr-1" /> Sair
                </Button>
              </div>
            </>
          ) : (
            <>
              <Link to="/"><Button variant="ghost" size="icon" className="h-8 w-8 text-sidebar-foreground/70 hover:bg-sidebar-accent" title="Início"><Home className="h-4 w-4" /></Button></Link>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-sidebar-foreground/70 hover:bg-sidebar-accent" title="Sair" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
            </>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className={cn("flex-1 flex flex-col min-w-0 transition-all duration-300", sidebarOpen ? "lg:ml-64" : "lg:ml-16")}>
        {/* Top Bar */}
        <header className="sticky top-0 z-30 h-14 bg-card border-b border-border flex items-center justify-between px-4 lg:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-8 w-8"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 text-sm">
              <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
                <Home className="h-4 w-4" />
              </Link>
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium text-foreground flex items-center gap-1.5">
                {activeItem?.icon}
                {activeItem?.label}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LicenseIndicator />
            {isAdmin && (
              <Button
                variant="destructive"
                size="sm"
                className="text-xs h-8"
                onClick={async () => {
                  if (!confirm("Tem certeza que deseja ZERAR TUDO? Isso cancelará todas as senhas (fila, chamadas e atendimentos) e reiniciará a sequência numérica do dia.")) return;
                  try { await resetCalledTickets(); loadData(); toast.success("Sistema zerado! Sequência reiniciada."); }
                  catch { toast.error("Erro ao zerar senhas"); }
                }}
              >
                <Trash2 className="h-3 w-3 mr-1" /> Zerar Tudo
              </Button>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <div className="max-w-6xl mx-auto space-y-6">
            {activeSection === "queue" && <QueueManagement />}
            {activeSection === "priority" && isAdmin && <PriorityConfig />}
            {activeSection === "counters" && isAdmin && <CounterManagement />}
            {activeSection === "services" && isAdmin && <ServiceTypeManagement />}
            {activeSection === "users" && isAdmin && <UserManagement />}
            {activeSection === "totem" && isAdmin && <TotemConfig />}
            {activeSection === "screens" && isAdmin && <ScreenConfigPanel />}
            {activeSection === "voice" && isAdmin && <VoiceConfig />}
            {activeSection === "reports" && <Reports />}

            {/* PRINTER & LAYOUT CONFIG (unified) */}
            {activeSection === "printer" && isAdmin && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Link to TotemSetup for device-level config */}
                <Card className="lg:col-span-2 border-primary/20 bg-primary/5">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-foreground">Configuração da Impressora (por dispositivo)</p>
                      <p className="text-sm text-muted-foreground">A conexão USB ou Rede é configurada em cada dispositivo/totem individualmente.</p>
                    </div>
                    <Link to="/totem/setup">
                      <Button variant="outline" className="gap-2">
                        <ExternalLink className="h-4 w-4" />
                        Abrir Config. do Totem
                      </Button>
                    </Link>
                  </CardContent>
                </Card>

                {/* Global print options */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5 text-primary" /> Opções Globais de Impressão</CardTitle>
                    <CardDescription>Aplicadas a todos os dispositivos</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between"><Label>Ativar impressão automática</Label><Switch checked={printerConfig.enabled} onCheckedChange={(v) => setPrinterConfig({ ...printerConfig, enabled: v })} /></div>
                    <div><Label>Papel</Label><Select value={printerConfig.paperSize} onValueChange={(v: any) => setPrinterConfig({ ...printerConfig, paperSize: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="58mm">58mm</SelectItem><SelectItem value="80mm">80mm</SelectItem></SelectContent></Select></div>
                    {[{ label: "Corte automático", key: "autoCut" },{ label: "QR Code", key: "printQrCode" },{ label: "Logo", key: "printLogo" },{ label: "CPF", key: "printCpf" },{ label: "Nome", key: "printName" }].map(({ label, key }) => (<div key={key} className="flex items-center justify-between"><Label>{label}</Label><Switch checked={(printerConfig as any)[key]} onCheckedChange={(v) => setPrinterConfig({ ...printerConfig, [key]: v })} /></div>))}
                    <Button onClick={handleSavePrinter} disabled={saving} className="w-full"><Save className="h-4 w-4 mr-2" />{saving ? "Salvando..." : "Salvar Opções"}</Button>
                    <div className="border-t border-border pt-4 space-y-2">
                      <p className="text-sm font-semibold text-muted-foreground">Testar Impressão</p>
                      <Button onClick={() => handleTestPrint("browser")} variant="outline" className="w-full"><TestTube className="h-4 w-4 mr-2" />Navegador</Button>
                      <Button onClick={() => handleTestPrint("print_server")} variant="outline" className="w-full"><TestTube className="h-4 w-4 mr-2" />Print Server</Button>
                    </div>
                    {pendingPrints.length > 0 && (<div className="border-t border-border pt-4"><Button onClick={handleReprocessPending} variant="outline" className="w-full"><RefreshCw className="h-4 w-4 mr-2" />Reprocessar {pendingPrints.length} Pendente(s)</Button></div>)}
                  </CardContent>
                </Card>

                {/* Layout config */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><LayoutTemplate className="h-5 w-5 text-primary" /> Layout do Ticket</CardTitle>
                    <CardDescription>Configure o que aparece no ticket impresso</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div><Label>Nome da Clínica</Label><Input value={layoutConfig.clinicName} onChange={(e) => setLayoutConfig({ ...layoutConfig, clinicName: e.target.value })} /></div>
                    <div><Label>Cabeçalho</Label><Input value={layoutConfig.header} onChange={(e) => setLayoutConfig({ ...layoutConfig, header: e.target.value })} /></div>
                    <div><Label>Rodapé</Label><Input value={layoutConfig.footer} onChange={(e) => setLayoutConfig({ ...layoutConfig, footer: e.target.value })} /></div>
                    <div><Label>Mensagem Personalizada</Label><Textarea value={layoutConfig.customMessage} onChange={(e) => setLayoutConfig({ ...layoutConfig, customMessage: e.target.value })} /></div>
                    <div><Label>Aviso LGPD</Label><Textarea value={layoutConfig.lgpdNotice} onChange={(e) => setLayoutConfig({ ...layoutConfig, lgpdNotice: e.target.value })} /></div>
                    <div className="flex items-center justify-between"><Label>Exibir data e hora</Label><Switch checked={layoutConfig.showDateTime} onCheckedChange={(v) => setLayoutConfig({ ...layoutConfig, showDateTime: v })} /></div>
                    <div><Label>Tamanho da Senha</Label><Select value={layoutConfig.fontSize} onValueChange={(v: any) => setLayoutConfig({ ...layoutConfig, fontSize: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="normal">Normal</SelectItem><SelectItem value="large">Grande</SelectItem><SelectItem value="giant">Gigante</SelectItem></SelectContent></Select></div>
                    <div><Label>Alinhamento</Label><Select value={layoutConfig.alignment} onValueChange={(v: any) => setLayoutConfig({ ...layoutConfig, alignment: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="center">Centro</SelectItem><SelectItem value="left">Esquerda</SelectItem></SelectContent></Select></div>
                    <div><Label>Espaçamento</Label><Input type="number" min="0.5" max="3" step="0.1" value={layoutConfig.lineSpacing} onChange={(e) => setLayoutConfig({ ...layoutConfig, lineSpacing: Number(e.target.value) })} /></div>
                    <Button onClick={handleSaveLayout} disabled={saving} className="w-full"><Save className="h-4 w-4 mr-2" />Salvar Layout</Button>
                    <div className="border-2 border-dashed border-border rounded-lg p-4 mt-4">
                      <p className="text-xs text-muted-foreground text-center mb-2">Pré-visualização</p>
                      <TicketPreview layout={layoutConfig} config={printerConfig} />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* HISTORY */}
            {activeSection === "logs" && isAdmin && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <History className="h-5 w-5 text-primary" /> Senhas de Hoje
                      <Badge variant="secondary" className="ml-2">{todayTickets.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b border-border"><th className="text-left p-2">Senha</th><th className="text-left p-2">Tipo</th><th className="text-left p-2">Status</th><th className="text-left p-2">Nome</th><th className="text-left p-2">Guichê</th><th className="text-left p-2">Hora</th><th className="text-left p-2">Ações</th></tr></thead>
                        <tbody>
                          {todayTickets.map((t: any) => (
                            <tr key={t.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                              <td className="p-2 font-bold">{t.display_number}</td>
                              <td className="p-2">{t.ticket_type}</td>
                              <td className="p-2"><Badge variant="secondary">{t.status}</Badge></td>
                              <td className="p-2">{t.patient_name || "—"}</td>
                              <td className="p-2">{t.counters?.name || "—"}</td>
                              <td className="p-2">{new Date(t.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
                              <td className="p-2"><Button size="sm" variant="ghost" onClick={() => { printViaBrowser(t); toast.info("Reimprimindo..."); }}><Printer className="h-3 w-3" /></Button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {todayTickets.length === 0 && <p className="text-center py-8 text-muted-foreground">Nenhuma senha hoje</p>}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2"><Printer className="h-5 w-5 text-primary" /> Logs de Impressão</CardTitle>
                    <Button onClick={loadData} variant="outline" size="sm"><RefreshCw className="h-4 w-4 mr-2" /> Atualizar</Button>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b border-border"><th className="text-left p-2">Senha</th><th className="text-left p-2">Status</th><th className="text-left p-2">Método</th><th className="text-left p-2">Erro</th><th className="text-left p-2">Data</th></tr></thead>
                        <tbody>
                          {printLogs.map((log: any) => (
                            <tr key={log.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                              <td className="p-2 font-bold">{log.tickets?.display_number || "—"}</td>
                              <td className="p-2"><Badge variant={log.status === "success" ? "default" : "destructive"}>{log.status}</Badge></td>
                              <td className="p-2">{log.print_method || "—"}</td>
                              <td className="p-2 text-destructive text-xs">{log.error_message || "—"}</td>
                              <td className="p-2">{new Date(log.created_at).toLocaleString("pt-BR")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {printLogs.length === 0 && <p className="text-center py-8 text-muted-foreground">Nenhum log</p>}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

function TicketPreview({ layout, config }: { layout: TicketLayout; config: PrintConfig }) {
  const fontSizeMap = { normal: "text-2xl", large: "text-4xl", giant: "text-6xl" };
  const alignClass = layout.alignment === "center" ? "text-center" : "text-left";
  return (
    <div className={`font-mono space-y-1 ${alignClass}`} style={{ lineHeight: layout.lineSpacing + 0.4 }}>
      {layout.clinicName && <p className="font-bold text-sm">{layout.clinicName}</p>}
      {layout.header && <p className="text-xs text-muted-foreground">{layout.header}</p>}
      <div className="border-t border-dashed border-border my-2" />
      <p className="text-xs font-bold">SENHA</p>
      <p className={`${fontSizeMap[layout.fontSize]} font-black text-primary tracking-wider`}>N0001</p>
      <p className="text-xs">Tipo: Normal</p>
      {layout.showDateTime && <p className="text-xs">Data: {new Date().toLocaleString("pt-BR")}</p>}
      {config.printName && <p className="text-xs">Nome: João da Silva</p>}
      {config.printCpf && <p className="text-xs">CPF: 000.000.000-00</p>}
      {layout.customMessage && <p className="text-xs mt-1">{layout.customMessage}</p>}
      <div className="border-t border-dashed border-border my-2" />
      {config.printQrCode && <div className="flex justify-center my-2"><div className="w-16 h-16 border-2 border-border flex items-center justify-center text-xs text-muted-foreground">QR Code</div></div>}
      {layout.footer && <p className="text-xs">{layout.footer}</p>}
      {layout.lgpdNotice && <p className="text-[8px] text-muted-foreground mt-1">{layout.lgpdNotice}</p>}
    </div>
  );
}

export default Admin;
