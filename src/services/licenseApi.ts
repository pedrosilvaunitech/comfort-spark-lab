import { supabase } from "@/integrations/supabase/client";

export interface LicenseConfig {
  apiKey: string;
  activationKey: string;
  toleranciaDiasAtraso: number;
}

// Client NEVER sends keys - proxy reads from DB
async function proxyRequest<T>(body: Record<string, any>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('license-proxy', {
    body,
  });

  if (error) throw new Error(error.message || 'Falha na requisição');
  if (data?.not_configured) throw new Error('Chaves de licença não configuradas no sistema');
  if (data?.error) throw new Error(data.error);
  return data as T;
}

// Get config status from DB (no keys exposed)
export async function getConfigFromServer(): Promise<{ configured: boolean; tolerancia_dias: number }> {
  try {
    const { data, error } = await supabase.functions.invoke('license-proxy', {
      body: { action: 'get_config' },
    });
    if (error || !data) return { configured: false, tolerancia_dias: 5 };
    return {
      configured: !!data.configured,
      tolerancia_dias: data.tolerancia_dias ?? 5,
    };
  } catch {
    return { configured: false, tolerancia_dias: 5 };
  }
}

// Save keys + tolerance securely to database via edge function
export async function saveKeysToServer(apiKey: string, activationKey: string, toleranciaDias: number = 5): Promise<{ success: boolean; license?: any; warning?: string }> {
  const { data, error } = await supabase.functions.invoke('license-proxy', {
    body: {
      action: 'save_keys',
      new_api_key: apiKey,
      new_activation_key: activationKey,
      tolerancia_dias: toleranciaDias,
    },
  });
  if (error) throw new Error(error.message || 'Falha ao salvar chaves');
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function getLicense() {
  return proxyRequest<{ license: any }>({ action: 'get_license' });
}

export async function getPayments() {
  return proxyRequest<{ payments: any[]; summary: any }>({ action: 'get_payments' });
}

export async function getPixImage(paymentId: string): Promise<{ imageUrl: string; pixCode: string | null }> {
  try {
    const data = await proxyRequest<any>({
      action: 'get_pix',
      payment_id: paymentId,
    });

    if (data.data_base64) {
      const binary = atob(data.data_base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: data.content_type || 'image/png' });
      return { imageUrl: URL.createObjectURL(blob), pixCode: data.pix_copia_e_cola || null };
    }

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

export async function getBoletoPdf(paymentId: string): Promise<string> {
  try {
    const data = await proxyRequest<any>({
      action: 'get_boleto',
      payment_id: paymentId,
    });

    if (data.data_base64) {
      const binary = atob(data.data_base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: data.content_type || 'application/pdf' });
      return URL.createObjectURL(blob);
    }

    const url = data.boleto_url || data.boletoUrl || data.pdf_url || data.pdfUrl || data.url || '';
    if (url) return url;

    throw new Error('Resposta da API não contém dados do boleto');
  } catch (err: any) {
    console.error('[Boleto] Error:', err);
    throw err;
  }
}

export async function createTicket(subject: string, message: string, priority = 'normal') {
  return proxyRequest({ action: 'create_ticket', subject, message, priority });
}

export async function getTickets() {
  return proxyRequest<{ tickets: any[] }>({ action: 'get_tickets' });
}

export async function getTicketMessages(ticketId: string) {
  return proxyRequest<{ messages: any[] }>({ action: 'get_ticket_messages', ticket_id: ticketId });
}

export async function sendMessage(ticketId: string, message: string) {
  return proxyRequest({ action: 'send_message', ticket_id: ticketId, message });
}
