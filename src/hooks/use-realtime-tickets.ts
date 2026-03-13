import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Ticket, Counter } from "@/lib/ticket-service";
import { getCalledTickets, getWaitingTickets, getCounters } from "@/lib/ticket-service";

export function useRealtimeTickets() {
  const [calledTickets, setCalledTickets] = useState<any[]>([]);
  const [waitingTickets, setWaitingTickets] = useState<any[]>([]);
  const [counters, setCounters] = useState<any[]>([]);
  const [lastCalled, setLastCalled] = useState<any | null>(null);
  
  // Track ALL announced ticket keys to detect new ones
  const announcedKeysRef = useRef<Set<string>>(new Set());
  const pendingAnnouncementsRef = useRef<any[]>([]);
  const isProcessingRef = useRef(false);
  const initialLoadDoneRef = useRef(false);

  const processNextAnnouncement = useCallback(() => {
    if (isProcessingRef.current) return;
    const next = pendingAnnouncementsRef.current.shift();
    if (!next) return;
    isProcessingRef.current = true;
    setLastCalled({ ...next, _announceKey: `${next.id}_${next.called_at}` });
    // The Panel will pick up lastCalled change and enqueue speech.
    // We wait a short time then allow next announcement to be set.
    // The actual speech queue in Panel handles the real timing.
    setTimeout(() => {
      isProcessingRef.current = false;
      processNextAnnouncement();
    }, 500);
  }, []);

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

    if (!initialLoadDoneRef.current) {
      // On first load, mark all existing as already announced (don't replay)
      called.forEach((t: any) => {
        announcedKeysRef.current.add(`${t.id}_${t.called_at}`);
      });
      initialLoadDoneRef.current = true;
      return;
    }

    // Find ALL tickets that haven't been announced yet
    const newCalls: any[] = [];
    for (const ticket of called) {
      const key = `${ticket.id}_${ticket.called_at}`;
      if (!announcedKeysRef.current.has(key) && ticket.called_at) {
        announcedKeysRef.current.add(key);
        newCalls.push(ticket);
      }
    }

    // Sort by called_at ascending (oldest first)
    newCalls.sort((a: any, b: any) => 
      new Date(a.called_at).getTime() - new Date(b.called_at).getTime()
    );

    if (newCalls.length > 0) {
      pendingAnnouncementsRef.current.push(...newCalls);
      processNextAnnouncement();
    }
  }, [processNextAnnouncement]);

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
