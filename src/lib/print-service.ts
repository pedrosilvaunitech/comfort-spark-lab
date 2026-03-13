import { logPrint, getSystemConfig } from "./ticket-service";
import type { Ticket } from "./ticket-service";
import { isAndroid, printViaAndroidUsb, hasWebUsb, printViaWebUsb } from "./native-print";
import { getLocalPrinterConfig, isLocalPrinterPaired } from "./local-printer-config";

export interface PrintConfig {
  enabled: boolean;
  connectionType: "usb" | "network" | "serial";
  ip: string;
  port: number;
  usbVendorId: string;
  usbProductId: string;
  serialPort: string;
  serialBaudrate: number;
  autoCut: boolean;
  printLogo: boolean;
  printQrCode: boolean;
  printCpf: boolean;
  printName: boolean;
  printMode: "fast" | "detailed";
  paperSize: "58mm" | "80mm";
}

export interface TicketLayout {
  clinicName: string;
  header: string;
  footer: string;
  customMessage: string;
  lgpdNotice: string;
  showDateTime: boolean;
  fontSize: "normal" | "large" | "giant";
  alignment: "center" | "left";
  lineSpacing: number;
}

export type PrintMethod = "browser" | "print_server" | "cloud" | "android_usb" | "webusb" | "network_ip";

// ============ METHOD 1: Browser Print (window.print) ============
function buildTicketHtml(ticket: Ticket, layout: TicketLayout, config: PrintConfig): string {
  const fontSizeMap = { normal: "24px", large: "36px", giant: "56px" };
  const ticketFontSize = fontSizeMap[layout.fontSize];
  const align = layout.alignment === "center" ? "center" : "left";
  const width = config.paperSize === "58mm" ? "58mm" : "80mm";
  const date = new Date(ticket.created_at);
  const dateStr = date.toLocaleDateString("pt-BR");
  const timeStr = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const typeLabel: Record<string, string> = {
    normal: "Normal",
    priority: "Prioritário",
    preferential: "Preferencial",
  };

  let html = `
    <div style="width:${width};font-family:monospace;padding:8px;text-align:${align};line-height:${layout.lineSpacing + 0.4};">
      ${layout.clinicName ? `<div style="font-size:16px;font-weight:bold;margin-bottom:4px;">${layout.clinicName}</div>` : ""}
      ${layout.header ? `<div style="font-size:12px;margin-bottom:8px;">${layout.header}</div>` : ""}
      <div style="border-top:1px dashed #000;margin:4px 0;"></div>
      <div style="font-size:12px;font-weight:bold;">SENHA</div>
      <div style="font-size:${ticketFontSize};font-weight:bold;margin:8px 0;letter-spacing:2px;">${ticket.display_number}</div>
      <div style="font-size:12px;">Tipo: ${typeLabel[ticket.ticket_type] || ticket.ticket_type}</div>
  `;

  if (layout.showDateTime) {
    html += `<div style="font-size:11px;">Data: ${dateStr} ${timeStr}</div>`;
  }
  if (config.printName && ticket.patient_name) {
    html += `<div style="font-size:11px;">Nome: ${ticket.patient_name}</div>`;
  }
  if (config.printCpf && ticket.patient_cpf) {
    html += `<div style="font-size:11px;">CPF: ${ticket.patient_cpf}</div>`;
  }
  if (layout.customMessage) {
    html += `<div style="font-size:10px;margin-top:6px;">${layout.customMessage}</div>`;
  }

  html += `<div style="border-top:1px dashed #000;margin:8px 0;"></div>`;

  if (config.printQrCode) {
    html += `<div id="qr-placeholder" style="margin:8px auto;text-align:center;">[QR Code: ${ticket.display_number}]</div>`;
  }

  if (layout.footer) {
    html += `<div style="font-size:11px;margin-top:4px;">${layout.footer}</div>`;
  }
  if (layout.lgpdNotice) {
    html += `<div style="font-size:8px;margin-top:4px;color:#666;">${layout.lgpdNotice}</div>`;
  }

  html += `</div>`;
  return html;
}

