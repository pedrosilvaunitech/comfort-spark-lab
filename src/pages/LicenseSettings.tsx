import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { getConfigFromServer, saveKeysToServer, type LicenseConfig } from "@/services/licenseApi";
import { useLicense } from "@/contexts/LicenseContext";
import { useAuth } from "@/hooks/use-auth";
import { Navigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Save, TestTube, ArrowLeft, Shield, Building2, Calendar, Key, DollarSign } from "lucide-react";

const LicenseSettings = () => {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const { license, checkLicense } = useLicense();
  const [config, setConfig] = useState<LicenseConfig>({ apiKey: '', activationKey: '', toleranciaDiasAtraso: 5 });
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  useEffect(() => {
    getConfigFromServer().then(cfg => {
      setConfig(prev => ({ ...prev, toleranciaDiasAtraso: cfg.tolerancia_dias }));
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save tolerance locally
      saveConfigLocal(config);
      // Save keys to server (secure)
      const result = await saveKeysToServer(config.apiKey, config.activationKey);
      if (result.license) setTestResult(result.license);
      toast.success("Configuração salva com segurança!");
      checkLicense();
    } catch (err: any) {
      toast.error(err.message || "Falha ao salvar");
    } finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // Save keys first then test via proxy
      const result = await saveKeysToServer(config.apiKey, config.activationKey);
      saveConfigLocal(config);
      if (result.license) {
        setTestResult(result.license);
        toast.success("Conexão OK!");
      } else if (result.warning) {
        toast.warning(result.warning);
      }
    } catch (err: any) {
      toast.error(err.message || "Falha na conexão");
      setTestResult(null);
    } finally { setTesting(false); }
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><p>Carregando...</p></div>;
  if (!user) return <Navigate to="/login" />;
  if (!isAdmin) return <div className="min-h-screen flex items-center justify-center"><p className="text-destructive">Acesso restrito a administradores</p></div>;

  const displayLicense = testResult || license;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Key className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold text-card-foreground">Configuração de Licença</h1>
          </div>
          <Link to="/admin"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button></Link>
        </div>
      </header>

      <main className="container mx-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Credenciais</CardTitle>
            <CardDescription>As chaves são armazenadas com segurança no servidor</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div><Label>API Key</Label><Input type="password" value={config.apiKey} onChange={e => setConfig({ ...config, apiKey: e.target.value })} placeholder="Sua API Key" /></div>
            <div><Label>Chave de Ativação</Label><Input type="password" value={config.activationKey} onChange={e => setConfig({ ...config, activationKey: e.target.value })} placeholder="Sua chave de ativação" /></div>
            <div><Label>Tolerância de Atraso (dias)</Label><Input type="number" min={0} value={config.toleranciaDiasAtraso} onChange={e => setConfig({ ...config, toleranciaDiasAtraso: Number(e.target.value) })} /></div>
            <div className="flex gap-2">
              <Button onClick={handleTest} disabled={testing || !config.apiKey || !config.activationKey} variant="outline" className="flex-1">
                <TestTube className="h-4 w-4 mr-2" />{testing ? "Testando..." : "Testar Conexão"}
              </Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                <Save className="h-4 w-4 mr-2" />{saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">🔒 As chaves são enviadas ao servidor e nunca ficam expostas no navegador.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Status da Licença</CardTitle></CardHeader>
          <CardContent>
            {displayLicense ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{displayLicense.company_name || displayLicense.companyName || displayLicense.name || '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">CNPJ: {displayLicense.cnpj || displayLicense.document || '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Validade: {
                    (displayLicense.expires_at || displayLicense.expiresAt || displayLicense.expiry_date || displayLicense.valid_until)
                      ? new Date(displayLicense.expires_at || displayLicense.expiresAt || displayLicense.expiry_date || displayLicense.valid_until).toLocaleDateString('pt-BR')
                      : '—'
                  }</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">Status:</span>
                  <Badge variant={displayLicense.status === 'active' ? 'default' : 'destructive'}>
                    {displayLicense.status === 'active' ? 'Ativa' : displayLicense.status === 'expired' ? 'Expirada' : displayLicense.status === 'suspended' ? 'Suspensa' : displayLicense.status || '—'}
                  </Badge>
                </div>
                {(displayLicense.days_remaining != null || displayLicense.daysRemaining != null) && (
                  <p className="text-sm text-muted-foreground">{displayLicense.days_remaining ?? displayLicense.daysRemaining} dias restantes</p>
                )}
                {displayLicense.plan && <p className="text-sm text-muted-foreground">Plano: {displayLicense.plan}</p>}

                <div className="border-t border-border pt-3 mt-3">
                  <Link to="/financeiro"><Button variant="outline" className="w-full"><DollarSign className="h-4 w-4 mr-2" /> Ver Pagamentos / Financeiro</Button></Link>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Configure e teste a conexão para ver o status</p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default LicenseSettings;
