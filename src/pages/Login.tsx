import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { LogIn } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedCounterId, setSelectedCounterId] = useState("");
  const [counters, setCounters] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase
      .from("counters")
      .select("*")
      .eq("is_active", true)
      .order("number")
      .then(({ data }) => setCounters(data || []));
  }, []);

  const isCounterOccupied = (counter: any) => {
    return !!counter.operator_name && !!counter.current_ticket_id;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCounterId) {
      toast.error("Selecione o guichê");
      return;
    }
    setLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Atualiza o guichê com o nome do operador
      const user = authData.user;
      await supabase
        .from("counters")
        .update({ operator_name: user?.user_metadata?.full_name || user?.email })
        .eq("id", selectedCounterId);

      toast.success("Login realizado!");
      navigate("/counter", { state: { counterId: selectedCounterId } });
    } catch (err: any) {
      toast.error(err.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <LogIn className="h-5 w-5" /> Login do Atendente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div>
              <Label>Guichê</Label>
              <Select value={selectedCounterId} onValueChange={setSelectedCounterId}>
                <SelectTrigger><SelectValue placeholder="Selecione o guichê" /></SelectTrigger>
                <SelectContent>
                {counters.map((c) => (
                    <SelectItem key={c.id} value={c.id} disabled={isCounterOccupied(c)}>
                      #{c.number} — {c.name} {isCounterOccupied(c) ? `(Ocupado: ${c.operator_name})` : "(Livre)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={loading || !selectedCounterId} className="w-full">
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
