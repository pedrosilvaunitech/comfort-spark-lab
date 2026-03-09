import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserPlus, Trash2, Pencil, KeyRound } from "lucide-react";

interface UserWithRole {
  id: string;
  full_name: string;
  email: string;
  roles: string[];
}

export function UserManagement() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "operator" | "gestor">("operator");
  const [creating, setCreating] = useState(false);

  // Edit states
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<"admin" | "operator">("operator");
  const [editPassword, setEditPassword] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    const { data: profiles } = await supabase.from("profiles").select("*");
    const { data: allRoles } = await supabase.from("user_roles").select("*");

    const mapped = (profiles || []).map((p) => ({
      id: p.id,
      full_name: p.full_name,
      email: p.email || "",
      roles: (allRoles || []).filter((r) => r.user_id === p.id).map((r) => r.role),
    }));
    setUsers(mapped);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword || !newName) { toast.error("Preencha todos os campos"); return; }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "create", email: newEmail, password: newPassword, full_name: newName, role: newRole },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Usuário criado!");
      setNewName(""); setNewEmail(""); setNewPassword("");
      loadUsers();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar usuário");
    } finally { setCreating(false); }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Tem certeza que deseja remover este usuário?")) return;
    try {
      const { error } = await supabase.functions.invoke("manage-users", { body: { action: "delete", userId } });
      if (error) throw error;
      toast.success("Usuário removido");
      loadUsers();
    } catch (err: any) { toast.error(err.message); }
  };

  const openEdit = (user: UserWithRole) => {
    setEditingUser(user);
    setEditName(user.full_name);
    setEditEmail(user.email);
    setEditRole((user.roles[0] as any) || "operator");
    setEditPassword("");
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    setSaving(true);
    try {
      // Update profile name
      if (editName !== editingUser.full_name) {
        await supabase.from("profiles").update({ full_name: editName }).eq("id", editingUser.id);
      }

      // Update email via edge function
      if (editEmail !== editingUser.email) {
        const { data, error } = await supabase.functions.invoke("manage-users", {
          body: { action: "update_email", userId: editingUser.id, email: editEmail },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        // Also update profile email
        await supabase.from("profiles").update({ email: editEmail }).eq("id", editingUser.id);
      }

      // Update password if provided
      if (editPassword) {
        const { data, error } = await supabase.functions.invoke("manage-users", {
          body: { action: "update_password", userId: editingUser.id, password: editPassword },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      }

      // Update role if changed
      const currentRole = editingUser.roles[0] || "";
      if (editRole !== currentRole) {
        // Delete existing roles
        await supabase.from("user_roles").delete().eq("user_id", editingUser.id);
        // Insert new role
        await supabase.from("user_roles").insert({ user_id: editingUser.id, role: editRole });
      }

      toast.success("Usuário atualizado!");
      setEditOpen(false);
      loadUsers();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar");
    } finally { setSaving(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle>Criar Novo Atendente</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div><Label>Nome completo</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="João da Silva" required /></div>
            <div><Label>Email</Label><Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="joao@clinica.com" required /></div>
            <div><Label>Senha</Label><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required /></div>
            <div>
              <Label>Função</Label>
              <Select value={newRole} onValueChange={(v: any) => setNewRole(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="operator">Atendente</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={creating} className="w-full">
              <UserPlus className="h-4 w-4 mr-2" />{creating ? "Criando..." : "Criar Usuário"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Usuários Cadastrados ({users.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium text-foreground">{u.full_name || "Sem nome"}</p>
                  <p className="text-sm text-muted-foreground">{u.email}</p>
                  <div className="flex gap-1 mt-1">
                    {u.roles.map((r) => (
                      <Badge key={r} variant={r === "admin" ? "default" : "secondary"}>
                        {r === "admin" ? "Admin" : "Atendente"}
                      </Badge>
                    ))}
                    {u.roles.length === 0 && <Badge variant="outline">Sem função</Badge>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(u)} title="Editar">
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDeleteUser(u.id)} title="Remover">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            {users.length === 0 && <p className="text-center text-muted-foreground py-4">Nenhum usuário</p>}
          </div>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Usuário</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome completo</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
            <div><Label>Email</Label><Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} /></div>
            <div>
              <Label>Nova Senha (deixe em branco para manter)</Label>
              <Input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="Nova senha" />
            </div>
            <div>
              <Label>Função</Label>
              <Select value={editRole} onValueChange={(v: any) => setEditRole(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="operator">Atendente</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSaveEdit} disabled={saving} className="w-full">
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
