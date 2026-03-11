import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Ticket, Counter } from "@/lib/ticket-service";
import { getCalledTickets, getWaitingTickets, getCounters } from "@/lib/ticket-service";

export function useRealtimeTickets() {
  const [calledTickets, setCalledTickets] = useState<any[]>([]);
  const [waitingTickets, setWaitingTickets] = useState<any[]>([]);
  const [counters, setCounters] = useState<any[]>([]);
  const [lastCalled, setLastCalled] = useState<any | null>(null);
  const lastCalledKeyRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const [calledResult, waitingResult, ctrsResult] = await Promise.allSettled([
      getCalledTickets(),
      getWaitingTickets(),
      getCounters(),
    ]);

    const called = calledResult.status === "fulfilled" ? calledResult.value || [] : [];
    const waiting = waitingResult.status === "fulfilled" ? waitingResult.value || [] : [];
    const ctrs = ctrsResult.status === "fulfilled" ? ctrsResult.value || [] : [];

    setCalledTickets(called);
    setWaitingTickets(waiting);
    setCounters(ctrs);

    // Detect new called/in_service ticket or recall (called_at changed)
    if (called.length > 0) {
      const newest = called[0];
      const key = `${newest.id}_${newest.called_at}`;
      if (key !== lastCalledKeyRef.current) {
        lastCalledKeyRef.current = key;
        setLastCalled({ ...newest });
      }
    }
  }, []);

  useEffect(() => {
    refresh();

    const ticketChannel = supabase
      .channel("tickets-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        () => {
          refresh();
        }
      )
      .subscribe();

    const counterChannel = supabase
      .channel("counters-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "counters" },
        () => refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ticketChannel);
      supabase.removeChannel(counterChannel);
    };
  }, [refresh]);

  return { calledTickets, waitingTickets, counters, lastCalled, refresh };
}
