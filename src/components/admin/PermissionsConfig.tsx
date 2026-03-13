import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RolePermissions {
  [role: string]: string[];
}

const ALL_PAGES = [
  { id: "totem", label: "Totem", description: "Tela de emissão de senhas" },
  { id: "panel", label: "Painel", description: "Painel de chamadas" },
  { id: "counter", label: "Guichê", description: "Tela de atendimento" },
  { id: "admin", label: "Administração", description: "Painel administrativo completo" },
  { id: "financeiro", label: "Financeiro", description: "Módulo financeiro" },
  { id: "suporte", label: "Suporte", description: "Página de suporte" },
  { id: "reports", label: "Relatórios", description: "Relatórios e métricas" },
];

const ROLES = [
  { id: "admin", label: "Administrador", color: "bg-red-500" },
  { id: "gestor", label: "Gestor", color: "bg-blue-500" },
  { id: "operator", label: "Operador", color: "bg-green-500" },
];

const DEFAULT_PERMISSIONS: RolePermissions = {
  admin: ["totem", "panel", "counter", "admin", "financeiro", "suporte", "reports"],
  gestor: ["panel", "counter", "admin", "financeiro", "suporte", "reports"],
  operator: ["counter"],
};

export function PermissionsConfig() {
  const [permissions, setPermissions] = useState<RolePermissions>(DEFAULT_PERMISSIONS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    const { data } = await supabase
      .from("system_config")
      .select("value")
      .eq("key", "role_permissions")
      .maybeSingle();
    if (data?.value) {
      setPermissions({ ...DEFAULT_PERMISSIONS, ...(data.value as unknown as RolePermissions) });
    }
  };

  const togglePermission = (role: string, page: string) => {
    // Admin always has all permissions
    if (role === "admin") return;
    
    setPermissions(prev => {
      const rolePerms = [...(prev[role] || [])];
      const idx = rolePerms.indexOf(page);
      if (idx >= 0) rolePerms.splice(idx, 1);
      else rolePerms.push(page);
      return { ...prev, [role]: rolePerms };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await supabase.from("system_config").upsert(
        { key: "role_permissions", value: permissions as any },
        { onConflict: "key" }
      );
      toast.success("Permissões salvas com sucesso!");
    } catch {
      toast.error("Erro ao salvar permissões");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Permissões por Cargo
          </CardTitle>
          <CardDescription>
            Defina quais páginas cada cargo pode acessar. O Administrador sempre tem acesso total.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 text-foreground font-medium">Página</th>
                  {ROLES.map(role => (
                    <th key={role.id} className="text-center p-3">
                      <Badge className={`${role.color} text-white`}>{role.label}</Badge>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALL_PAGES.map(page => (
                  <tr key={page.id} className="border-b border-border hover:bg-muted/50">
                    <td className="p-3">
                      <div>
                        <p className="font-medium text-foreground">{page.label}</p>
                        <p className="text-xs text-muted-foreground">{page.description}</p>
                      </div>
                    </td>
                    {ROLES.map(role => (
                      <td key={role.id} className="p-3 text-center">
                        <Switch
                          checked={permissions[role.id]?.includes(page.id) || false}
                          onCheckedChange={() => togglePermission(role.id, page.id)}
                          disabled={role.id === "admin"}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
        <Save className="h-4 w-4 mr-2" />
        {saving ? "Salvando..." : "Salvar Permissões"}
      </Button>
    </div>
  );
}
