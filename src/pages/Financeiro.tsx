import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLicense } from "@/contexts/LicenseContext";
import { getPixImage, getBoletoPdf, getStoredConfig } from "@/services/licenseApi";
import { useAuth } from "@/hooks/use-auth";
import { Navigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, QrCode, FileText, Copy, Check, AlertTriangle, RefreshCw, DollarSign, Clock, CheckCircle } from "lucide-react";

const Financeiro = () => {
  const { user, loading: authLoading } = useAuth();
  const { payments, summary, inadimplente, diasTolerancia, checkLicense, isConfigured } = useLicense();
  const [pixData, setPixData] = useState<{ imageUrl: string; pixCode: string | null } | null>(null);
  const [pixLoading, setPixLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><p>Carregando...</p></div>;
  if (!user) return <Navigate to="/login" />;

  const handlePix = async (paymentId: string) => {
    const config = getStoredConfig();
    if (!config.apiKey || !config.activationKey) {
      toast.error("Licença não configurada");
      return;
    }
    if (!paymentId || paymentId.startsWith('unknown')) {
      toast.error("ID do pagamento não encontrado. Verifique os dados da API.");
      console.error('[Financeiro] Payment ID inválido. Payments disponíveis:', JSON.stringify(payments.slice(0, 2)));
      return;
    }
    setPixLoading(paymentId);
    try {
      console.log('[Financeiro] Gerando PIX para payment:', paymentId);
      const data = await getPixImage(paymentId, config.activationKey);
      console.log('[Financeiro] PIX data received:', data);
      setPixData(data);
    } catch (err: any) {
      console.error('[Financeiro] PIX error:', err);
      toast.error(err.message || "Falha ao gerar PIX");
    } finally {
      setPixLoading(null);
    }
  };

  const handleBoleto = async (paymentId: string) => {
    const config = getStoredConfig();
    if (!config.apiKey || !config.activationKey) {
      toast.error("Licença não configurada");
      return;
    }
    try {
      console.log('[Financeiro] Gerando boleto para payment:', paymentId);
      const url = await getBoletoPdf(paymentId, config.activationKey);
      console.log('[Financeiro] Boleto URL:', url);
      window.open(url, '_blank');
    } catch (err: any) {
      console.error('[Financeiro] Boleto error:', err);
      toast.error(err.message || "Falha ao gerar boleto");
    }
  };

  const handleCopyPix = () => {
    if (pixData?.pixCode) {
      navigator.clipboard.writeText(pixData.pixCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Código PIX copiado!");
    }
  };

  const statusColor = (s: string) => {
    if (s === 'paid') return 'default';
    if (s === 'overdue') return 'destructive';
    return 'secondary';
  };

  const statusLabel = (s: string) => {
    if (s === 'paid') return 'Pago';
    if (s === 'overdue') return 'Vencido';
    if (s === 'pending') return 'Pendente';
    return s;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DollarSign className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold text-card-foreground">Financeiro</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => checkLicense()}><RefreshCw className="h-4 w-4 mr-1" /> Atualizar</Button>
            <Link to="/admin"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button></Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6 space-y-6">
        {!isConfigured && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">Licença não configurada. <Link to="/license-settings" className="text-primary underline">Configurar agora</Link></p>
            </CardContent>
          </Card>
        )}

        {inadimplente && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="p-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <p className="text-sm text-destructive font-medium">Inadimplente — pagamentos vencidos há mais de {diasTolerancia} dias</p>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-yellow-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><Clock className="h-4 w-4 text-yellow-500" /><span className="text-sm text-muted-foreground">Total Pendente</span></div>
              <p className="text-2xl font-bold text-foreground">R$ {summary?.total_pending?.toFixed(2) || '0.00'}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-destructive">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><AlertTriangle className="h-4 w-4 text-destructive" /><span className="text-sm text-muted-foreground">Total Vencido</span></div>
              <p className="text-2xl font-bold text-foreground">R$ {summary?.total_overdue?.toFixed(2) || '0.00'}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><CheckCircle className="h-4 w-4 text-green-500" /><span className="text-sm text-muted-foreground">Total Pago</span></div>
              <p className="text-2xl font-bold text-foreground">R$ {summary?.total_paid?.toFixed(2) || '0.00'}</p>
            </CardContent>
          </Card>
        </div>

        {/* Payments Table */}
        <Card>
          <CardHeader><CardTitle>Pagamentos</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border">
                  <th className="text-left p-2">Período</th>
                  <th className="text-left p-2">Vencimento</th>
                  <th className="text-left p-2">Valor</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Ações</th>
                </tr></thead>
                <tbody>
                  {payments.map((p: any, idx: number) => {
                    const paymentId = p.id || p.payment_id || p.paymentId || `unknown-${idx}`;
                    return (
                    <tr key={paymentId} className="border-b border-border">
                      <td className="p-2">{p.reference_period || p.description || '—'}</td>
                      <td className="p-2">{(p.due_date || p.dueDate) ? new Date(p.due_date || p.dueDate).toLocaleDateString('pt-BR') : '—'}</td>
                      <td className="p-2 font-medium">R$ {Number(p.amount || p.value || 0).toFixed(2)}</td>
                      <td className="p-2"><Badge variant={statusColor(p.status)}>{statusLabel(p.status)}</Badge></td>
                      <td className="p-2">
                        {(p.status === 'pending' || p.status === 'overdue') && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => { console.log('[Financeiro] PIX click, paymentId:', paymentId, 'full payment:', p); handlePix(paymentId); }} disabled={pixLoading === paymentId}>
                              <QrCode className="h-3 w-3 mr-1" /> PIX
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { console.log('[Financeiro] Boleto click, paymentId:', paymentId, 'full payment:', p); handleBoleto(paymentId); }}>
                              <FileText className="h-3 w-3 mr-1" /> Boleto
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
              {payments.length === 0 && <p className="text-center py-8 text-muted-foreground">Nenhum pagamento encontrado</p>}
            </div>
          </CardContent>
        </Card>

        {/* PIX Modal */}
        <Dialog open={!!pixData} onOpenChange={() => setPixData(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>QR Code PIX</DialogTitle></DialogHeader>
            <div className="flex flex-col items-center gap-4">
              {pixData && <img src={pixData.imageUrl} alt="QR Code PIX" className="w-64 h-64" />}
              {pixData?.pixCode && (
                <div className="w-full">
                  <p className="text-xs text-muted-foreground mb-1 break-all">{pixData.pixCode}</p>
                  <Button variant="outline" className="w-full" onClick={handleCopyPix}>
                    {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                    {copied ? "Copiado!" : "Copiar Código PIX"}
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default Financeiro;
