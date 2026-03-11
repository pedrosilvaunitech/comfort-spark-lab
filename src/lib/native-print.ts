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
 * Check if WebUSB API is available (Chrome on Android/Desktop)
 */
export function hasWebUsb(): boolean {
  return 'usb' in navigator;
}

// Cache the WebUSB device so we don't re-prompt every print
let cachedUsbDevice: USBDevice | null = null;

/**
 * Known POS80/PT80KM thermal printer USB vendor/product IDs
 */
const KNOWN_PRINTER_FILTERS: USBDeviceFilter[] = [
  { vendorId: 0x0416 }, // WinBond (common POS printers)
  { vendorId: 0x0483 }, // STMicroelectronics (POS80 variants)
  { vendorId: 0x1FC9 }, // NXP (some kiosk printers)
  { vendorId: 0x04B8 }, // Epson
  { vendorId: 0x0DD4 }, // Custom Engineering
  { vendorId: 0x0FE6 }, // ICS Electronics
  { vendorId: 0x1A86 }, // QinHeng CH340 (common USB-serial for POS)
  { vendorId: 0x20D1 }, // Custom POS80 kiosk printers
  { vendorId: 0x0525 }, // Netchip (Linux USB gadget)
  { vendorId: 0x1D90 }, // Common thermal printer vendor
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
  }
): Uint8Array {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];

  const push = (str: string) => parts.push(encoder.encode(str));
  const pushBytes = (...bytes: number[]) => parts.push(new Uint8Array(bytes));

  // ESC/POS commands
  const ESC = 0x1B;
  const GS = 0x1D;
  const LF = 0x0A;

  // Initialize printer
  pushBytes(ESC, 0x40); // ESC @

  // Center align
  pushBytes(ESC, 0x61, 0x01); // ESC a 1

  // Clinic name (double height)
  if (layout.clinicName) {
    pushBytes(ESC, 0x45, 0x01); // Bold on
    pushBytes(GS, 0x21, 0x01);  // Double height
    push(layout.clinicName);
    pushBytes(LF);
    pushBytes(GS, 0x21, 0x00);  // Normal size
    pushBytes(ESC, 0x45, 0x00); // Bold off
  }

  // Header
  if (layout.header) {
    push(layout.header);
    pushBytes(LF);
  }

  // Dash line (80mm = ~48 chars)
  push('------------------------------------------------');
  pushBytes(LF);

  // "SENHA" label
  pushBytes(ESC, 0x45, 0x01); // Bold on
  push('SENHA');
  pushBytes(LF);

  // Ticket number - QUADRUPLE SIZE
  pushBytes(GS, 0x21, 0x33); // 4x width + 4x height
  push(ticket.displayNumber);
  pushBytes(LF);
  pushBytes(GS, 0x21, 0x00); // Normal
  pushBytes(ESC, 0x45, 0x00); // Bold off

  // Type label
  const typeLabel: Record<string, string> = {
    normal: 'Normal',
    priority: 'Prioritario',
    preferential: 'Preferencial',
  };
  push('Tipo: ' + (typeLabel[ticket.type] || ticket.type));
  pushBytes(LF);

  // Date/Time
  if (layout.showDateTime !== false) {
    const date = new Date(ticket.createdAt);
    push('Data: ' + date.toLocaleDateString('pt-BR') + ' ' +
      date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    pushBytes(LF);
  }

  // Patient name
  if (config.printName !== false && ticket.patientName) {
    push('Nome: ' + ticket.patientName);
    pushBytes(LF);
  }

  // CPF
  if (config.printCpf !== false && ticket.patientCpf) {
    push('CPF: ' + ticket.patientCpf);
    pushBytes(LF);
  }

  // Custom message
  if (layout.customMessage) {
    pushBytes(LF);
    push(layout.customMessage);
    pushBytes(LF);
  }

  push('------------------------------------------------');
  pushBytes(LF);

  // Footer
  if (layout.footer) {
    push(layout.footer);
    pushBytes(LF);
  }

  // LGPD
  if (layout.lgpdNotice) {
    pushBytes(LF);
    push(layout.lgpdNotice);
    pushBytes(LF);
  }

  // Feed lines
  pushBytes(LF, LF, LF);

  // Auto cut
  if (config.autoCut !== false) {
    pushBytes(GS, 0x56, 0x42, 0x03); // GS V B 3 (partial cut with 3 lines feed)
  }

  // Merge all parts
  const totalLength = parts.reduce((acc, p) => acc + p.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }

  return result;
}

