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
  totemButtonBgColor: string;
  totemButtonTextColor: string;
  totemButtonRadius: string;
  totemFontFamily: string;
  totemLogoSize: string;
  totemShowLogo: boolean;
  
  // Panel
  panelBgColor: string;
  panelTextColor: string;
  panelTicketColor: string;
  panelShowLogo: boolean;
  panelTitle: string;
  panelFontFamily: string;
  panelHeaderBgColor: string;
  panelFooterBgColor: string;
  panelFooterTextColor: string;
  panelLogoSize: string;
  
  // Counter
  counterShowLogo: boolean;
  counterTitle: string;
  counterBgColor: string;
  counterTextColor: string;
  counterHeaderBgColor: string;
  counterHeaderTextColor: string;
  counterFontFamily: string;
  counterButtonBgColor: string;
  counterButtonTextColor: string;
}

export const defaultScreenConfig: ScreenConfig = {
  systemName: "Sistema de Senhas",
  logoUrl: "",
  faviconUrl: "",
  
  totemTitle: "Sistema de Senhas",
  totemSubtitle: "Toque para retirar sua senha",
  totemBgColor: "",
  totemTextColor: "",
  totemButtonBgColor: "",
  totemButtonTextColor: "",
  totemButtonRadius: "12",
  totemFontFamily: "",
  totemLogoSize: "8",
  totemShowLogo: true,
  
  panelBgColor: "",
  panelTextColor: "",
  panelTicketColor: "",
  panelShowLogo: false,
  panelTitle: "",
  panelFontFamily: "",
  panelHeaderBgColor: "",
  panelFooterBgColor: "",
  panelFooterTextColor: "",
  panelLogoSize: "5",
  
  counterShowLogo: false,
  counterTitle: "Painel do Guichê",
  counterBgColor: "",
  counterTextColor: "",
  counterHeaderBgColor: "",
  counterHeaderTextColor: "",
  counterFontFamily: "",
  counterButtonBgColor: "",
  counterButtonTextColor: "",
};

export async function loadScreenConfig(): Promise<ScreenConfig> {
  const data = await getSystemConfig("screen_config");
  if (data) return { ...defaultScreenConfig, ...(data as unknown as ScreenConfig) };
  return defaultScreenConfig;
}
