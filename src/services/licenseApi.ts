const BASE_URL = 'https://biqzwxxiifmzrccdvnxf.supabase.co/functions/v1/client-api';

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

function getStoredApiKey(): string {
  return getStoredConfig().apiKey;
}

async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const apiKey = getStoredApiKey();
  if (!apiKey) throw new Error('API Key não configurada');
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Falha na requisição' }));
    throw new Error(error.error || 'Falha na requisição');
  }
  return response.json();
}

export async function getLicense(activationKey: string) {
  return apiRequest<{ license: any }>(`/license?activation_key=${activationKey}`);
}

export async function getPayments(activationKey: string) {
  return apiRequest<{ payments: any[]; summary: any }>(`/payments?activation_key=${activationKey}`);
}

export async function getPixImage(paymentId: string, activationKey: string): Promise<{ imageUrl: string; pixCode: string | null }> {
  const apiKey = getStoredApiKey();
  if (!apiKey) throw new Error('API Key não configurada');
  try {
    const response = await fetch(`${BASE_URL}/payments/${paymentId}/pix?activation_key=${activationKey}`, {
      headers: { 'x-api-key': apiKey },
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('[PIX] Error response:', response.status, errorText);
      throw new Error(`Falha ao gerar PIX (${response.status}): ${errorText}`);
    }
    const contentType = response.headers.get('content-type') || '';
    // If response is JSON (some APIs return JSON with base64 image)
    if (contentType.includes('application/json')) {
      const json = await response.json();
      const imageUrl = json.qr_code_url || json.qrCodeUrl || json.image_url || json.imageUrl || '';
      const pixCode = json.pix_code || json.pixCode || json.copy_paste || json.copyPaste || json['pix_copia_e_cola'] || null;
      if (imageUrl) {
        return { imageUrl, pixCode };
      }
      // If base64 image in response
      if (json.qr_code_base64 || json.qrCodeBase64 || json.image) {
        const b64 = json.qr_code_base64 || json.qrCodeBase64 || json.image;
        return { imageUrl: `data:image/png;base64,${b64}`, pixCode };
      }
      console.warn('[PIX] JSON response without expected fields:', json);
      throw new Error('Resposta da API não contém dados do PIX');
    }
    // Binary response (image)
    const blob = await response.blob();
    const pixCode = response.headers.get('X-Pix-Copia-E-Cola') || response.headers.get('x-pix-copia-e-cola') || null;
    return { imageUrl: URL.createObjectURL(blob), pixCode };
  } catch (err: any) {
    console.error('[PIX] Error:', err);
    throw err;
  }
}

export async function getBoletoPdf(paymentId: string, activationKey: string): Promise<string> {
  const apiKey = getStoredApiKey();
  if (!apiKey) throw new Error('API Key não configurada');
  try {
    const response = await fetch(`${BASE_URL}/payments/${paymentId}/boleto?activation_key=${activationKey}`, {
      headers: { 'x-api-key': apiKey },
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('[Boleto] Error response:', response.status, errorText);
      throw new Error(`Falha ao gerar boleto (${response.status}): ${errorText}`);
    }
    const contentType = response.headers.get('content-type') || '';
    // If JSON response with URL
    if (contentType.includes('application/json')) {
      const json = await response.json();
      const url = json.boleto_url || json.boletoUrl || json.pdf_url || json.pdfUrl || json.url || '';
      if (url) return url;
      if (json.pdf_base64 || json.pdfBase64) {
        const b64 = json.pdf_base64 || json.pdfBase64;
        const byteChars = atob(b64);
        const byteArray = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        return URL.createObjectURL(blob);
      }
      console.warn('[Boleto] JSON response without expected fields:', json);
      throw new Error('Resposta da API não contém dados do boleto');
    }
    // Binary PDF
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (err: any) {
    console.error('[Boleto] Error:', err);
    throw err;
  }
}

export async function createTicket(activationKey: string, subject: string, message: string, priority = 'normal') {
  return apiRequest('/support', { method: 'POST', body: JSON.stringify({ activation_key: activationKey, subject, message, priority }) });
}

export async function getTickets(activationKey: string) {
  return apiRequest<{ tickets: any[] }>(`/support?activation_key=${activationKey}`);
}

export async function getTicketMessages(ticketId: string) {
  return apiRequest<{ messages: any[] }>(`/support/${ticketId}/messages`);
}

export async function sendMessage(ticketId: string, activationKey: string, message: string) {
  return apiRequest(`/support/${ticketId}/messages`, { method: 'POST', body: JSON.stringify({ activation_key: activationKey, message }) });
}
