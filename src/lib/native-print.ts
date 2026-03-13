import { Capacitor, registerPlugin } from '@capacitor/core';

export interface UsbPrinterPlugin {
  print(options: { data: string }): Promise<{ success: boolean; message?: string }>;
  isConnected(): Promise<{ connected: boolean; deviceName?: string }>;
  listDevices(): Promise<{ devices: { vendorId: number; productId: number; name: string }[] }>;
  connect(options: { vendorId: number; productId: number }): Promise<{ success: boolean }>;
}

const UsbPrinter = registerPlugin<UsbPrinterPlugin>('UsbPrinter');

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export function isAndroid(): boolean {
  return Capacitor.getPlatform() === 'android';
}

/**
 * Check if WebUSB API is available and usable
 */
export function getWebUsbBlockReason(): string | null {
  if (!("usb" in navigator)) {
    return "WebUSB não está disponível neste navegador. Use Google Chrome.";
  }

  if (!window.isSecureContext) {
    return "WebUSB exige HTTPS (ou localhost).";
  }

  if (window.top !== window.self) {
    return "WebUSB não funciona dentro de iframe/preview. Abra o sistema em aba/janela própria.";
  }

  return null;
}

export function hasWebUsb(): boolean {
  return getWebUsbBlockReason() === null;
}

// Cache the WebUSB device so we don't re-prompt every print
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedUsbDevice: any = null;

const KNOWN_PRINTER_FILTERS = [
  { vendorId: 0x0483, productId: 0x7540 }, // PT80KM POS80 (vid=1155 pid=30016)
  { vendorId: 0x0483 }, // STMicroelectronics (POS80 variants)
  { vendorId: 0x0416 },
  { vendorId: 0x1FC9 },
  { vendorId: 0x04B8 },
  { vendorId: 0x0DD4 },
  { vendorId: 0x0FE6 },
  { vendorId: 0x1A86 },
  { vendorId: 0x20D1 },
  { vendorId: 0x0525 },
  { vendorId: 0x1D90 },
];

/**
 * Generate ESC/POS raw bytes for thermal printing (80mm)
 */
