import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getLicense, getPayments, getPixImage, getBoletoPdf, getStoredConfig } from "@/services/licenseApi";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, RefreshCw, QrCode, FileText, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface LicenseContextType {
  license: any | null;
  payments: any[];
  summary: any | null;
  isBlocked: boolean;
  blockReason: string;
  inadimplente: boolean;
  diasTolerancia: number;
  isConfigured: boolean;
  checkLicense: () => Promise<void>;
}

const LicenseContext = createContext<LicenseContextType>({
  license: null, payments: [], summary: null, isBlocked: false,
  blockReason: '', inadimplente: false, diasTolerancia: 5,
  isConfigured: false, checkLicense: async () => {},
});

export const useLicense = () => useContext(LicenseContext);

export function LicenseProvider({ children }: { children: React.ReactNode }) {
  const [license, setLicense] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [inadimplente, setInadimplente] = useState(false);
  const [diasTolerancia, setDiasTolerancia] = useState(5);
  const [isConfigured, setIsConfigured] = useState(false);
  const [overduePayments, setOverduePayments] = useState<any[]>([]);
  const [pixData, setPixData] = useState<{ imageUrl: string; pixCode: string | null } | null>(null);
  const [pixLoading, setPixLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);

  const checkLicense = useCallback(async () => {
    const config = getStoredConfig();
    if (!config.apiKey || !config.activationKey) {
      setIsConfigured(false);
      return;
    }
    setIsConfigured(true);
    setDiasTolerancia(config.toleranciaDiasAtraso);
    setChecking(true);

    try {
      const [licRes, payRes] = await Promise.all([
        getLicense(config.activationKey),
        getPayments(config.activationKey),
      ]);

      const lic = licRes.license;
      setLicense(lic);
      setPayments(payRes.payments || []);
      setSummary(payRes.summary || null);

      // Check inadimplência
      const now = new Date();
      const overdue = (payRes.payments || []).filter((p: any) => {
        if (p.status !== 'overdue') return false;
        const due = new Date(p.due_date);
        const diffDays = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays > config.toleranciaDiasAtraso;
      });

      setOverduePayments(overdue);
      const isInadimplente = overdue.length > 0;
      setInadimplente(isInadimplente);

      if (lic?.status === 'expired') {
        setIsBlocked(true);
        setBlockReason('Sua licença expirou');
      } else if (lic?.status === 'suspended') {
        setIsBlocked(true);
        setBlockReason('Sua licença está suspensa');
      } else if (isInadimplente) {
        setIsBlocked(true);
        setBlockReason(`Sistema bloqueado por inadimplência. Pagamentos vencidos há mais de ${config.toleranciaDiasAtraso} dias. Regularize para continuar.`);
      } else {
        setIsBlocked(false);
        setBlockReason('');
      }
    } catch (err: any) {
      console.error('[License] check failed:', err);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkLicense();
    const interval = setInterval(checkLicense, 60 * 60 * 1000); // 1 hour
    return () => clearInterval(interval);
  }, [checkLicense]);

  const handlePix = async (paymentId: string) => {
    const config = getStoredConfig();
    setPixLoading(true);
    try {
      const data = await getPixImage(paymentId, config.activationKey);
      setPixData(data);
    } catch { toast.error("Falha ao gerar PIX"); }
    finally { setPixLoading(false); }
  };

  const handleBoleto = async (paymentId: string) => {
    const config = getStoredConfig();
    try {
      const url = await getBoletoPdf(paymentId, config.activationKey);
      window.open(url, '_blank');
    } catch { toast.error("Falha ao gerar boleto"); }
  };

  const handleCopyPix = () => {
    if (pixData?.pixCode) {
      navigator.clipboard.writeText(pixData.pixCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Código PIX copiado!");
    }
  };

  return (
    <LicenseContext.Provider value={{ license, payments, summary, isBlocked, blockReason, inadimplente, diasTolerancia, isConfigured, checkLicense }}>
      {children}

      {/* Blocking Modal */}
      <Dialog open={isBlocked} onOpenChange={() => {}}>
        <DialogContent className="max-w-lg [&>button]:hidden" onPointerDownOutside={e => e.preventDefault()} onEscapeKeyDown={e => e.preventDefault()}>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-xl font-bold text-foreground text-center">Sistema Bloqueado</h2>
            <p className="text-muted-foreground text-center text-sm">{blockReason}</p>

            {inadimplente && overduePayments.length > 0 && (
              <div className="w-full space-y-2 mt-2">
                <p className="text-sm font-semibold text-foreground">Pagamentos vencidos:</p>
                {overduePayments.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">R$ {Number(p.amount).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">Venc: {new Date(p.due_date).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => handlePix(p.id)} disabled={pixLoading}>
                        <QrCode className="h-3 w-3 mr-1" /> PIX
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleBoleto(p.id)}>
                        <FileText className="h-3 w-3 mr-1" /> Boleto
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {pixData && (
              <div className="w-full bg-card border border-border rounded-lg p-4 flex flex-col items-center gap-2">
                <img src={pixData.imageUrl} alt="QR Code PIX" className="w-48 h-48" />
                {pixData.pixCode && (
                  <Button variant="outline" size="sm" onClick={handleCopyPix}>
                    {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                    {copied ? "Copiado!" : "Copiar código PIX"}
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setPixData(null)}>Fechar</Button>
              </div>
            )}

            <Button onClick={checkLicense} disabled={checking} className="w-full mt-2">
              <RefreshCw className={`h-4 w-4 mr-2 ${checking ? 'animate-spin' : ''}`} />
              Verificar Novamente
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </LicenseContext.Provider>
  );
}
