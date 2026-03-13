import { useRealtimeTickets } from "@/hooks/use-realtime-tickets";
import { useEffect, useRef, useState, useCallback } from "react";
import { getSystemConfig } from "@/lib/ticket-service";
import { type VoiceSettings, defaultVoiceSettings, formatPrefixForSpeech, formatNumberForSpeech } from "@/components/admin/VoiceConfig";
import { useScreenConfig } from "@/hooks/use-screen-config";
import { Volume2 } from "lucide-react";

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

// ============ SPEECH QUEUE (never cuts ongoing speech) ============
type SpeechJob = {
  text: string;
  settings: VoiceSettings;
};

const speechQueue: SpeechJob[] = [];
let isSpeaking = false;

async function processSpeechQueue() {
  if (isSpeaking) return;
  const job = speechQueue.shift();
  if (!job) return;

  isSpeaking = true;
  const { text, settings } = job;

  try {
    // Cancel any stuck speech
    speechSynthesis.cancel();
    await new Promise((r) => setTimeout(r, 100));

    if (settings.beepEnabled) await playBeep();

    for (let i = 0; i < settings.repeatCount; i++) {
      await new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "pt-BR";
        utterance.rate = settings.rate;
        utterance.pitch = settings.pitch;
        const voice = findVoice(settings);
        if (voice) utterance.voice = voice;
        
        // Safety timeout in case onend never fires
        const safetyTimeout = setTimeout(() => {
          console.warn("[Panel] Speech safety timeout fired");
          resolve();
        }, 15000);
        
        utterance.onend = () => { clearTimeout(safetyTimeout); resolve(); };
        utterance.onerror = (e) => { 
          clearTimeout(safetyTimeout);
          console.error("[Panel] Speech error:", e);
          resolve(); 
        };
        
        console.log("[Panel] Speaking:", text);
        speechSynthesis.speak(utterance);
      });
      if (i < settings.repeatCount - 1) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    const delayMs = ((settings.delayBetween ?? 2) * 1000);
    if (delayMs > 0 && speechQueue.length > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  } catch (err) {
    console.error("[Panel] Speech queue error:", err);
  } finally {
    isSpeaking = false;
    processSpeechQueue();
  }
}

function enqueueSpeech(text: string, settings: VoiceSettings) {
  console.log("[Panel] Enqueuing speech:", text);
  speechQueue.push({ text, settings });
  processSpeechQueue();
}

function buildSpeechText(displayNumber: string, counterName: string, settings: VoiceSettings): string {
  const spokenPrefix = formatPrefixForSpeech(settings);
  const spokenNumber = formatNumberForSpeech(displayNumber, settings);
  
  let text = settings.template;
  
  if (text.includes("{prefixo}")) {
    text = text.replace("{prefixo}", spokenPrefix).replace("{senha}", spokenNumber);
  } else {
    const fullSpoken = spokenPrefix ? `${spokenPrefix} ${spokenNumber}` : spokenNumber;
    text = text.replace("{senha}", fullSpoken);
  }
  
  return text.replace("{guiche}", counterName).replace(/\s+/g, " ").trim();
}

// ============ AUDIO ACTIVATION SCREEN ============
function AudioActivation({ onActivated }: { onActivated: () => void }) {
  const handleActivate = useCallback(() => {
    try {
      // Unlock AudioContext
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.01, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.01);
      
      // Unlock speechSynthesis with a real user gesture
      const u = new SpeechSynthesisUtterance(".");
      u.volume = 0.01;
      u.rate = 10;
      u.lang = "pt-BR";
      speechSynthesis.speak(u);
      
      // Load voices
      speechSynthesis.getVoices();
    } catch (e) {
      console.warn("[Panel] Audio unlock partial failure:", e);
    }
    
    onActivated();
  }, [onActivated]);

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center bg-[#1e3a5f]">
      <div className="text-center space-y-8">
        <Volume2 className="w-24 h-24 text-white/80 mx-auto animate-pulse" />
        <h1 className="text-4xl font-bold text-white">Painel de Chamadas</h1>
        <p className="text-xl text-white/70 max-w-md">
          Clique no botão abaixo para ativar o áudio do painel
        </p>
        <button
          onClick={handleActivate}
          className="px-12 py-6 bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold text-2xl rounded-2xl shadow-lg transition-all hover:scale-105 active:scale-95"
        >
          🔊 Ativar Áudio e Iniciar
        </button>
      </div>
    </div>
  );
}

