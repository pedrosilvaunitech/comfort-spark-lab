import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Ticket = Tables<"tickets">;
export type ServiceType = Tables<"service_types">;
export type Counter = Tables<"counters">;
export type PrintLog = Tables<"print_logs">;
export type SystemConfig = Tables<"system_config">;

export async function getServiceTypes() {
  const { data, error } = await supabase
    .from("service_types")
    .select("*")
    .eq("is_active", true)
    .order("display_order");
  if (error) throw error;
  return data;
}

export async function getCounters() {
  const { data, error } = await supabase
    .from("counters")
    .select("*, tickets!counters_current_ticket_fk(*)")
    .eq("is_active", true)
    .order("number");
  if (error) throw error;
  return data;
}

export async function generateTicket(
  serviceTypeId: string,
  ticketType: "normal" | "priority" | "preferential" = "normal",
  patientName?: string,
  patientCpf?: string
): Promise<Ticket> {
  const today = new Date().toISOString().split("T")[0];

  const { data: seq } = await supabase
    .from("daily_sequence")
    .select("*")
    .eq("date", today)
    .is("service_type_id", null)
    .single();

  let nextNumber: number;
  if (seq) {
    nextNumber = seq.last_number + 1;
    await supabase.from("daily_sequence").update({ last_number: nextNumber }).eq("id", seq.id);
  } else {
    nextNumber = 1;
    await supabase.from("daily_sequence").insert({ date: today, service_type_id: null, last_number: 1 });
  }

  const { data: serviceType } = await supabase
    .from("service_types")
    .select("prefix")
    .eq("id", serviceTypeId)
    .single();

  const prefix = serviceType?.prefix || "N";
  const numStr = String(nextNumber).padStart(4, "0");
  const displayNumber = `${prefix} ${numStr}`;
  const ticketNumber = `${today}-${prefix}${numStr}`;

  const { data, error } = await supabase
    .from("tickets")
    .insert({
      ticket_number: ticketNumber,
      display_number: displayNumber,
      ticket_type: ticketType,
      service_type_id: serviceTypeId,
      patient_name: patientName || null,
      patient_cpf: patientCpf || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function callNextTicket(counterId: string): Promise<Ticket | null> {
  const { data: counter } = await supabase.from("counters").select("*").eq("id", counterId).single();
  if (!counter) throw new Error("Guichê não encontrado");

  if (counter.current_ticket_id) {
    await supabase.from("tickets")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", counter.current_ticket_id);
  }

  // Load priority settings
  const priorityRaw = await getSystemConfig("priority_settings");
  const priority = priorityRaw as unknown as {
    enabled?: boolean; mode?: string; percentage?: number; everyN?: number;
    burstCount?: number; includePreferential?: boolean;
  } | null;

  let nextTicket: Ticket | null = null;
  const priorityTypes: ("normal" | "priority" | "preferential")[] = ["priority"];
  if (priority?.includePreferential !== false) priorityTypes.push("preferential");

  const shouldCallPriority = await determinePriority(priority);

  if (shouldCallPriority) {
    // Try to get a priority/preferential ticket first
    const { data } = await supabase
      .from("tickets")
      .select("*")
      .eq("status", "waiting")
      .in("ticket_type", priorityTypes)
      .order("created_at", { ascending: true })
      .limit(1)
      .single();
    nextTicket = data;
  }

  if (!nextTicket) {
    // Fall back to any waiting ticket (FIFO)
    const { data } = await supabase
      .from("tickets")
      .select("*")
      .eq("status", "waiting")
      .order("created_at", { ascending: true })
      .limit(1)
      .single();
    nextTicket = data;
  }

  if (!nextTicket) {
    await supabase.from("counters").update({ current_ticket_id: null }).eq("id", counterId);
    return null;
  }

  // Track normal call count for every_n mode
  if (nextTicket.ticket_type === "normal") {
    await incrementNormalCallCount();
  } else {
    await resetNormalCallCount();
  }

  const { data: updatedTicket, error } = await supabase
    .from("tickets")
    .update({
      status: "in_service",
      counter_id: counterId,
      called_at: new Date().toISOString(),
    })
    .eq("id", nextTicket.id)
    .select()
    .single();

  if (error) throw error;

  await supabase.from("counters").update({ current_ticket_id: nextTicket.id }).eq("id", counterId);
  return updatedTicket;
}

async function determinePriority(settings: any): Promise<boolean> {
  if (!settings?.enabled) {
    // Default behavior: priority first (legacy)
    return true;
  }

  const mode = settings.mode || "always_first";

  if (mode === "always_first") return true;

  if (mode === "percentage") {
    const pct = settings.percentage || 30;
    return Math.random() * 100 < pct;
  }

  if (mode === "every_n") {
    const everyN = settings.everyN || 3;
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("system_config")
      .select("value")
      .eq("key", "normal_call_count")
      .single();
    const count = (data?.value as any)?.count || 0;
    return count >= everyN;
  }

  return true;
}

async function incrementNormalCallCount() {
  const { data } = await supabase.from("system_config").select("*").eq("key", "normal_call_count").single();
  const current = (data?.value as any)?.count || 0;
  if (data) {
    await supabase.from("system_config").update({ value: { count: current + 1 } as any }).eq("key", "normal_call_count");
  } else {
    await supabase.from("system_config").insert({ key: "normal_call_count", value: { count: 1 } as any });
  }
}

async function resetNormalCallCount() {
  const { data } = await supabase.from("system_config").select("*").eq("key", "normal_call_count").single();
  if (data) {
    await supabase.from("system_config").update({ value: { count: 0 } as any }).eq("key", "normal_call_count");
  } else {
    await supabase.from("system_config").insert({ key: "normal_call_count", value: { count: 0 } as any });
  }
}

export async function startService(ticketId: string) {
  const { error } = await supabase.from("tickets").update({ status: "in_service" }).eq("id", ticketId);
  if (error) throw error;
}

export async function completeTicket(ticketId: string, counterId: string) {
  await supabase.from("tickets")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", ticketId);
  await supabase.from("counters").update({ current_ticket_id: null }).eq("id", counterId);
}

export async function markNoShow(ticketId: string, counterId: string) {
  await supabase.from("tickets").update({ status: "no_show" }).eq("id", ticketId);
  await supabase.from("counters").update({ current_ticket_id: null }).eq("id", counterId);
}

export async function getWaitingTickets() {
  const { data, error } = await supabase
    .from("tickets")
    .select("*, service_types(*)")
    .eq("status", "waiting")
    .order("created_at");
  if (error) throw error;
  return data;
}

export async function getCalledTickets() {
  const { data, error } = await supabase
    .from("tickets")
    .select("*, service_types(*), counters!tickets_counter_id_fkey(*)")
    .in("status", ["called", "in_service", "completed", "no_show"])
    .not("called_at", "is", null)
    .order("called_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return data;
}

export async function getTodayTickets() {
  const today = new Date().toISOString().split("T")[0];
  const { data, error } = await supabase
    .from("tickets")
    .select("*, service_types(*), counters!tickets_counter_id_fkey(*)")
    .gte("created_at", `${today}T00:00:00`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getSystemConfig(key: string) {
  const { data, error } = await supabase
    .from("system_config")
    .select("value")
    .eq("key", key)
    .single();
  if (error) return null;
  return data?.value;
}

export async function updateSystemConfig(key: string, value: Record<string, unknown>) {
  const { error } = await supabase
    .from("system_config")
    .upsert(
      { key, value: value as any, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
  if (error) throw error;
}

export async function logPrint(
  ticketId: string,
  status: "success" | "failed" | "pending",
  printMethod: string,
  errorMessage?: string
) {
  await supabase.from("print_logs").insert({
    ticket_id: ticketId,
    status,
    print_method: printMethod,
    error_message: errorMessage || null,
  });
}

export async function getPrintLogs() {
  const { data, error } = await supabase
    .from("print_logs")
    .select("*, tickets(*)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data;
}

export async function getPendingPrints() {
  const { data, error } = await supabase
    .from("print_logs")
    .select("*, tickets(*)")
    .eq("status", "pending")
    .order("created_at");
  if (error) throw error;
  return data;
}

export async function resetAllTicketsComplete() {
  const today = new Date().toISOString().split("T")[0];

  // Reset all counters' current ticket
  await supabase.from("counters").update({ current_ticket_id: null }).neq("id", "00000000-0000-0000-0000-000000000000");

  // Cancel ALL tickets from today (waiting, called, in_service)
  await supabase
    .from("tickets")
    .update({ status: "cancelled", completed_at: new Date().toISOString() })
    .gte("created_at", `${today}T00:00:00`)
    .in("status", ["waiting", "called", "in_service"]);

  // Reset daily sequence to 0
  await supabase
    .from("daily_sequence")
    .update({ last_number: 0 })
    .eq("date", today);
}

// Keep old names for backward compat
export const resetCalledTickets = resetAllTicketsComplete;
export const resetAllTickets = resetAllTicketsComplete;