export async function printViaBrowser(ticket: Ticket): Promise<boolean> {
  try {
    const [printerConfig, layoutConfig] = await Promise.all([
      getSystemConfig("printer"),
      getSystemConfig("ticket_layout"),
    ]);
    const config = printerConfig as unknown as PrintConfig;
    const layout = layoutConfig as unknown as TicketLayout;

    const html = buildTicketHtml(ticket, layout, config);

    const printWindow = window.open("", "_blank", "width=350,height=500");
    if (!printWindow) {
      await logPrint(ticket.id, "failed", "browser", "Popup bloqueado");
      return false;
    }

    printWindow.document.write(`
      <html>
        <head><title>Senha ${ticket.display_number}</title></head>
        <body style="margin:0;padding:0;">${html}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
      setTimeout(() => printWindow.close(), 1000);
    }, 300);

    await logPrint(ticket.id, "success", "browser");
    return true;
  } catch (err: any) {
    await logPrint(ticket.id, "failed", "browser", err.message);
    return false;
  }
}

// ============ METHOD 2: External Print Server ============
export async function printViaPrintServer(ticket: Ticket, serverUrl?: string): Promise<boolean> {
  try {
    const [printerConfig, layoutConfig] = await Promise.all([
      getSystemConfig("printer"),
      getSystemConfig("ticket_layout"),
    ]);
    const config = (printerConfig || {}) as unknown as PrintConfig;
    const layout = (layoutConfig || {}) as unknown as TicketLayout;
    const localConfig = getLocalPrinterConfig();

    const localIp = typeof window !== "undefined" ? localStorage.getItem("unitech_printer_ip") : null;
    const localPortRaw = typeof window !== "undefined" ? localStorage.getItem("unitech_printer_port") : null;
    const parsedLocalPort = localPortRaw ? parseInt(localPortRaw, 10) : NaN;
    const resolvedPort = Number.isFinite(parsedLocalPort) ? parsedLocalPort : (config.port || 9100);

    const payload = {
      ticket: {
        displayNumber: ticket.display_number,
        type: ticket.ticket_type,
        patientName: ticket.patient_name,
        patientCpf: ticket.patient_cpf,
        createdAt: ticket.created_at,
      },
      layout,
      printer: {
        connectionType: config.connectionType || "usb",
        ip: localIp || config.ip || "",
        port: resolvedPort,
        usbVendorId: localConfig.vendorId || Number(config.usbVendorId) || 0,
        usbProductId: localConfig.productId || Number(config.usbProductId) || 0,
        serialPort: config.serialPort,
        serialBaudrate: config.serialBaudrate,
        autoCut: localConfig.autoCut ?? config.autoCut ?? true,
        paperSize: localConfig.paperSize ?? config.paperSize ?? "80mm",
        printQrCode: config.printQrCode ?? false,
        printName: localConfig.printName ?? config.printName ?? true,
        printCpf: localConfig.printCpf ?? config.printCpf ?? false,
        allowUsbFallback: true,
      },
    };

    const urls = serverUrl
      ? [serverUrl]
      : [`http://${window.location.hostname}:3002/print`, "http://localhost:3002/print"];

    let lastError = "Print server indisponível";

    for (const url of urls) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          await logPrint(ticket.id, "success", "print_server");
          return true;
        }

        lastError = await response.text();
      } catch (err: any) {
        lastError = err?.message || lastError;
      }
    }

    await logPrint(ticket.id, "failed", "print_server", lastError);
    return false;
  } catch (err: any) {
    await logPrint(ticket.id, "failed", "print_server", err.message);
    return false;
  }
}

// ============ METHOD 3: Edge Function (works local & cloud) ============
export async function printViaCloud(ticket: Ticket): Promise<boolean> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !anonKey) {
      await logPrint(ticket.id, "failed", "cloud", "SUPABASE_URL ou ANON_KEY não configurados");
      return false;
    }

    const response = await fetch(
      `${supabaseUrl}/functions/v1/print-ticket`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
        },
        body: JSON.stringify({ ticketId: ticket.id }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      await logPrint(ticket.id, "failed", "cloud", errText);
      return false;
    }

    await logPrint(ticket.id, "success", "cloud");
    return true;
  } catch (err: any) {
    await logPrint(ticket.id, "failed", "cloud", err.message);
    return false;
  }
}

// ============ METHOD 4: Android USB Direct ============
export async function printViaAndroidUsbMethod(ticket: Ticket): Promise<boolean> {
  try {
    const [printerConfig, layoutConfig] = await Promise.all([
      getSystemConfig("printer"),
      getSystemConfig("ticket_layout"),
    ]);
    const config = printerConfig as unknown as PrintConfig;
    const layout = layoutConfig as unknown as TicketLayout;

    const success = await printViaAndroidUsb(
      {
        displayNumber: ticket.display_number,
        type: ticket.ticket_type,
        patientName: ticket.patient_name,
        patientCpf: ticket.patient_cpf,
        createdAt: ticket.created_at,
      },
      layout,
      config
    );

    await logPrint(ticket.id, success ? "success" : "failed", "android_usb", success ? undefined : "USB print failed");
    return success;
  } catch (err: any) {
    await logPrint(ticket.id, "failed", "android_usb", err.message);
    return false;
  }
}

