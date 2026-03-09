import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getTickets, getTicketMessages, sendMessage, createTicket, getStoredConfig } from "@/services/licenseApi";
import { useAuth } from "@/hooks/use-auth";
import { Navigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Send, Plus, MessageSquare, Headphones } from "lucide-react";

const Suporte = () => {
  const { user, loading: authLoading } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [newPriority, setNewPriority] = useState('normal');
  const [creating, setCreating] = useState(false);
  const messagesEnd = useRef<HTMLDivElement>(null);

  useEffect(() => { loadTickets(); }, []);

  useEffect(() => {
    if (!selectedTicket) return;
    loadMessages(selectedTicket.id);
    const interval = setInterval(() => loadMessages(selectedTicket.id), 5000);
    return () => clearInterval(interval);
  }, [selectedTicket?.id]);

  useEffect(() => { messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const loadTickets = async () => {
    const config = getStoredConfig();
    if (!config.activationKey) return;
    try {
      const res = await getTickets(config.activationKey);
      setTickets(res.tickets || []);
    } catch { }
  };

  const loadMessages = async (ticketId: string) => {
    try {
      const res = await getTicketMessages(ticketId);
      setMessages(res.messages || []);
    } catch { }
  };

  const handleSend = async () => {
    if (!newMsg.trim() || !selectedTicket) return;
    const config = getStoredConfig();
    setSending(true);
    try {
      await sendMessage(selectedTicket.id, config.activationKey, newMsg);
      setNewMsg('');
      loadMessages(selectedTicket.id);
    } catch { toast.error("Falha ao enviar"); }
    finally { setSending(false); }
  };

  const handleCreate = async () => {
    if (!newSubject.trim() || !newMessage.trim()) return;
    const config = getStoredConfig();
    setCreating(true);
    try {
      await createTicket(config.activationKey, newSubject, newMessage, newPriority);
      toast.success("Ticket criado!");
      setNewTicketOpen(false);
      setNewSubject(''); setNewMessage(''); setNewPriority('normal');
      loadTickets();
    } catch { toast.error("Falha ao criar ticket"); }
    finally { setCreating(false); }
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><p>Carregando...</p></div>;
  if (!user) return <Navigate to="/login" />;

  const statusColor = (s: string) => s === 'open' ? 'default' : s === 'closed' ? 'secondary' : 'outline';

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Headphones className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold text-card-foreground">Suporte</h1>
          </div>
          <div className="flex gap-2">
            <Dialog open={newTicketOpen} onOpenChange={setNewTicketOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Ticket</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo Ticket</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Assunto</Label><Input value={newSubject} onChange={e => setNewSubject(e.target.value)} /></div>
                  <div><Label>Mensagem</Label><Textarea value={newMessage} onChange={e => setNewMessage(e.target.value)} rows={4} /></div>
                  <div><Label>Prioridade</Label>
                    <Select value={newPriority} onValueChange={setNewPriority}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Baixa</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="urgent">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleCreate} disabled={creating} className="w-full">{creating ? "Criando..." : "Criar Ticket"}</Button>
                </div>
              </DialogContent>
            </Dialog>
            <Link to="/admin"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button></Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-10rem)]">
          {/* Ticket List */}
          <Card className="lg:col-span-1 overflow-hidden flex flex-col">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Tickets</CardTitle></CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-2 space-y-1">
              {tickets.map(t => (
                <button key={t.id} onClick={() => setSelectedTicket(t)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${selectedTicket?.id === t.id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground truncate">{t.subject}</span>
                    <Badge variant={statusColor(t.status)} className="text-[10px] ml-1">{t.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString('pt-BR')}</p>
                </button>
              ))}
              {tickets.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">Nenhum ticket</p>}
            </CardContent>
          </Card>

          {/* Chat */}
          <Card className="lg:col-span-2 overflow-hidden flex flex-col">
            {selectedTicket ? (
              <>
                <CardHeader className="pb-2 border-b border-border">
                  <CardTitle className="text-sm">{selectedTicket.subject}</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.map((m: any) => {
                    const isClient = m.sender_type === 'client';
                    return (
                      <div key={m.id} className={`flex ${isClient ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${isClient ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                          <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                          <p className={`text-[10px] mt-1 ${isClient ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                            {new Date(m.created_at).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEnd} />
                </CardContent>
                <div className="p-3 border-t border-border flex gap-2">
                  <Input value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder="Digite sua mensagem..."
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()} />
                  <Button onClick={handleSend} disabled={sending || !newMsg.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Selecione um ticket para ver as mensagens</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Suporte;
