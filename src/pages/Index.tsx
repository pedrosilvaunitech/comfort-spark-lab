import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Monitor, Printer, Settings, Users } from "lucide-react";

const Index = () => {
  const pages = [
    {
      title: "Totem",
      description: "Tela de retirada de senhas para pacientes",
      path: "/totem",
      icon: <Printer className="h-10 w-10" />,
    },
    {
      title: "Painel de Chamadas",
      description: "TV/Monitor que exibe as senhas chamadas",
      path: "/panel",
      icon: <Monitor className="h-10 w-10" />,
    },
    {
      title: "Guichê",
      description: "Interface do atendente para chamar senhas",
      path: "/counter",
      icon: <Users className="h-10 w-10" />,
    },
    {
      title: "Administração",
      description: "Configurações, impressora, logs e histórico",
      path: "/admin",
      icon: <Settings className="h-10 w-10" />,
    },
  ];

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <header className="text-center mb-10">
        <h1 className="text-4xl font-bold text-foreground mb-2">
          Sistema de Senhas
        </h1>
        <p className="text-muted-foreground text-lg">
          Gerenciamento de filas com impressão térmica
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl w-full">
        {pages.map((page) => (
          <Link key={page.path} to={page.path}>
            <Card className="h-full transition-all duration-200 hover:scale-[1.02] hover:shadow-lg cursor-pointer border-2 border-transparent hover:border-primary">
              <CardContent className="flex flex-col items-center text-center p-8 gap-3">
                <div className="text-primary">{page.icon}</div>
                <h2 className="text-xl font-bold text-card-foreground">{page.title}</h2>
                <p className="text-sm text-muted-foreground">{page.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
};

export default Index;