// ============ MAIN PANEL ============
const Panel = () => {
  const [audioActivated, setAudioActivated] = useState(false);
  const { calledTickets, lastCalled } = useRealtimeTickets();
  const lastCalledKeyRef = useRef<string | null>(null);
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const voiceSettingsRef = useRef<VoiceSettings>(defaultVoiceSettings);
  const { config: screenConfig } = useScreenConfig();

  useEffect(() => {
    getSystemConfig("voice_settings").then((data) => {
      if (data) voiceSettingsRef.current = { ...defaultVoiceSettings, ...(data as unknown as VoiceSettings) };
    });
  }, []);

  useEffect(() => {
    const loadVoices = () => {
      const voices = speechSynthesis.getVoices();
      if (voices.length > 0) {
        setVoicesLoaded(true);
        console.log("[Panel] Voices loaded:", voices.length);
      }
    };
    loadVoices();
    speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  // Keep speechSynthesis alive (Chrome pauses it after ~15s of inactivity)
  useEffect(() => {
    if (!audioActivated) return;
    const keepAlive = setInterval(() => {
      if (!speechSynthesis.speaking) {
        speechSynthesis.cancel(); // prevent queue buildup
      }
    }, 10000);
    return () => clearInterval(keepAlive);
  }, [audioActivated]);

  useEffect(() => {
    if (!audioActivated) return;
    
    const calledKey = lastCalled ? `${lastCalled.id}_${(lastCalled as any).called_at}` : null;
    console.log("[Panel] lastCalled changed:", calledKey, "prev:", lastCalledKeyRef.current);
    
    if (lastCalled && calledKey && calledKey !== lastCalledKeyRef.current) {
      lastCalledKeyRef.current = calledKey;
      const counterName = (lastCalled as any).counters?.name || "guichê";
      const customText = (lastCalled as any).custom_voice_text;
      const settings = voiceSettingsRef.current;

      if (customText && customText.trim().length > 0) {
        enqueueSpeech(customText, settings);
      } else {
        const text = buildSpeechText(lastCalled.display_number, counterName, settings);
        enqueueSpeech(text, settings);
      }
    }
  }, [lastCalled, voicesLoaded, audioActivated]);

  if (!audioActivated) {
    return <AudioActivation onActivated={() => setAudioActivated(true)} />;
  }

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

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col relative bg-[#1e3a5f]" style={{ ...bgStyle, ...fontStyle }}>
      {/* Botão voltar discreto */}
      <a href="/" className="absolute top-2 left-2 z-50 opacity-30 hover:opacity-100 transition-opacity p-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="m15 18-6-6 6-6"/></svg>
      </a>
      {/* Header with logo/title */}
      {(screenConfig.panelShowLogo && screenConfig.logoUrl) || screenConfig.panelTitle ? (
        <div className="flex items-center justify-center gap-4 py-[1.5vh] px-[2vw]" style={headerBgStyle}>
          {screenConfig.panelShowLogo && screenConfig.logoUrl && (
            <img src={screenConfig.logoUrl} alt="Logo" className="object-contain" style={{ height: `${logoSize}vh` }} />
          )}
          {screenConfig.panelTitle && (
            <h1 className="text-[2.5vw] font-bold text-white" style={{ ...textStyle, ...fontStyle }}>
              {screenConfig.panelTitle}
            </h1>
          )}
        </div>
      ) : null}

      <div className="flex-1 flex flex-col items-center justify-center px-[3vw] py-[2vh]">
        {currentCalled ? (
          <div className={`text-center ${lastCalled?.id === currentCalled.id ? "animate-flash-call" : ""}`}>
            <p className="text-[clamp(1rem,3vw,2.5rem)] font-semibold text-white/80 italic mb-[1vh]" style={textStyle ? { ...textStyle, opacity: 0.8 } : {}}>
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
                <p className="text-[clamp(1.5rem,5vw,5rem)] font-bold text-white" style={textStyle}>
                  {getCounterName(currentCalled)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-[clamp(1.5rem,4vw,4rem)] text-white/60 font-semibold" style={textStyle ? { ...textStyle, opacity: 0.6 } : {}}>
            Aguardando chamada...
          </p>
        )}
      </div>

      <div className="border-t-4 border-white/20" style={{ ...footerBgStyle, ...(Object.keys(footerBgStyle).length === 0 ? { backgroundColor: 'rgba(0,0,0,0.15)' } : {}) }}>
        <div className="grid grid-cols-4 divide-x divide-white/20">
          {recentCalled.length > 0
            ? recentCalled.map((t: any) => (
                <div key={t.id} className="flex flex-col items-center justify-center py-[2vh] px-[1vw]">
                  <span className="text-[clamp(2rem,5vw,6rem)] font-black text-white tracking-wider" style={footerTextStyle.color ? footerTextStyle : textStyle}>
                    {t.display_number}
                  </span>
                  <span className="text-[clamp(0.8rem,1.5vw,1.5rem)] font-semibold text-white/70 mt-[0.5vh]" style={footerTextStyle.color ? { ...footerTextStyle, opacity: 0.7 } : textStyle ? { ...textStyle, opacity: 0.7 } : {}}>
                    {t.counters?.name || "Guichê"}
                  </span>
                </div>
              ))
            : Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-center py-[2vh] px-[1vw]">
                  <span className="text-[clamp(1.5rem,3vw,3rem)] text-white/30" style={footerTextStyle.color ? { ...footerTextStyle, opacity: 0.3 } : textStyle ? { ...textStyle, opacity: 0.3 } : {}}>—</span>
                </div>
              ))}
        </div>
      </div>
    </div>
  );
};

export default Panel;
