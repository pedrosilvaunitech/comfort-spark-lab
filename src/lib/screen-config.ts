import { getSystemConfig } from "@/lib/ticket-service";

export interface ScreenConfig {
  // General
  systemName: string;
  logoUrl: string;
  faviconUrl: string;
  
  // Totem
  totemTitle: string;
  totemSubtitle: string;
  totemBgColor: string;
  totemTextColor: string;
  
  // Panel
  panelBgColor: string;
  panelTextColor: string;
  panelTicketColor: string;
  panelShowLogo: boolean;
  panelTitle: string;
  
  // Counter
  counterShowLogo: boolean;
  counterTitle: string;
}

export const defaultScreenConfig: ScreenConfig = {
  systemName: "Sistema de Senhas",
  logoUrl: "",
  faviconUrl: "",
  
  totemTitle: "Sistema de Senhas",
  totemSubtitle: "Toque para retirar sua senha",
  totemBgColor: "",
  totemTextColor: "",
  
  panelBgColor: "",
  panelTextColor: "",
  panelTicketColor: "",
  panelShowLogo: false,
  panelTitle: "",
  
  counterShowLogo: false,
  counterTitle: "Painel do Guichê",
};

export async function loadScreenConfig(): Promise<ScreenConfig> {
  const data = await getSystemConfig("screen_config");
  if (data) return { ...defaultScreenConfig, ...(data as unknown as ScreenConfig) };
  return defaultScreenConfig;
}
