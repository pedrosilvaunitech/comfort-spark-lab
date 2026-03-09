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
 * Generate ESC/POS raw bytes for thermal printing
 */
function generateEscPosData(
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
  }
): string {
  const ESC = '\x1B';
  const GS = '\x1D';
  const LF = '\x0A';
  
  // Commands
  const INIT = ESC + '@';                    // Initialize
  const CENTER = ESC + 'a' + '\x01';         // Center align
  const LEFT = ESC + 'a' + '\x00';           // Left align
  const BOLD_ON = ESC + 'E' + '\x01';        // Bold on
  const BOLD_OFF = ESC + 'E' + '\x00';       // Bold off
  const DOUBLE_H = GS + '!' + '\x01';        // Double height
  const DOUBLE_WH = GS + '!' + '\x11';       // Double width + height
  const QUAD = GS + '!' + '\x33';            // Quadruple size
  const NORMAL = GS + '!' + '\x00';          // Normal size
  const CUT = GS + 'V' + '\x42' + '\x03';   // Partial cut with feed
  const DASH_LINE = '--------------------------------';

  const typeLabel: Record<string, string> = {
    normal: 'Normal',
    priority: 'Prioritário',
    preferential: 'Preferencial',
  };

  let data = INIT + CENTER;

  // Clinic name
  if (layout.clinicName) {
    data += BOLD_ON + DOUBLE_H + layout.clinicName + LF + NORMAL + BOLD_OFF;
  }

  // Header
  if (layout.header) {
    data += layout.header + LF;
  }

  data += DASH_LINE + LF;

  // Ticket number - BIG
  data += BOLD_ON + 'SENHA' + LF;
  data += QUAD + ticket.displayNumber + LF + NORMAL + BOLD_OFF;

  // Type
  data += 'Tipo: ' + (typeLabel[ticket.type] || ticket.type) + LF;

  // Date/Time
  if (layout.showDateTime !== false) {
    const date = new Date(ticket.createdAt);
    data += 'Data: ' + date.toLocaleDateString('pt-BR') + ' ' +
      date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + LF;
  }

  // Name
  if (config.printName !== false && ticket.patientName) {
    data += 'Nome: ' + ticket.patientName + LF;
  }

  // CPF
  if (config.printCpf !== false && ticket.patientCpf) {
    data += 'CPF: ' + ticket.patientCpf + LF;
  }

  // Custom message
  if (layout.customMessage) {
    data += LF + layout.customMessage + LF;
  }

  data += DASH_LINE + LF;

  // Footer
  if (layout.footer) {
    data += layout.footer + LF;
  }

  // LGPD
  if (layout.lgpdNotice) {
    data += LF + layout.lgpdNotice + LF;
  }

  // Feed and cut
  data += LF + LF + LF;
  if (config.autoCut !== false) {
    data += CUT;
  }

  // Convert to base64
  return btoa(unescape(encodeURIComponent(data)));
}

/**
 * Print ticket via USB on Android using native plugin
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

  try {
    // Check connection
    const status = await UsbPrinter.isConnected();
    
    if (!status.connected) {
      // Try to auto-connect to first available printer
      const devices = await UsbPrinter.listDevices();
      if (devices.devices.length === 0) {
        console.error('[NativePrint] No USB printers found');
        return false;
      }
      
      const printer = devices.devices[0];
      const connectResult = await UsbPrinter.connect({
        vendorId: printer.vendorId,
        productId: printer.productId,
      });
      
      if (!connectResult.success) {
        console.error('[NativePrint] Failed to connect to printer');
        return false;
      }
    }

    // Generate ESC/POS data
    const data = generateEscPosData(ticket, layout, config);

    // Send to printer
    const result = await UsbPrinter.print({ data });
    return result.success;
  } catch (err) {
    console.error('[NativePrint] Error:', err);
    return false;
  }
}

export { UsbPrinter };
