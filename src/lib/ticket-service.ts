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
  const displayNumber = `${prefix}${String(nextNumber).padStart(4, "0")}`;
  const ticketNumber = `${today}-${displayNumber}`;

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

  const { data: nextTicket } = await supabase
    .from("tickets")
    .select("*")
    .eq("status", "waiting")
    .order("ticket_type", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (!nextTicket) {
    await supabase.from("counters").update({ current_ticket_id: null }).eq("id", counterId);
    return null;
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
    .update({ value: value as any })
    .eq("key", key);
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

export async function resetCalledTickets() {
  const today = new Date().toISOString().split("T")[0];

  // Reset all counters' current ticket
  await supabase.from("counters").update({ current_ticket_id: null }).neq("id", "00000000-0000-0000-0000-000000000000");

  // Cancel only called/in_service tickets (NOT waiting ones, keep the queue)
  await supabase
    .from("tickets")
    .update({ status: "cancelled", completed_at: new Date().toISOString() })
    .gte("created_at", `${today}T00:00:00`)
    .in("status", ["called", "in_service"]);
}

// Keep old name for backward compat but redirect to new behavior
export const resetAllTickets = resetCalledTickets;
