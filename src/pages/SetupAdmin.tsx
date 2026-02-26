import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";

const SetupAdmin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("setup-admin", {
        body: { email, password, full_name: fullName },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Administrador criado! Faça login.");
      setDone(true);
      setTimeout(() => navigate("/login"), 2000);
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar admin");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Shield className="h-8 w-8 mx-auto text-primary mb-2" />
          <CardTitle>Configuração Inicial</CardTitle>
          <CardDescription>Crie o primeiro administrador do sistema</CardDescription>
        </CardHeader>
        <CardContent>
          {done ? (
            <p className="text-center text-green-600 font-medium">✅ Admin criado! Redirecionando...</p>
          ) : (
            <form onSubmit={handleSetup} className="space-y-4">
              <div>
                <Label>Nome completo</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Administrador" required />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@clinica.com" required />
              </div>
              <div>
                <Label>Senha</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Criando..." : "Criar Administrador"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SetupAdmin;
