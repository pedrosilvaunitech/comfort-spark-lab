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
  const response = await fetch(`${BASE_URL}/payments/${paymentId}/pix?activation_key=${activationKey}`, {
    headers: { 'x-api-key': apiKey },
  });
  if (!response.ok) throw new Error('Falha ao gerar PIX');
  const blob = await response.blob();
  return { imageUrl: URL.createObjectURL(blob), pixCode: response.headers.get('X-Pix-Copia-E-Cola') };
}

export async function getBoletoPdf(paymentId: string, activationKey: string): Promise<string> {
  const apiKey = getStoredApiKey();
  const response = await fetch(`${BASE_URL}/payments/${paymentId}/boleto?activation_key=${activationKey}`, {
    headers: { 'x-api-key': apiKey },
  });
  if (!response.ok) throw new Error('Falha ao gerar boleto');
  const blob = await response.blob();
  return URL.createObjectURL(blob);
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
