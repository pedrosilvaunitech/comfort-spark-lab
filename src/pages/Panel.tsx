import { useRealtimeTickets } from "@/hooks/use-realtime-tickets";
import { useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";

const Panel = () => {
  const { calledTickets, waitingTickets, lastCalled } = useRealtimeTickets();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastCalledIdRef = useRef<string | null>(null);

  // Play sound when new ticket is called
  useEffect(() => {
    if (lastCalled && lastCalled.id !== lastCalledIdRef.current) {
      lastCalledIdRef.current = lastCalled.id;
      // Use Web Speech API as bell
      try {
        const utterance = new SpeechSynthesisUtterance(
          `Senha ${lastCalled.display_number}, dirija-se ao guichê`
        );
        utterance.lang = "pt-BR";
        utterance.rate = 0.9;
        speechSynthesis.speak(utterance);
      } catch {}
    }
  }, [lastCalled]);

  const currentCalled = calledTickets[0];

  return (
    <div className="min-h-screen bg-primary flex flex-col">
      {/* Header */}
      <header className="bg-card shadow-lg p-4">
        <div className="container mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-card-foreground">
            Painel de Chamadas
          </h1>
          <div className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString("pt-BR", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Current Call - Large */}
        <div className="lg:col-span-2 flex items-center justify-center">
          {currentCalled ? (
            <Card className={`w-full max-w-2xl ${lastCalled?.id === currentCalled.id ? "animate-flash-call" : ""}`}>
              <CardContent className="p-12 text-center space-y-6">
                <p className="text-lg text-muted-foreground uppercase tracking-widest font-semibold">
                  Senha Atual
                </p>
                <div className="text-9xl font-black text-primary tracking-wider">
                  {currentCalled.display_number}
                </div>
                <div className="flex items-center justify-center gap-3">
                  <span className="text-3xl font-bold text-accent">
                    → {(currentCalled as any).counters?.name || "Guichê"}
                  </span>
                </div>
                {currentCalled.patient_name && (
                  <p className="text-xl text-muted-foreground">
                    {currentCalled.patient_name}
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="w-full max-w-2xl">
              <CardContent className="p-12 text-center">
                <p className="text-2xl text-muted-foreground">
                  Aguardando chamada...
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Recent calls + Queue */}
        <div className="space-y-6">
          {/* Recent Calls */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-bold text-card-foreground mb-4 uppercase tracking-wider">
                Últimas Chamadas
              </h2>
              <div className="space-y-3">
                {calledTickets.slice(0, 5).map((t: any) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted"
                  >
                    <span className="text-xl font-bold text-foreground">
                      {t.display_number}
                    </span>
                    <span className="text-sm font-medium text-accent">
                      {t.counters?.name || "—"}
                    </span>
                  </div>
                ))}
                {calledTickets.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma senha chamada
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Queue Count */}
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">
                Na Fila
              </p>
              <p className="text-5xl font-black text-primary">
                {waitingTickets.length}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                senha{waitingTickets.length !== 1 ? "s" : ""} aguardando
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Panel;
