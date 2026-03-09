import { useRealtimeTickets } from "@/hooks/use-realtime-tickets";
import { useEffect, useRef, useState } from "react";
import { getSystemConfig } from "@/lib/ticket-service";
import { type VoiceSettings, defaultVoiceSettings, formatPrefixForSpeech, formatNumberForSpeech } from "@/components/admin/VoiceConfig";

function parseTicketNumber(displayNumber: string): string {
  const prefix = displayNumber.replace(/[0-9]/g, "");
  const num = parseInt(displayNumber.replace(/[^0-9]/g, ""), 10);
  return `${prefix} ${num}`;
}

function playBeep(): Promise<void> {
  return new Promise((resolve) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.frequency.value = 880;
      osc1.type = "sine";
      gain1.gain.setValueAtTime(0.5, audioCtx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc1.start(audioCtx.currentTime);
      osc1.stop(audioCtx.currentTime + 0.3);

      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.frequency.value = 1100;
      osc2.type = "sine";
      gain2.gain.setValueAtTime(0.5, audioCtx.currentTime + 0.35);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.65);
      osc2.start(audioCtx.currentTime + 0.35);
      osc2.stop(audioCtx.currentTime + 0.65);

      setTimeout(resolve, 800);
    } catch {
      resolve();
    }
  });
}

function findVoice(settings: VoiceSettings): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices();
  
  // If a specific voice is configured, use it
  if (settings.voiceName) {
    const selected = voices.find((v) => v.name === settings.voiceName);
    if (selected) return selected;
  }
  
  // Fallback: best pt-BR voice
  const googleVoice = voices.find(
    (v) => v.lang.startsWith("pt") && v.name.toLowerCase().includes("google")
  );
  if (googleVoice) return googleVoice;
  
  const ptVoice = voices.find((v) => v.lang.startsWith("pt-BR"));
  return ptVoice || null;
}

async function speakTicket(displayNumber: string, counterName: string, settings: VoiceSettings) {
  const spokenPrefix = formatPrefixForSpeech(settings);
  const spokenNumber = formatNumberForSpeech(displayNumber, settings);
  const text = settings.template
    .replace("{prefixo}", spokenPrefix)
    .replace("{senha}", spokenNumber)
    .replace("{guiche}", counterName)
    .replace(/\s+/g, " ")
    .trim();

  speechSynthesis.cancel();
  if (settings.beepEnabled) await playBeep();

  const speak = () => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.rate = settings.rate;
    utterance.pitch = settings.pitch;

    const voice = findVoice(settings);
    if (voice) utterance.voice = voice;

    return utterance;
  };

  for (let i = 0; i < settings.repeatCount; i++) {
    await new Promise<void>((resolve) => {
      const u = speak();
      u.onend = () => resolve();
      u.onerror = () => resolve();
      speechSynthesis.speak(u);
    });
    if (i < settings.repeatCount - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

const Panel = () => {
  const { calledTickets, lastCalled } = useRealtimeTickets();
  const lastCalledIdRef = useRef<string | null>(null);
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const voiceSettingsRef = useRef<VoiceSettings>(defaultVoiceSettings);

  useEffect(() => {
    getSystemConfig("voice_settings").then((data) => {
      if (data) voiceSettingsRef.current = { ...defaultVoiceSettings, ...(data as unknown as VoiceSettings) };
    });
  }, []);

  useEffect(() => {
    const loadVoices = () => {
      const voices = speechSynthesis.getVoices();
      if (voices.length > 0) setVoicesLoaded(true);
    };
    loadVoices();
    speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  useEffect(() => {
    if (lastCalled && lastCalled.id !== lastCalledIdRef.current) {
      lastCalledIdRef.current = lastCalled.id;
      const counterName = (lastCalled as any).counters?.name || "guichê";
      speakTicket(lastCalled.display_number, counterName, voiceSettingsRef.current);
    }
  }, [lastCalled, voicesLoaded]);

  const currentCalled = calledTickets[0];
  const recentCalled = calledTickets.slice(1, 5);

  const getServiceTypeName = (ticket: any) => ticket?.service_types?.name || "Convencional";
  const getCounterName = (ticket: any) => ticket?.counters?.name || "Guichê";

  return (
    <div className="min-h-screen bg-primary flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-6">
        {currentCalled ? (
          <div className={`text-center ${lastCalled?.id === currentCalled.id ? "animate-flash-call" : ""}`}>
            <p className="text-2xl md:text-3xl font-semibold text-primary-foreground/80 italic mb-2">
              {getServiceTypeName(currentCalled)}
            </p>
            <div className="flex items-center justify-center gap-6 md:gap-10">
              <span className="text-[8rem] md:text-[12rem] lg:text-[16rem] font-black text-warning leading-none tracking-wider">
                {currentCalled.display_number}
              </span>
              <div className="text-right">
                <p className="text-3xl md:text-5xl lg:text-6xl font-bold text-primary-foreground">
                  {getCounterName(currentCalled)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-3xl md:text-5xl text-primary-foreground/60 font-semibold">
            Aguardando chamada...
          </p>
        )}
      </div>

      <div className="bg-primary/80 border-t-4 border-primary-foreground/20">
        <div className="grid grid-cols-4 divide-x divide-primary-foreground/20">
          {recentCalled.length > 0
            ? recentCalled.map((t: any) => (
                <div key={t.id} className="flex flex-col items-center justify-center py-6 px-2">
                  <span className="text-5xl md:text-7xl font-black text-primary-foreground tracking-wider">
                    {t.display_number}
                  </span>
                  <span className="text-lg md:text-xl font-semibold text-primary-foreground/70 mt-2">
                    {t.counters?.name || "Guichê"}
                  </span>
                </div>
              ))
            : Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-center py-6 px-2">
                  <span className="text-3xl text-primary-foreground/30">—</span>
                </div>
              ))}
        </div>
      </div>
    </div>
  );
};

export default Panel;
