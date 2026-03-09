import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getLicense, getPayments, getPixImage, getBoletoPdf, getConfigFromServer } from "@/services/licenseApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, RefreshCw, QrCode, FileText, Copy, Check, Key } from "lucide-react";
import { toast } from "sonner";
import { useLocation, useNavigate } from "react-router-dom";

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

// Routes that are ALLOWED even when blocked
const ALLOWED_ROUTES = ['/admin', '/login', '/license-settings', '/financeiro', '/suporte', '/setup'];

function isRouteAllowed(pathname: string): boolean {
  return ALLOWED_ROUTES.some(r => pathname.startsWith(r));
}

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

  const location = useLocation();
  const navigate = useNavigate();

  const checkLicense = useCallback(async () => {
    setChecking(true);

    try {
      // Get config from DB
      const serverConfig = await getConfigFromServer();
      setDiasTolerancia(serverConfig.tolerancia_dias);
      setIsConfigured(serverConfig.configured);

    try {
      if (!serverConfig.configured) {
        setIsConfigured(false);
        setIsBlocked(false);
        return;
      }

      const [licRes, payRes] = await Promise.all([
        getLicense(),
        getPayments(),
      ]);

      const lic = licRes.license;
      setLicense(lic);
      setIsConfigured(true);
      console.log('[License] payments raw:', JSON.stringify(payRes.payments?.slice(0, 2)));
      console.log('[License] summary:', JSON.stringify(payRes.summary));
      setPayments(payRes.payments || []);
      setSummary(payRes.summary || null);

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
      // If keys not configured, mark as not configured
      if (err.message?.includes('não configurada') || err.message?.includes('incompletas')) {
        setIsConfigured(false);
        setIsBlocked(false);
      }
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkLicense();
    const interval = setInterval(checkLicense, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkLicense]);

  // Redirect blocked users away from operational routes
  useEffect(() => {
    if (isBlocked && !isRouteAllowed(location.pathname)) {
      // Don't redirect, just show block screen in place
    }
  }, [isBlocked, location.pathname]);

  const handlePix = async (paymentId: string) => {
    setPixLoading(true);
    try {
      const data = await getPixImage(paymentId);
      setPixData(data);
    } catch { toast.error("Falha ao gerar PIX"); }
    finally { setPixLoading(false); }
  };

  const handleBoleto = async (paymentId: string) => {
    try {
      const url = await getBoletoPdf(paymentId);
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

  // If blocked and on a non-allowed route, render fullscreen block instead of children
  const shouldBlock = isBlocked && !isRouteAllowed(location.pathname);

  return (
    <LicenseContext.Provider value={{ license, payments, summary, isBlocked, blockReason, inadimplente, diasTolerancia, isConfigured, checkLicense }}>
      {shouldBlock ? (
        <div className="fixed inset-0 z-[9999] bg-background flex items-center justify-center p-4">
          <div className="max-w-lg w-full space-y-6">
            <div className="flex flex-col items-center gap-4">
              <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-10 w-10 text-destructive" />
              </div>
              <h1 className="text-2xl font-bold text-foreground text-center">Sistema Bloqueado</h1>
              <p className="text-muted-foreground text-center">{blockReason}</p>
            </div>

            {inadimplente && overduePayments.length > 0 && (
              <div className="space-y-2">
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
              <div className="bg-card border border-border rounded-lg p-4 flex flex-col items-center gap-2">
                <img src={pixData.imageUrl} alt="QR Code PIX" className="w-48 h-48" />
                {pixData.pixCode && (
                  <>
                    <p className="text-xs text-muted-foreground break-all text-center">{pixData.pixCode}</p>
                    <Button variant="outline" size="sm" onClick={handleCopyPix}>
                      {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                      {copied ? "Copiado!" : "Copiar código PIX"}
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="sm" onClick={() => setPixData(null)}>Fechar</Button>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Button onClick={() => { checkLicense(); }} disabled={checking} className="w-full">
                <RefreshCw className={`h-4 w-4 mr-2 ${checking ? 'animate-spin' : ''}`} />
                Verificar Novamente
              </Button>
              <Button variant="outline" onClick={() => navigate('/license-settings')} className="w-full">
                <Key className="h-4 w-4 mr-2" /> Configuração de Licença
              </Button>
              <Button variant="outline" onClick={() => navigate('/financeiro')} className="w-full">
                <FileText className="h-4 w-4 mr-2" /> Ir para Financeiro
              </Button>
              <Button variant="ghost" onClick={() => navigate('/admin')} className="w-full text-xs">
                Painel Admin
              </Button>
            </div>
          </div>
        </div>
      ) : children}
    </LicenseContext.Provider>
  );
}
