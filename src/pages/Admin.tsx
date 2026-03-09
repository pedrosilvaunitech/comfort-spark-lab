import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "sonner";
import { Link, Navigate } from "react-router-dom";
import {
  Printer, Settings, FileText, History, RefreshCw, Save, TestTube,
  LayoutTemplate, Users, Monitor, BarChart3, LogOut, Trash2, Volume2, ListOrdered, Tablet, Palette,
} from "lucide-react";

const Admin = () => {
  const { user, loading: authLoading, isAdmin, isGestor, signOut } = useAuth();
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
      called_at: null, completed_at: null, operator_id: null,
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

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><p>Carregando...</p></div>;
  if (!user) return <Navigate to="/login" />;
  if (!isAdmin && !isGestor) return <div className="min-h-screen flex items-center justify-center"><p className="text-destructive">Acesso restrito a administradores e gestores</p></div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold text-card-foreground">Administração</h1>
          </div>
          <div className="flex gap-2">
            {isAdmin && <Button variant="destructive" size="sm" onClick={async () => {
              if (!confirm("Tem certeza que deseja ZERAR TUDO? Isso cancelará todas as senhas (fila, chamadas e atendimentos) e reiniciará a sequência numérica do dia.")) return;
              try { await resetCalledTickets(); loadData(); toast.success("Sistema zerado! Sequência reiniciada."); }
              catch { toast.error("Erro ao zerar senhas"); }
            }}><Trash2 className="h-4 w-4 mr-1" />Zerar Tudo</Button>}
            <Link to="/totem"><Button variant="outline" size="sm">Totem</Button></Link>
            <Link to="/panel"><Button variant="outline" size="sm">Painel</Button></Link>
            <Link to="/counter"><Button variant="outline" size="sm">Guichê</Button></Link>
            <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6">
        <Tabs defaultValue="queue" className="space-y-6">
          <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-11' : 'grid-cols-2'}`}>
            <TabsTrigger value="queue" className="gap-1 text-xs"><ListOrdered className="h-3 w-3" /> Fila</TabsTrigger>
            {isAdmin && <TabsTrigger value="counters" className="gap-1 text-xs"><Monitor className="h-3 w-3" /> Guichês</TabsTrigger>}
            {isAdmin && <TabsTrigger value="services" className="gap-1 text-xs"><FileText className="h-3 w-3" /> Serviços</TabsTrigger>}
            {isAdmin && <TabsTrigger value="users" className="gap-1 text-xs"><Users className="h-3 w-3" /> Usuários</TabsTrigger>}
            {isAdmin && <TabsTrigger value="totem" className="gap-1 text-xs"><Tablet className="h-3 w-3" /> Totem</TabsTrigger>}
            {isAdmin && <TabsTrigger value="screens" className="gap-1 text-xs"><Palette className="h-3 w-3" /> Telas</TabsTrigger>}
            {isAdmin && <TabsTrigger value="printer" className="gap-1 text-xs"><Printer className="h-3 w-3" /> Impressora</TabsTrigger>}
            {isAdmin && <TabsTrigger value="layout" className="gap-1 text-xs"><LayoutTemplate className="h-3 w-3" /> Layout</TabsTrigger>}
            {isAdmin && <TabsTrigger value="voice" className="gap-1 text-xs"><Volume2 className="h-3 w-3" /> Voz</TabsTrigger>}
            <TabsTrigger value="reports" className="gap-1 text-xs"><BarChart3 className="h-3 w-3" /> Relatórios</TabsTrigger>
            {isAdmin && <TabsTrigger value="logs" className="gap-1 text-xs"><History className="h-3 w-3" /> Logs</TabsTrigger>}
          </TabsList>

          <TabsContent value="queue"><QueueManagement /></TabsContent>
          {isAdmin && <TabsContent value="counters"><CounterManagement /></TabsContent>}
          {isAdmin && <TabsContent value="services"><ServiceTypeManagement /></TabsContent>}
          {isAdmin && <TabsContent value="users"><UserManagement /></TabsContent>}
          {isAdmin && <TabsContent value="totem"><TotemConfig /></TabsContent>}
          {isAdmin && <TabsContent value="screens"><ScreenConfigPanel /></TabsContent>}
          {isAdmin && <TabsContent value="voice"><VoiceConfig /></TabsContent>}
          <TabsContent value="reports"><Reports /></TabsContent>

          {/* PRINTER CONFIG */}
          <TabsContent value="printer">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle>Configuração da Impressora</CardTitle><CardDescription>Configure a conexão com a impressora térmica</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between"><Label>Ativar impressão automática</Label><Switch checked={printerConfig.enabled} onCheckedChange={(v) => setPrinterConfig({ ...printerConfig, enabled: v })} /></div>
                  <div><Label>Tipo de Conexão</Label><Select value={printerConfig.connectionType} onValueChange={(v: any) => setPrinterConfig({ ...printerConfig, connectionType: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="network">Rede (IP)</SelectItem><SelectItem value="usb">USB</SelectItem><SelectItem value="serial">Serial</SelectItem></SelectContent></Select></div>
                  {printerConfig.connectionType === "network" && (<div className="space-y-3"><div><Label>IP</Label><Input value={printerConfig.ip} onChange={(e) => setPrinterConfig({ ...printerConfig, ip: e.target.value })} /></div><div><Label>Porta</Label><Input type="number" value={printerConfig.port} onChange={(e) => setPrinterConfig({ ...printerConfig, port: Number(e.target.value) })} /></div></div>)}
                  {printerConfig.connectionType === "usb" && (<div className="space-y-3"><div><Label>Vendor ID</Label><Input value={printerConfig.usbVendorId} onChange={(e) => setPrinterConfig({ ...printerConfig, usbVendorId: e.target.value })} /></div><div><Label>Product ID</Label><Input value={printerConfig.usbProductId} onChange={(e) => setPrinterConfig({ ...printerConfig, usbProductId: e.target.value })} /></div></div>)}
                  {printerConfig.connectionType === "serial" && (<div className="space-y-3"><div><Label>Porta COM</Label><Input value={printerConfig.serialPort} onChange={(e) => setPrinterConfig({ ...printerConfig, serialPort: e.target.value })} /></div><div><Label>Baudrate</Label><Input type="number" value={printerConfig.serialBaudrate} onChange={(e) => setPrinterConfig({ ...printerConfig, serialBaudrate: Number(e.target.value) })} /></div></div>)}
                  <div><Label>Papel</Label><Select value={printerConfig.paperSize} onValueChange={(v: any) => setPrinterConfig({ ...printerConfig, paperSize: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="58mm">58mm</SelectItem><SelectItem value="80mm">80mm</SelectItem></SelectContent></Select></div>
                  <div><Label>Modo</Label><Select value={printerConfig.printMode} onValueChange={(v: any) => setPrinterConfig({ ...printerConfig, printMode: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fast">Rápido</SelectItem><SelectItem value="detailed">Detalhado</SelectItem></SelectContent></Select></div>
                  <Button onClick={handleSavePrinter} disabled={saving} className="w-full"><Save className="h-4 w-4 mr-2" />{saving ? "Salvando..." : "Salvar"}</Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Opções</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {[{ label: "Corte automático", key: "autoCut" },{ label: "QR Code", key: "printQrCode" },{ label: "Logo", key: "printLogo" },{ label: "CPF", key: "printCpf" },{ label: "Nome", key: "printName" }].map(({ label, key }) => (<div key={key} className="flex items-center justify-between"><Label>{label}</Label><Switch checked={(printerConfig as any)[key]} onCheckedChange={(v) => setPrinterConfig({ ...printerConfig, [key]: v })} /></div>))}
                  <div className="border-t border-border pt-4 space-y-2">
                    <p className="text-sm font-semibold text-muted-foreground">Testar</p>
                    <Button onClick={() => handleTestPrint("browser")} variant="outline" className="w-full"><TestTube className="h-4 w-4 mr-2" />Navegador</Button>
                    <Button onClick={() => handleTestPrint("print_server")} variant="outline" className="w-full"><TestTube className="h-4 w-4 mr-2" />Print Server</Button>
                    <Button onClick={() => handleTestPrint("cloud")} variant="outline" className="w-full"><TestTube className="h-4 w-4 mr-2" />Cloud</Button>
                  </div>
                  {pendingPrints.length > 0 && (<div className="border-t border-border pt-4"><Button onClick={handleReprocessPending} variant="outline" className="w-full"><RefreshCw className="h-4 w-4 mr-2" />Reprocessar {pendingPrints.length} Pendente(s)</Button></div>)}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* LAYOUT CONFIG */}
          <TabsContent value="layout">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle>Personalizar Ticket</CardTitle></CardHeader>
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
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Pré-visualização</CardTitle></CardHeader>
                <CardContent>
                  <div className="border-2 border-dashed border-border rounded-lg p-4 bg-card">
                    <TicketPreview layout={layoutConfig} config={printerConfig} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* HISTORY */}
          <TabsContent value="logs">
            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle>Senhas de Hoje ({todayTickets.length})</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-border"><th className="text-left p-2">Senha</th><th className="text-left p-2">Tipo</th><th className="text-left p-2">Status</th><th className="text-left p-2">Nome</th><th className="text-left p-2">Guichê</th><th className="text-left p-2">Hora</th><th className="text-left p-2">Ações</th></tr></thead>
                      <tbody>
                        {todayTickets.map((t: any) => (
                          <tr key={t.id} className="border-b border-border">
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
                  <CardTitle>Logs de Impressão</CardTitle>
                  <Button onClick={loadData} variant="outline" size="sm"><RefreshCw className="h-4 w-4 mr-2" /> Atualizar</Button>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-border"><th className="text-left p-2">Senha</th><th className="text-left p-2">Status</th><th className="text-left p-2">Método</th><th className="text-left p-2">Erro</th><th className="text-left p-2">Data</th></tr></thead>
                      <tbody>
                        {printLogs.map((log: any) => (
                          <tr key={log.id} className="border-b border-border">
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
          </TabsContent>
        </Tabs>
      </main>
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