export function generateEscPosBytes(
  ticket: {
    displayNumber: string;
    type: string;
    patientName?: string | null;
    patientCpf?: string | null;
    createdAt: string;
  },
  layout: {
    clinicName?: string;
    header?: string;
    footer?: string;
    customMessage?: string;
    lgpdNotice?: string;
    showDateTime?: boolean;
  },
  config: {
    autoCut?: boolean;
    printName?: boolean;
    printCpf?: boolean;
    paperSize?: string;
    rotate180?: boolean;
  }
): Uint8Array {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];

  const push = (str: string) => parts.push(encoder.encode(str));
  const pushBytes = (...bytes: number[]) => parts.push(new Uint8Array(bytes));

  const ESC = 0x1B;
  const GS = 0x1D;
  const LF = 0x0A;

  // Initialize printer
  pushBytes(ESC, 0x40);

  // Enable 180° rotation if configured
  if (config.rotate180) {
    pushBytes(ESC, 0x7B, 0x01);
  }

  // Center align
  pushBytes(ESC, 0x61, 0x01);

  // Clinic name (double height + bold)
  if (layout.clinicName) {
    pushBytes(ESC, 0x45, 0x01);
    pushBytes(GS, 0x21, 0x01);
    push(layout.clinicName);
    pushBytes(LF);
    pushBytes(GS, 0x21, 0x00);
    pushBytes(ESC, 0x45, 0x00);
  }

  if (layout.header) {
    push(layout.header);
    pushBytes(LF);
  }

  push('------------------------------------------------');
  pushBytes(LF);

  pushBytes(ESC, 0x45, 0x01);
  push('SENHA');
  pushBytes(LF);

  // Ticket number - QUADRUPLE SIZE
  pushBytes(GS, 0x21, 0x33);
  push(ticket.displayNumber);
  pushBytes(LF);
  pushBytes(GS, 0x21, 0x00);
  pushBytes(ESC, 0x45, 0x00);

  const typeLabel: Record<string, string> = {
    normal: 'Normal',
    priority: 'Prioritario',
    preferential: 'Preferencial',
  };
  push('Tipo: ' + (typeLabel[ticket.type] || ticket.type));
  pushBytes(LF);

  if (layout.showDateTime !== false) {
    const date = new Date(ticket.createdAt);
    push('Data: ' + date.toLocaleDateString('pt-BR') + ' ' +
      date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    pushBytes(LF);
  }

  if (config.printName !== false && ticket.patientName) {
    push('Nome: ' + ticket.patientName);
    pushBytes(LF);
  }

  if (config.printCpf !== false && ticket.patientCpf) {
    push('CPF: ' + ticket.patientCpf);
    pushBytes(LF);
  }

  if (layout.customMessage) {
    pushBytes(LF);
    push(layout.customMessage);
    pushBytes(LF);
  }

  push('------------------------------------------------');
  pushBytes(LF);

  if (layout.footer) {
    push(layout.footer);
    pushBytes(LF);
  }

  if (layout.lgpdNotice) {
    pushBytes(LF);
    push(layout.lgpdNotice);
    pushBytes(LF);
  }

  pushBytes(LF, LF, LF);

  // Disable rotation before cut
  if (config.rotate180) {
    pushBytes(ESC, 0x7B, 0x00);
  }

  if (config.autoCut !== false) {
    pushBytes(GS, 0x56, 0x42, 0x03);
  }

  const totalLength = parts.reduce((acc, p) => acc + p.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getNavigatorUsb(): any {
  return (navigator as any).usb;
}

/**
 * Connect to USB printer via WebUSB API using stored VID/PID
 */
async function getWebUsbDevice(vendorId?: number, productId?: number): Promise<any> {
  const usb = getNavigatorUsb();
  if (!usb) return null;

  if (cachedUsbDevice && cachedUsbDevice.opened) {
    return cachedUsbDevice;
  }

  try {
    const devices = await usb.getDevices();
    
    let device = null;
    if (vendorId && productId && devices.length > 0) {
      device = devices.find(
        (d: any) => d.vendorId === vendorId && d.productId === productId
      ) || devices[0];
    } else if (devices.length > 0) {
      device = devices[0];
    }

    if (device) {
      if (!device.opened) {
        await device.open();
      }
      try {
        if (!device.configuration || device.configuration.configurationValue !== 1) {
          await device.selectConfiguration(1);
        }
      } catch { /* already selected */ }
      try {
        await device.claimInterface(0);
      } catch { /* already claimed */ }
      cachedUsbDevice = device;
      return device;
    }
    return null;
  } catch (err) {
    console.error('[WebUSB] Error connecting:', err);
    cachedUsbDevice = null;
    return null;
  }
}

/**
 * Print raw ESC/POS data via WebUSB (no popups, silent after pairing)
 * Uses VID/PID from local config to find the correct device
 */
export async function printViaWebUsb(
  ticket: {
    displayNumber: string;
    type: string;
    patientName?: string | null;
    patientCpf?: string | null;
    createdAt: string;
  },
  layout: any,
  config: any,
  vendorId?: number,
  productId?: number
): Promise<boolean> {
  if (!hasWebUsb()) {
    console.warn('[WebUSB] WebUSB API not available');
    return false;
  }

  try {
    const device = await getWebUsbDevice(vendorId, productId);
    if (!device) {
      console.error('[WebUSB] No printer device available. Pair first via settings.');
      return false;
    }

    const data = generateEscPosBytes(ticket, layout, config);

    // Find the bulk OUT endpoint
    const iface = device.configuration?.interfaces?.[0];
    const endpoint = iface?.alternate?.endpoints?.find(
      (e: any) => e.direction === 'out' && e.type === 'bulk'
    );

    if (endpoint) {
      await device.transferOut(endpoint.endpointNumber, data);
    } else {
      await device.transferOut(1, data);
    }

    console.log('[WebUSB] Print sent successfully via', device.productName || `${device.vendorId}:${device.productId}`);
    return true;
  } catch (err) {
    console.error('[WebUSB] Print error:', err);
    cachedUsbDevice = null;
    return false;
  }
}

/**
 * Auto-connect to a previously paired WebUSB printer (call on page load)
 * Returns true if a device is ready to print
 */
export async function autoConnectWebUsbPrinter(vendorId?: number, productId?: number): Promise<boolean> {
  if (!hasWebUsb()) return false;
  try {
    const device = await getWebUsbDevice(vendorId, productId);
    return !!device;
  } catch {
    return false;
  }
}

/**
 * Pair the WebUSB printer (MUST be called from user gesture like button click)
 */
export async function pairWebUsbPrinter(): Promise<{ success: boolean; deviceName?: string; vendorId?: number; productId?: number }> {
  const blockReason = getWebUsbBlockReason();
  if (blockReason) {
    throw new Error(blockReason);
  }

  const usb = getNavigatorUsb();
  if (!usb) {
    throw new Error('WebUSB não disponível neste navegador. Use o Google Chrome (desktop ou Android).');
  }

  try {
    const device = await usb.requestDevice({ filters: KNOWN_PRINTER_FILTERS });

    if (!device.opened) {
      await device.open();
    }

    // selectConfiguration can fail if already selected
    try {
      if (!device.configuration || device.configuration.configurationValue !== 1) {
        await device.selectConfiguration(1);
      }
    } catch (cfgErr) {
      console.warn('[WebUSB] selectConfiguration skipped:', cfgErr);
    }

    // claimInterface can fail if already claimed
    try {
      await device.claimInterface(0);
    } catch (claimErr) {
      console.warn('[WebUSB] claimInterface skipped (may already be claimed):', claimErr);
    }

    cachedUsbDevice = device;
    return {
      success: true,
      deviceName: device.productName || `${device.vendorId}:${device.productId}`,
      vendorId: device.vendorId,
      productId: device.productId,
    };
  } catch (err: any) {
    console.error('[WebUSB] Pair error:', err);
    if (err.name === 'NotFoundError') {
      throw new Error('Nenhuma impressora selecionada. Selecione o dispositivo na janela do navegador.');
    }
    if (err.name === 'SecurityError') {
      throw new Error(getWebUsbBlockReason() || 'WebUSB bloqueado por política do navegador. Verifique HTTPS e Permissions-Policy: usb=(self).');
    }
    throw new Error(err.message || 'Erro ao parear impressora USB.');
  }
}

/**
 * Check if a WebUSB printer is paired
 */
export async function isWebUsbPrinterConnected(): Promise<{ connected: boolean; deviceName?: string }> {
  const usb = getNavigatorUsb();
  if (!usb) return { connected: false };

  try {
    const devices = await usb.getDevices();
    if (devices.length > 0) {
      return {
        connected: true,
        deviceName: devices[0].productName || `${devices[0].vendorId}:${devices[0].productId}`,
      };
    }
    return { connected: false };
  } catch {
    return { connected: false };
  }
}

/**
 * Print ticket via USB on Android using native Capacitor plugin
 */
export async function printViaAndroidUsb(
  ticket: {
    displayNumber: string;
    type: string;
    patientName?: string | null;
    patientCpf?: string | null;
    createdAt: string;
  },
  layout: any,
  config: any
): Promise<boolean> {
  if (!isAndroid()) {
    console.warn('[NativePrint] Not running on Android');
    return false;
  }

  // Known IRIS / PT80KM printer identifiers for auto-connect
  const KNOWN_PRINTERS = [
    { vendorId: 0x0483, productId: 0x7540 }, // PT80KM / IRIS (VID 1155, PID 30016)
    { vendorId: 0x0483, productId: 0x5740 }, // IRIS variant
    { vendorId: 0x0416, productId: 0x5011 }, // Winbond (some IRIS models)
  ];

  try {
    const status = await UsbPrinter.isConnected();

    if (!status.connected) {
      const devices = await UsbPrinter.listDevices();
      console.log('[NativePrint] Dispositivos USB encontrados:', JSON.stringify(devices.devices));

      if (devices.devices.length === 0) {
        // Try connecting directly with known VID/PID even if listDevices is empty
        console.log('[NativePrint] Nenhum device listado. Tentando conectar direto VID=0x0483 PID=0x7540...');
        try {
          const directResult = await UsbPrinter.connect({ vendorId: 0x0483, productId: 0x7540 });
          if (!directResult.success) {
            console.error('[NativePrint] Conexão direta falhou');
            return false;
          }
          console.log('[NativePrint] ✅ Conectado direto via VID/PID hardcoded');
        } catch (directErr) {
          console.error('[NativePrint] Erro conexão direta:', directErr);
          return false;
        }
      } else {
        // Try known printers first, then fall back to first device
        let connected = false;
        for (const known of KNOWN_PRINTERS) {
          const match = devices.devices.find(
            (d) => d.vendorId === known.vendorId && d.productId === known.productId
          );
          if (match) {
            console.log(`[NativePrint] Impressora conhecida encontrada: ${match.name} (${match.vendorId}:${match.productId})`);
            const r = await UsbPrinter.connect({ vendorId: match.vendorId, productId: match.productId });
            if (r.success) { connected = true; break; }
          }
        }

        if (!connected) {
          const fallback = devices.devices[0];
          console.log(`[NativePrint] Usando primeiro dispositivo: ${fallback.name} (${fallback.vendorId}:${fallback.productId})`);
          const r = await UsbPrinter.connect({ vendorId: fallback.vendorId, productId: fallback.productId });
          if (!r.success) {
            console.error('[NativePrint] Falha ao conectar ao dispositivo');
            return false;
          }
        }
      }
    }

    const bytes = generateEscPosBytes(ticket, layout, config);
    const base64Data = bytesToBase64(bytes);

    const result = await UsbPrinter.print({ data: base64Data });
    console.log('[NativePrint] Resultado impressão:', result.success ? '✅ OK' : '❌ Falhou');
    return result.success;
  } catch (err) {
    console.error('[NativePrint] Error:', err);
    return false;
  }
}

export { UsbPrinter };