/**
 * Convert ESC/POS bytes to base64 string (for Capacitor plugin)
 */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Connect to USB printer via WebUSB API
 */
async function getWebUsbDevice(): Promise<USBDevice | null> {
  if (!hasWebUsb()) return null;

  // Return cached device if still connected
  if (cachedUsbDevice && cachedUsbDevice.opened) {
    return cachedUsbDevice;
  }

  try {
    // First try to get already-paired devices
    const devices = await navigator.usb.getDevices();
    if (devices.length > 0) {
      cachedUsbDevice = devices[0];
      if (!cachedUsbDevice.opened) {
        await cachedUsbDevice.open();
        await cachedUsbDevice.selectConfiguration(1);
        await cachedUsbDevice.claimInterface(0);
      }
      return cachedUsbDevice;
    }

    // Request new device (requires user gesture)
    const device = await navigator.usb.requestDevice({
      filters: KNOWN_PRINTER_FILTERS,
    });
    
    await device.open();
    await device.selectConfiguration(1);
    await device.claimInterface(0);
    
    cachedUsbDevice = device;
    return device;
  } catch (err) {
    console.error('[WebUSB] Error connecting:', err);
    return null;
  }
}

/**
 * Print raw ESC/POS data via WebUSB (no popups, silent)
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
  config: any
): Promise<boolean> {
  if (!hasWebUsb()) {
    console.warn('[WebUSB] WebUSB API not available');
    return false;
  }

  try {
    const device = await getWebUsbDevice();
    if (!device) {
      console.error('[WebUSB] No printer device available');
      return false;
    }

    const data = generateEscPosBytes(ticket, layout, config);

    // Find the bulk OUT endpoint
    const iface = device.configuration?.interfaces[0];
    const endpoint = iface?.alternate?.endpoints.find(
      (e) => e.direction === 'out' && e.type === 'bulk'
    );

    if (endpoint) {
      await device.transferOut(endpoint.endpointNumber, data);
    } else {
      // Fallback: try endpoint 1 (common for POS printers)
      await device.transferOut(1, data);
    }

    console.log('[WebUSB] Print sent successfully');
    return true;
  } catch (err) {
    console.error('[WebUSB] Print error:', err);
    // Reset cached device on error
    cachedUsbDevice = null;
    return false;
  }
}

/**
 * Pair the WebUSB printer (must be called from user gesture like button click)
 */
export async function pairWebUsbPrinter(): Promise<{ success: boolean; deviceName?: string }> {
  if (!hasWebUsb()) {
    return { success: false };
  }

  try {
    const device = await navigator.usb.requestDevice({
      filters: KNOWN_PRINTER_FILTERS,
    });
    
    await device.open();
    await device.selectConfiguration(1);
    await device.claimInterface(0);
    
    cachedUsbDevice = device;
    return { 
      success: true, 
      deviceName: device.productName || `${device.vendorId}:${device.productId}` 
    };
  } catch (err) {
    console.error('[WebUSB] Pair error:', err);
    return { success: false };
  }
}

/**
 * Check if a WebUSB printer is paired and connected
 */
export async function isWebUsbPrinterConnected(): Promise<{ connected: boolean; deviceName?: string }> {
  if (!hasWebUsb()) return { connected: false };

  try {
    const devices = await navigator.usb.getDevices();
    if (devices.length > 0) {
      return { 
        connected: true, 
        deviceName: devices[0].productName || `${devices[0].vendorId}:${devices[0].productId}` 
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

  try {
    // Check connection
    const status = await UsbPrinter.isConnected();
    
    if (!status.connected) {
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

    // Generate ESC/POS data as base64
    const bytes = generateEscPosBytes(ticket, layout, config);
    const base64Data = bytesToBase64(bytes);

    // Send to printer
    const result = await UsbPrinter.print({ data: base64Data });
    return result.success;
  } catch (err) {
    console.error('[NativePrint] Error:', err);
    return false;
  }
}

export { UsbPrinter };
