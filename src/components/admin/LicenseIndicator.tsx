import { useLicense } from "@/contexts/LicenseContext";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Shield, AlertTriangle, Bell, DollarSign, Headphones, Key } from "lucide-react";

export function LicenseIndicator() {
  const { license, isConfigured, inadimplente, isBlocked, payments } = useLicense();

  if (!isConfigured) {
    return (
      <Link to="/license-settings">
        <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
          <Key className="h-4 w-4" />
          <span className="text-xs hidden md:inline">Licença</span>
        </Button>
      </Link>
    );
  }

  const openTickets = 0; // Would need tickets from context if needed
  const daysRemaining = license?.days_remaining;
  const isExpiring = daysRemaining != null && daysRemaining <= 30 && daysRemaining > 0;

  const licenseVariant = license?.status === 'active' && !isExpiring
    ? 'default' : 'destructive';
  const licenseLabel = !license ? '?' : license.status === 'active'
    ? (isExpiring ? `${daysRemaining}d` : 'Ativa') : license.status === 'expired' ? 'Expirada' : license.status;

  return (
    <div className="flex items-center gap-1">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1 p-1.5">
            <Shield className="h-4 w-4" />
            <Badge variant={licenseVariant} className="text-[10px] px-1.5 py-0">
              {licenseLabel}
            </Badge>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-3 space-y-2" align="end">
          <p className="text-sm font-semibold text-foreground">Licença</p>
          {license && (
            <>
              <p className="text-xs text-muted-foreground">{license.company_name}</p>
              <p className="text-xs text-muted-foreground">Status: {license.status}</p>
              {daysRemaining != null && <p className="text-xs text-muted-foreground">{daysRemaining} dias restantes</p>}
            </>
          )}
          <div className="flex flex-col gap-1 pt-1">
            <Link to="/financeiro"><Button variant="outline" size="sm" className="w-full justify-start text-xs"><DollarSign className="h-3 w-3 mr-1" /> Financeiro</Button></Link>
            <Link to="/suporte"><Button variant="outline" size="sm" className="w-full justify-start text-xs"><Headphones className="h-3 w-3 mr-1" /> Suporte</Button></Link>
            <Link to="/license-settings"><Button variant="outline" size="sm" className="w-full justify-start text-xs"><Key className="h-3 w-3 mr-1" /> Configuração</Button></Link>
          </div>
        </PopoverContent>
      </Popover>

      {inadimplente && (
        <Badge variant="destructive" className="animate-pulse text-[10px] px-1.5 py-0">
          <AlertTriangle className="h-3 w-3 mr-0.5" /> Inadimplente
        </Badge>
      )}
    </div>
  );
}