// ============ METHOD 5: WebUSB Direct (no popup, silent) ============
export async function printViaWebUsbMethod(ticket: Ticket): Promise<boolean> {
  try {
    const localConfig = getLocalPrinterConfig();
    const layoutConfig = await getSystemConfig("ticket_layout");
    const layout = (layoutConfig || {}) as unknown as TicketLayout;

    const mergedConfig = {
      autoCut: localConfig.autoCut,
      printName: localConfig.printName,
      printCpf: localConfig.printCpf,
      paperSize: localConfig.paperSize,
    };

    const success = await printViaWebUsb(
      {
        displayNumber: ticket.display_number,
        type: ticket.ticket_type,
        patientName: ticket.patient_name,
        patientCpf: ticket.patient_cpf,
        createdAt: ticket.created_at,
      },
      layout,
      mergedConfig,
      localConfig.vendorId,
      localConfig.productId
    );

    await logPrint(ticket.id, success ? "success" : "failed", "webusb", success ? undefined : "WebUSB print failed");
    return success;
  } catch (err: any) {
    await logPrint(ticket.id, "failed", "webusb", err.message);
    return false;
  }
}

// ============ METHOD 6: Network IP Direct (via print server proxy) ============
/**
 * Sends ESC/POS commands to the printer's IP address via the local print server.
 * The browser cannot open raw TCP sockets directly, so this uses a lightweight
 * print server endpoint that forwards raw bytes to the printer IP:port.
 * 
 * Alternatively, if you have a print server running, it sends directly.
 */
