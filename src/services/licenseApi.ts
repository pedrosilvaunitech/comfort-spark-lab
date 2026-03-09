import { supabase } from "@/integrations/supabase/client";

const LICENSE_CONFIG_KEY = 'license_config';

export interface LicenseConfig {
  apiKey: string;
  activationKey: string;
  toleranciaDiasAtraso: number;
}

export function getStoredConfig(): LicenseConfig {
  try {
    const stored = localStorage.getItem(LICENSE_CONFIG_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return { apiKey: '', activationKey: '', toleranciaDiasAtraso: 5 };
}

export function saveConfig(config: LicenseConfig) {
  localStorage.setItem(LICENSE_CONFIG_KEY, JSON.stringify(config));
}

async function proxyRequest<T>(body: Record<string, any>): Promise<T> {
  const config = getStoredConfig();
  if (!config.apiKey || !config.activationKey) throw new Error('Licença não configurada');

  const { data, error } = await supabase.functions.invoke('license-proxy', {
    body: {
      api_key: config.apiKey,
      activation_key: config.activationKey,
      ...body,
    },
  });

  if (error) throw new Error(error.message || 'Falha na requisição');
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export async function getLicense(activationKey?: string) {
  const config = getStoredConfig();
  return proxyRequest<{ license: any }>({
    action: 'get_license',
    activation_key: activationKey || config.activationKey,
  });
}

export async function getPayments(activationKey?: string) {
  const config = getStoredConfig();
  return proxyRequest<{ payments: any[]; summary: any }>({
    action: 'get_payments',
    activation_key: activationKey || config.activationKey,
  });
}

export async function getPixImage(paymentId: string, activationKey?: string): Promise<{ imageUrl: string; pixCode: string | null }> {
  const config = getStoredConfig();
  try {
    const data = await proxyRequest<any>({
      action: 'get_pix',
      payment_id: paymentId,
      activation_key: activationKey || config.activationKey,
    });

    // Handle base64 binary response from proxy
    if (data.data_base64) {
      const binary = atob(data.data_base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const ct = data.content_type || 'image/png';
      const blob = new Blob([bytes], { type: ct });
      return { imageUrl: URL.createObjectURL(blob), pixCode: data.pix_copia_e_cola || null };
    }

    // Handle JSON with URL/base64
    const imageUrl = data.qr_code_url || data.qrCodeUrl || data.image_url || data.imageUrl || '';
    const pixCode = data.pix_code || data.pixCode || data.copy_paste || data.pix_copia_e_cola || null;
    if (imageUrl) return { imageUrl, pixCode };
    if (data.qr_code_base64 || data.qrCodeBase64 || data.image) {
      const b64 = data.qr_code_base64 || data.qrCodeBase64 || data.image;
      return { imageUrl: `data:image/png;base64,${b64}`, pixCode };
    }

    throw new Error('Resposta da API não contém dados do PIX');
  } catch (err: any) {
    console.error('[PIX] Error:', err);
    throw err;
  }
}

export async function getBoletoPdf(paymentId: string, activationKey?: string): Promise<string> {
  const config = getStoredConfig();
  try {
    const data = await proxyRequest<any>({
      action: 'get_boleto',
      payment_id: paymentId,
      activation_key: activationKey || config.activationKey,
    });

    // Handle base64 binary response
    if (data.data_base64) {
      const binary = atob(data.data_base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: data.content_type || 'application/pdf' });
      return URL.createObjectURL(blob);
    }

    // Handle JSON with URL
    const url = data.boleto_url || data.boletoUrl || data.pdf_url || data.pdfUrl || data.url || '';
    if (url) return url;

    throw new Error('Resposta da API não contém dados do boleto');
  } catch (err: any) {
    console.error('[Boleto] Error:', err);
    throw err;
  }
}

export async function createTicket(activationKey: string, subject: string, message: string, priority = 'normal') {
  return proxyRequest({ action: 'create_ticket', activation_key: activationKey, subject, message, priority });
}

export async function getTickets(activationKey?: string) {
  const config = getStoredConfig();
  return proxyRequest<{ tickets: any[] }>({ action: 'get_tickets', activation_key: activationKey || config.activationKey });
}

export async function getTicketMessages(ticketId: string) {
  return proxyRequest<{ messages: any[] }>({ action: 'get_ticket_messages', ticket_id: ticketId });
}

export async function sendMessage(ticketId: string, activationKey: string, message: string) {
  return proxyRequest({ action: 'send_message', ticket_id: ticketId, activation_key: activationKey, message });
}
