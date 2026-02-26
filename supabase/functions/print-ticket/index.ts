import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { ticketId } = await req.json();

    // Get ticket data
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", ticketId)
      .single();

    if (ticketError || !ticket) {
      return new Response(
        JSON.stringify({ error: "Ticket não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get printer config
    const { data: printerConfig } = await supabase
      .from("system_config")
      .select("value")
      .eq("key", "printer")
      .single();

    const { data: layoutConfig } = await supabase
      .from("system_config")
      .select("value")
      .eq("key", "ticket_layout")
      .single();

    const config = printerConfig?.value || {};
    const layout = layoutConfig?.value || {};

    // Build ESC/POS command buffer
    const commands = buildEscPosCommands(ticket, config, layout);

    // Log the print attempt
    await supabase.from("print_logs").insert({
      ticket_id: ticketId,
      status: "success",
      print_method: "cloud",
    });

    // Return ESC/POS commands as base64 for the local agent to process
    const encoder = new TextEncoder();
    const encoded = btoa(String.fromCharCode(...encoder.encode(commands.join("\n"))));

    return new Response(
      JSON.stringify({
        success: true,
        ticket: {
          displayNumber: ticket.display_number,
          type: ticket.ticket_type,
          patientName: ticket.patient_name,
          patientCpf: ticket.patient_cpf,
          createdAt: ticket.created_at,
        },
        escpos: encoded,
        printerConfig: {
          connectionType: (config as any).connectionType,
          ip: (config as any).ip,
          port: (config as any).port,
          autoCut: (config as any).autoCut,
          paperSize: (config as any).paperSize,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildEscPosCommands(
  ticket: any,
  config: any,
  layout: any
): string[] {
  const commands: string[] = [];
  
  // ESC/POS init
  commands.push("\x1B\x40"); // Initialize printer
  commands.push("\x1B\x61\x01"); // Center align

  // Clinic name
  if (layout.clinicName) {
    commands.push("\x1B\x45\x01"); // Bold on
    commands.push(layout.clinicName);
    commands.push("\x1B\x45\x00"); // Bold off
    commands.push("\n");
  }

  // Header
  if (layout.header) {
    commands.push(layout.header);
    commands.push("\n");
  }

  // Separator
  commands.push("--------------------------------\n");

  // SENHA label
  commands.push("\x1B\x45\x01"); // Bold
  commands.push("SENHA\n");
  
  // Ticket number (large)
  commands.push("\x1D\x21\x11"); // Double height + width
  commands.push(ticket.display_number);
  commands.push("\x1D\x21\x00"); // Normal size
  commands.push("\n");
  commands.push("\x1B\x45\x00"); // Bold off

  // Type
  const typeLabel: Record<string, string> = {
    normal: "Normal",
    priority: "Prioritário",
    preferential: "Preferencial",
  };
  commands.push(`Tipo: ${typeLabel[ticket.ticket_type] || ticket.ticket_type}\n`);

  // Date
  if (layout.showDateTime !== false) {
    const date = new Date(ticket.created_at);
    commands.push(`Data: ${date.toLocaleDateString("pt-BR")} ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}\n`);
  }

  // Patient info
  if (config.printName && ticket.patient_name) {
    commands.push(`Nome: ${ticket.patient_name}\n`);
  }
  if (config.printCpf && ticket.patient_cpf) {
    commands.push(`CPF: ${ticket.patient_cpf}\n`);
  }

  // Separator
  commands.push("--------------------------------\n");

  // Footer
  if (layout.footer) {
    commands.push(layout.footer);
    commands.push("\n");
  }

  // LGPD
  if (layout.lgpdNotice) {
    commands.push("\x1B\x4D\x01"); // Small font
    commands.push(layout.lgpdNotice);
    commands.push("\x1B\x4D\x00"); // Normal font
    commands.push("\n");
  }

  // Feed and cut
  commands.push("\n\n\n");
  if (config.autoCut !== false) {
    commands.push("\x1D\x56\x00"); // Full cut
  }

  return commands;
}
