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
    <main className="min-h-screen min-h-[100dvh] bg-background flex flex-col items-center justify-center p-[4vw]">
      <header className="text-center mb-[4vh]">
        
        <h1 className="text-[clamp(1.5rem,4vw,3rem)] font-bold text-foreground mb-2">
          UniSistemas
        </h1>
        <p className="text-muted-foreground text-[clamp(0.9rem,1.5vw,1.3rem)]">
          Sistema de Gerenciamento de Filas
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-[clamp(1rem,2vw,2rem)] w-full max-w-[min(40rem,90vw)]">
        {pages.map((page) => (
          <Link key={page.path} to={page.path}>
            <Card className="h-full transition-all duration-200 hover:scale-[1.02] hover:shadow-lg cursor-pointer border-2 border-transparent hover:border-primary">
              <CardContent className="flex flex-col items-center text-center p-[clamp(1.5rem,3vw,3rem)] gap-[1vh]">
                <div className="text-primary">{page.icon}</div>
                <h2 className="text-[clamp(1rem,2vw,1.5rem)] font-bold text-card-foreground">{page.title}</h2>
                <p className="text-[clamp(0.75rem,1.2vw,1rem)] text-muted-foreground">{page.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
};

export default Index;
