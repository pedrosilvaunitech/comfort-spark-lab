import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { LogIn, Shield, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedCounterId, setSelectedCounterId] = useState("");
  const [counters, setCounters] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasAdmin, setHasAdmin] = useState(true);
  const [step, setStep] = useState<"credentials" | "counter">("credentials");
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [loggedUser, setLoggedUser] = useState<any>(null);
  const navigate = useNavigate();

  // Check if any admin exists
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const { data, error } = await supabase.rpc("admin_exists");
        if (!error) {
          setHasAdmin(!!data);
        }
      } catch {
        // If error, assume admin exists (safe default)
      } finally {
        setChecking(false);
      }
    };
    checkAdmin();

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

  // Create first admin user — works offline without Edge Functions
  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Senha deve ter no mínimo 6 caracteres");
      return;
    }
    setLoading(true);
    try {
      // 1. Create user via standard signUp (auto-confirm enabled)
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (signUpError) throw signUpError;

      const newUser = signUpData.user;
      if (!newUser) throw new Error("Falha ao criar usuário");

      // 2. Assign admin role via SECURITY DEFINER function (bypasses RLS)
      const { error: rpcError } = await supabase.rpc("setup_first_admin", {
        _user_id: newUser.id,
      });
      if (rpcError) throw rpcError;

      toast.success("Administrador criado! Fazendo login...");

      // 3. Auto-login
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) {
        toast.success("Admin criado! Faça login.");
        setHasAdmin(true);
        setEmail("");
        setPassword("");
        setFullName("");
      } else {
        navigate("/admin");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar admin");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const user = authData.user;
      setLoggedUser(user);

      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const roles = rolesData?.map((r) => r.role) || [];
      setUserRoles(roles);

      const isAdmin = roles.includes("admin");
      const isOperator = roles.includes("operator");

      if (isAdmin && !isOperator) {
        toast.success("Login realizado!");
        navigate("/admin");
      } else if (isOperator || isAdmin) {
        setStep("counter");
      } else {
        toast.error("Usuário sem permissão de acesso");
        await supabase.auth.signOut();
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCounter = async () => {
    if (!selectedCounterId) {
      toast.error("Selecione o guichê");
      return;
    }
    setLoading(true);
    try {
      await supabase
        .from("counters")
        .update({ operator_name: loggedUser?.user_metadata?.full_name || loggedUser?.email })
        .eq("id", selectedCounterId);

      toast.success("Login realizado!");
      navigate("/counter", { state: { counterId: selectedCounterId } });
    } catch (err: any) {
      toast.error(err.message || "Erro ao selecionar guichê");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // First user registration (no admin exists yet)
  if (!hasAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
            <img src="/logo.png" alt="UniTechBR" className="h-16 mx-auto mb-2 object-contain" />
            <CardTitle>Configuração Inicial</CardTitle>
            <CardDescription>Crie o primeiro administrador do sistema</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
    </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative">
      <Link to="/" className="absolute top-4 left-4">
        <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Início</Button>
      </Link>
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <LogIn className="h-5 w-5" />
            {step === "credentials" ? "Login" : "Selecione o Guichê"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {step === "credentials" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Bem-vindo! Selecione seu guichê para iniciar o atendimento.
              </p>
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
              {userRoles.includes("admin") && (
                <Button variant="outline" className="w-full" onClick={() => navigate("/admin")}>
                  Ir para Administração
                </Button>
              )}
              <Button onClick={handleSelectCounter} disabled={loading || !selectedCounterId} className="w-full">
                {loading ? "Entrando..." : "Iniciar Atendimento"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
