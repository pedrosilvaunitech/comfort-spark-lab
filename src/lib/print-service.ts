import { logPrint, getSystemConfig } from "./ticket-service";
import type { Ticket } from "./ticket-service";

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

export type PrintMethod = "browser" | "print_server" | "cloud";

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
    const config = printerConfig as unknown as PrintConfig;
    const layout = layoutConfig as unknown as TicketLayout;

    const url = serverUrl || "http://localhost:3001/print";

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
        connectionType: config.connectionType,
        ip: config.ip,
        port: config.port,
        usbVendorId: config.usbVendorId,
        usbProductId: config.usbProductId,
        serialPort: config.serialPort,
        serialBaudrate: config.serialBaudrate,
        autoCut: config.autoCut,
        paperSize: config.paperSize,
        printQrCode: config.printQrCode,
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      await logPrint(ticket.id, "failed", "print_server", errText);
      return false;
    }

    await logPrint(ticket.id, "success", "print_server");
    return true;
  } catch (err: any) {
    await logPrint(ticket.id, "failed", "print_server", err.message);
    return false;
  }
}

// ============ METHOD 3: Cloud Edge Function ============
export async function printViaCloud(ticket: Ticket): Promise<boolean> {
  try {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/print-ticket`,
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

// ============ MAIN PRINT FUNCTION WITH FALLBACK ============
export async function printTicket(
  ticket: Ticket,
  preferredMethod?: PrintMethod
): Promise<{ success: boolean; method: string }> {
  const config = (await getSystemConfig("printer")) as unknown as PrintConfig;
  if (!config?.enabled) {
    return { success: true, method: "disabled" };
  }

  const method = preferredMethod || "browser";
  const methods: { name: PrintMethod; fn: () => Promise<boolean> }[] = [
    { name: "browser", fn: () => printViaBrowser(ticket) },
    { name: "print_server", fn: () => printViaPrintServer(ticket) },
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

  // All failed - save as pending for retry
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
