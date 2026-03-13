import { useRealtimeTickets } from "@/hooks/use-realtime-tickets";
import { useEffect, useRef, useState } from "react";
import { getSystemConfig } from "@/lib/ticket-service";
import { type VoiceSettings, defaultVoiceSettings, formatPrefixForSpeech, formatNumberForSpeech } from "@/components/admin/VoiceConfig";
import { useScreenConfig } from "@/hooks/use-screen-config";

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
  if (settings.voiceName) {
    const selected = voices.find((v) => v.name === settings.voiceName);
    if (selected) return selected;
  }
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
  
  let text = settings.template;
  
  if (text.includes("{prefixo}")) {
    text = text.replace("{prefixo}", spokenPrefix).replace("{senha}", spokenNumber);
  } else {
    const fullSpoken = spokenPrefix ? `${spokenPrefix} ${spokenNumber}` : spokenNumber;
    text = text.replace("{senha}", fullSpoken);
  }
  
  text = text.replace("{guiche}", counterName).replace(/\s+/g, " ").trim();

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
  const lastCalledKeyRef = useRef<string | null>(null);
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const voiceSettingsRef = useRef<VoiceSettings>(defaultVoiceSettings);
  const { config: screenConfig } = useScreenConfig();

  const unlockAudio = () => {
    // Create and immediately close an AudioContext to unlock audio
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      osc.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.001);
      // Also unlock speechSynthesis
      const u = new SpeechSynthesisUtterance("");
      u.volume = 0;
      speechSynthesis.speak(u);
    } catch {}
    setAudioUnlocked(true);
  };

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
    const calledKey = lastCalled ? `${lastCalled.id}_${(lastCalled as any).called_at}` : null;
    if (lastCalled && calledKey !== lastCalledKeyRef.current) {
      lastCalledKeyRef.current = calledKey;
      const counterName = (lastCalled as any).counters?.name || "guichê";
      const customText = (lastCalled as any).custom_voice_text;
      if (customText && customText.trim().length > 0) {
        speechSynthesis.cancel();
        const settings = voiceSettingsRef.current;
        const doSpeak = async () => {
          if (settings.beepEnabled) await playBeep();
          for (let i = 0; i < settings.repeatCount; i++) {
            await new Promise<void>((resolve) => {
              const u = new SpeechSynthesisUtterance(customText);
              u.lang = "pt-BR";
              u.rate = settings.rate;
              u.pitch = settings.pitch;
              const voice = findVoice(settings);
              if (voice) u.voice = voice;
              u.onend = () => resolve();
              u.onerror = () => resolve();
              speechSynthesis.speak(u);
            });
            if (i < settings.repeatCount - 1) await new Promise((r) => setTimeout(r, 1000));
          }
        };
        doSpeak();
      } else {
        speakTicket(lastCalled.display_number, counterName, voiceSettingsRef.current);
      }
    }
  }, [lastCalled, voicesLoaded]);

  const currentCalled = calledTickets[0];
  const recentCalled = calledTickets.slice(1, 5);

  const getServiceTypeName = (ticket: any) => ticket?.service_types?.name || "Convencional";
  const getCounterName = (ticket: any) => ticket?.counters?.name || "Guichê";

  const bgStyle = screenConfig.panelBgColor ? { backgroundColor: screenConfig.panelBgColor } : {};
  const textStyle = screenConfig.panelTextColor ? { color: screenConfig.panelTextColor } : {};
  const ticketColorStyle = screenConfig.panelTicketColor ? { color: screenConfig.panelTicketColor } : {};
  const fontStyle = screenConfig.panelFontFamily ? { fontFamily: screenConfig.panelFontFamily } : {};
  const headerBgStyle = screenConfig.panelHeaderBgColor ? { backgroundColor: screenConfig.panelHeaderBgColor } : {};
  const footerBgStyle = screenConfig.panelFooterBgColor ? { backgroundColor: screenConfig.panelFooterBgColor } : {};
  const footerTextStyle = screenConfig.panelFooterTextColor ? { color: screenConfig.panelFooterTextColor } : {};
  const logoSize = screenConfig.panelLogoSize || "5";

  if (!audioUnlocked) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-primary flex flex-col items-center justify-center" style={{ ...bgStyle, ...fontStyle }}>
        <button
          onClick={unlockAudio}
          className="px-12 py-8 bg-white/20 hover:bg-white/30 rounded-2xl transition-colors cursor-pointer border-2 border-white/40"
        >
          <p className="text-[clamp(2rem,5vw,5rem)] font-bold text-primary-foreground" style={textStyle}>
            🔊
          </p>
          <p className="text-[clamp(1rem,2vw,2rem)] font-semibold text-primary-foreground mt-4" style={textStyle}>
            Toque para ativar o áudio
          </p>
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col relative" style={{ backgroundColor: bgStyle.backgroundColor || '#1e3a5f', ...fontStyle }}>
      {/* Botão voltar discreto */}
      <a href="/" className="absolute top-2 left-2 z-50 opacity-30 hover:opacity-100 transition-opacity p-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-foreground"><path d="m15 18-6-6 6-6"/></svg>
      </a>
      {/* Header with logo/title */}
      {(screenConfig.panelShowLogo && screenConfig.logoUrl) || screenConfig.panelTitle ? (
        <div className="flex items-center justify-center gap-4 py-[1.5vh] px-[2vw]" style={headerBgStyle}>
          {screenConfig.panelShowLogo && screenConfig.logoUrl && (
            <img src={screenConfig.logoUrl} alt="Logo" className="object-contain" style={{ height: `${logoSize}vh` }} />
          )}
          {screenConfig.panelTitle && (
            <h1 className="text-[2.5vw] font-bold text-primary-foreground" style={{ ...textStyle, ...fontStyle }}>
              {screenConfig.panelTitle}
            </h1>
          )}
        </div>
      ) : null}

      <div className="flex-1 flex flex-col items-center justify-center px-[3vw] py-[2vh]">
        {currentCalled ? (
          <div className={`text-center ${lastCalled?.id === currentCalled.id ? "animate-flash-call" : ""}`}>
            <p className="text-[clamp(1rem,3vw,2.5rem)] font-semibold text-primary-foreground/80 italic mb-[1vh]" style={textStyle ? { ...textStyle, opacity: 0.8 } : {}}>
              {getServiceTypeName(currentCalled)}
            </p>
            <div className="flex items-center justify-center gap-[3vw]">
              <span
                className="text-[clamp(4rem,15vw,20rem)] font-black text-warning leading-none tracking-wider"
                style={ticketColorStyle}
              >
                {currentCalled.display_number}
              </span>
              <div className="text-right">
                <p className="text-[clamp(1.5rem,5vw,5rem)] font-bold text-primary-foreground" style={textStyle}>
                  {getCounterName(currentCalled)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-[clamp(1.5rem,4vw,4rem)] text-primary-foreground/60 font-semibold" style={textStyle ? { ...textStyle, opacity: 0.6 } : {}}>
            Aguardando chamada...
          </p>
        )}
      </div>

      <div className="border-t-4 border-primary-foreground/20" style={{ ...footerBgStyle, ...(Object.keys(footerBgStyle).length === 0 ? { backgroundColor: 'rgba(0,0,0,0.15)' } : {}) }}>
        <div className="grid grid-cols-4 divide-x divide-primary-foreground/20">
          {recentCalled.length > 0
            ? recentCalled.map((t: any) => (
                <div key={t.id} className="flex flex-col items-center justify-center py-[2vh] px-[1vw]">
                  <span className="text-[clamp(2rem,5vw,6rem)] font-black text-primary-foreground tracking-wider" style={footerTextStyle.color ? footerTextStyle : textStyle}>
                    {t.display_number}
                  </span>
                  <span className="text-[clamp(0.8rem,1.5vw,1.5rem)] font-semibold text-primary-foreground/70 mt-[0.5vh]" style={footerTextStyle.color ? { ...footerTextStyle, opacity: 0.7 } : textStyle ? { ...textStyle, opacity: 0.7 } : {}}>
                    {t.counters?.name || "Guichê"}
                  </span>
                </div>
              ))
            : Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-center py-[2vh] px-[1vw]">
                  <span className="text-[clamp(1.5rem,3vw,3rem)] text-primary-foreground/30" style={footerTextStyle.color ? { ...footerTextStyle, opacity: 0.3 } : textStyle ? { ...textStyle, opacity: 0.3 } : {}}>—</span>
                </div>
              ))}
        </div>
      </div>
    </div>
  );
};

export default Panel;