export async function printViaNetworkIp(ticket: Ticket): Promise<boolean> {
  try {
    const [printerConfig, layoutConfig] = await Promise.all([
      getSystemConfig("printer"),
      getSystemConfig("ticket_layout"),
    ]);
    const config = printerConfig as unknown as PrintConfig;
    const layout = layoutConfig as unknown as TicketLayout;

    // Use local device IP first, then global config
    const localIp = typeof window !== "undefined" ? localStorage.getItem("unitech_printer_ip") : null;
    const localPort = typeof window !== "undefined" ? localStorage.getItem("unitech_printer_port") : null;
    const localConfig = getLocalPrinterConfig();

    const printerIp = localIp || config?.ip;
    const printerPort = localPort ? parseInt(localPort) : (config?.port || 9100);

    if (!printerIp) {
      await logPrint(ticket.id, "failed", "network_ip", "IP da impressora não configurado (nem local nem global)");
      return false;
    }

    const payload = {
      ticket: {
        displayNumber: ticket.display_number,
        type: ticket.ticket_type,
        patientName: ticket.patient_name,
        patientCpf: ticket.patient_cpf,
        createdAt: ticket.created_at,
      },
      layout: layout || {},
      printer: {
        connectionType: "network",
        ip: printerIp,
        port: printerPort,
        autoCut: localConfig.autoCut ?? config?.autoCut ?? true,
        paperSize: localConfig.paperSize ?? config?.paperSize ?? "80mm",
        printName: localConfig.printName ?? config?.printName ?? true,
        printCpf: localConfig.printCpf ?? config?.printCpf ?? true,
      },
    };

    console.log("[Print] Network IP payload:", { ip: printerIp, port: printerPort });

    // Try print server endpoints (local print-server.mjs on port 3002)
    const endpoints = [
      `http://${window.location.hostname}:3002/print`,
      `http://localhost:3002/print`,
    ];

    for (const url of endpoints) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(5000),
        });
        if (response.ok) {
          await logPrint(ticket.id, "success", "network_ip");
          return true;
        }
        const errText = await response.text();
        console.warn(`[Print] ${url} responded ${response.status}:`, errText);
      } catch (fetchErr) {
        console.warn(`[Print] ${url} failed:`, fetchErr);
        continue;
      }
    }

    await logPrint(ticket.id, "failed", "network_ip", `Não foi possível conectar ao print server para ${printerIp}:${printerPort}`);
    return false;
  } catch (err: any) {
    await logPrint(ticket.id, "failed", "network_ip", err.message);
    return false;
  }
}
// ============ MAIN PRINT FUNCTION WITH FALLBACK ============
export async function printTicket(
  ticket: Ticket,
  preferredMethod?: PrintMethod
): Promise<{ success: boolean; method: string }> {
  // Check local device config first (totem-level config)
  const localPaired = isLocalPrinterPaired();
  const webUsbAvailable = hasWebUsb();
  const localModeRaw = typeof window !== "undefined" ? window.localStorage.getItem("unitech_print_mode") : null;
  const localPreferredMethod: PrintMethod | null =
    localModeRaw === "android_usb" || localModeRaw === "webusb" || localModeRaw === "browser"
      ? localModeRaw
      : localModeRaw === "network"
        ? "network_ip"
        : null;

  const isAndroidPlatform = isAndroid();
  const hasAndroidLocalMode = isAndroidPlatform;
  const hasWebUsbLocal = localPaired && webUsbAvailable;
  const hasLocalPrinter = hasWebUsbLocal || hasAndroidLocalMode;

  console.log("[Print] Starting print:", {
    ticketId: ticket.id,
    displayNumber: ticket.display_number,
    localPaired,
    webUsbAvailable,
    localPreferredMethod,
    hasAndroidLocalMode,
    hasLocalPrinter,
    preferredMethod,
  });

  // If local WebUSB printer is paired, use it directly — NEVER fall back to browser popup
  if (hasWebUsbLocal && !preferredMethod) {
    try {
      const success = await printViaWebUsbMethod(ticket);
      if (success) return { success: true, method: "webusb" };
      console.warn("[Print] WebUSB falhou. Impressora pareada mas não respondeu.");
      await logPrint(ticket.id, "failed", "webusb", "Impressora pareada mas não respondeu");
      return { success: false, method: "webusb" };
    } catch (err: any) {
      console.error("[Print] WebUSB error:", err);
      await logPrint(ticket.id, "failed", "webusb", err.message);
      return { success: false, method: "webusb" };
    }
  }

  // Fallback: check server printer config
  const config = (await getSystemConfig("printer")) as unknown as PrintConfig;
  console.log("[Print] Server printer config:", { enabled: config?.enabled, connectionType: config?.connectionType });

  // Respect local per-device modes even when global printing is disabled
  if (!config?.enabled && !hasLocalPrinter && localPreferredMethod !== "network_ip" && !isAndroidPlatform) {
    console.log("[Print] Printing disabled (config.enabled=false, no local mode active)");
    return { success: true, method: "disabled" };
  }

  const defaultMethod =
    localPreferredMethod ||
    (isAndroidPlatform ? "android_usb" : webUsbAvailable ? "webusb" : (config?.connectionType === "network" ? "network_ip" : "browser"));
  const method = preferredMethod || defaultMethod;

  // Build fallback chain
  const useSilentOnly = method === "webusb" || method === "android_usb";
  const shouldTryNetwork = localPreferredMethod === "network_ip" || config?.connectionType === "network";

  const methods: { name: PrintMethod; fn: () => Promise<boolean> }[] = [
    ...(isAndroid() ? [{ name: "android_usb" as PrintMethod, fn: () => printViaAndroidUsbMethod(ticket) }] : []),
    ...(webUsbAvailable ? [{ name: "webusb" as PrintMethod, fn: () => printViaWebUsbMethod(ticket) }] : []),
    ...(shouldTryNetwork ? [{ name: "network_ip" as PrintMethod, fn: () => printViaNetworkIp(ticket) }] : []),
    { name: "print_server", fn: () => printViaPrintServer(ticket) },
    ...(!useSilentOnly ? [{ name: "browser" as PrintMethod, fn: () => printViaBrowser(ticket) }] : []),
    { name: "cloud", fn: () => printViaCloud(ticket) },
  ];

  // Try preferred first
  const preferred = methods.find((m) => m.name === method);
  if (preferred) {
    const success = await preferred.fn();
    if (success) return { success: true, method: preferred.name };
  }

  // Fallback: try others
  for (const m of methods) {
    if (m.name === method) continue;
    try {
      const success = await m.fn();
      if (success) return { success: true, method: m.name };
    } catch {
      continue;
    }
  }

  await logPrint(ticket.id, "pending", "all_failed", "Todos os métodos falharam");
  return { success: false, method: "none" };
}

// Generate ticket HTML for preview
export async function getTicketPreviewHtml(ticket: Partial<Ticket>): Promise<string> {
  const [printerConfig, layoutConfig] = await Promise.all([
    getSystemConfig("printer"),
    getSystemConfig("ticket_layout"),
  ]);
  const config = (printerConfig || {}) as unknown as PrintConfig;
  const layout = (layoutConfig || {}) as unknown as TicketLayout;
  const mockTicket = {
    id: "preview",
    display_number: ticket.display_number || "N0001",
    ticket_type: ticket.ticket_type || "normal",
    patient_name: ticket.patient_name || "João da Silva",
    patient_cpf: ticket.patient_cpf || "000.000.000-00",
    created_at: new Date().toISOString(),
    ...ticket,
  } as Ticket;
  return buildTicketHtml(mockTicket, layout, config);
}
