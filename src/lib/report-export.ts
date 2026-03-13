import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ExportData {
  tickets: any[];
  stats: {
    total: number; waiting: number; called: number; inService: number;
    completed: number; noShow: number; cancelled: number;
  };
  operatorStats: any[];
  serviceStats: any[];
  hourlyStats: any[];
  avgWaitTime: number;
  avgServiceTime: number;
  dateFrom: Date;
  dateTo: Date;
  periodLabel: string;
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    waiting: "Aguardando", called: "Chamado", in_service: "Em Atendimento",
    completed: "Concluído", no_show: "Não Compareceu", cancelled: "Cancelado",
  };
  return map[status] || status;
}

function ticketTypeLabel(type: string): string {
  const map: Record<string, string> = {
    normal: "Normal", priority: "Prioritário", preferential: "Preferencial",
  };
  return map[type] || type;
}

function formatDateTime(dt: string | null): string {
  if (!dt) return "—";
  return format(new Date(dt), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
}

function formatTime(dt: string | null): string {
  if (!dt) return "—";
  return format(new Date(dt), "HH:mm:ss", { locale: ptBR });
}

function calcMinutes(from: string | null, to: string | null): string {
  if (!from || !to) return "—";
  const diff = (new Date(to).getTime() - new Date(from).getTime()) / 60000;
  return `${Math.round(diff)} min`;
}

// ==================== EXCEL EXPORT ====================

export function exportToExcel(data: ExportData) {
  const wb = XLSX.utils.book_new();
  const period = data.periodLabel;

  // --- Sheet 1: Resumo Geral ---
  const resumoData = [
    ["RELATÓRIO DE ATENDIMENTO"],
    [`Período: ${period}`],
    [`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`],
    [],
    ["RESUMO GERAL"],
    ["Indicador", "Valor"],
    ["Total de Senhas", data.stats.total],
    ["Aguardando", data.stats.waiting],
    ["Chamados", data.stats.called],
    ["Em Atendimento", data.stats.inService],
    ["Concluídos", data.stats.completed],
    ["Não Compareceu", data.stats.noShow],
    ["Cancelados", data.stats.cancelled],
    [],
    ["TEMPOS MÉDIOS"],
    ["Tempo Médio de Espera", `${data.avgWaitTime} min`],
    ["Tempo Médio de Atendimento", `${data.avgServiceTime} min`],
    ["Taxa de Conclusão", data.stats.total > 0 ? `${Math.round((data.stats.completed / data.stats.total) * 100)}%` : "0%"],
  ];
  const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
  wsResumo["!cols"] = [{ wch: 30 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

  // --- Sheet 2: Todas as Senhas (detalhado) ---
  const ticketHeaders = [
    "Senha", "Tipo", "Prioridade", "Status", "Paciente", "CPF",
    "Tipo de Serviço", "Guichê", "Operador",
    "Criado em", "Chamado em", "Concluído em",
    "Tempo Espera", "Tempo Atendimento",
  ];

  const ticketRows = data.tickets.map((t) => [
    t.display_number,
    t.service_types?.name || "—",
    ticketTypeLabel(t.ticket_type),
    statusLabel(t.status),
    t.patient_name || "—",
    t.patient_cpf || "—",
    t.service_types?.name || "—",
    t.counters?.name || "—",
    t.operator_name || "—",
    formatDateTime(t.created_at),
    formatDateTime(t.called_at),
    formatDateTime(t.completed_at),
    calcMinutes(t.created_at, t.called_at),
    calcMinutes(t.called_at, t.completed_at),
  ]);

  const wsTickets = XLSX.utils.aoa_to_sheet([ticketHeaders, ...ticketRows]);
  wsTickets["!cols"] = ticketHeaders.map((h) => ({ wch: Math.max(h.length + 2, 16) }));
  XLSX.utils.book_append_sheet(wb, wsTickets, "Senhas Detalhadas");

  // --- Sheet 3: Por Operador ---
  const opHeaders = [
    "Operador", "Total", "Concluídos", "Não Compareceu",
    "Espera Média (min)", "Atend. Médio (min)", "Taxa Conclusão", "Senhas/Hora",
  ];
  const opRows = data.operatorStats.map((op) => [
    op.name,
    op.total,
    op.completed,
    op.noShow,
    op.avgWait,
    op.avgTime,
    op.total > 0 ? `${Math.round((op.completed / op.total) * 100)}%` : "0%",
    op.avgTime > 0 ? (60 / op.avgTime).toFixed(1) : "—",
  ]);
  const wsOp = XLSX.utils.aoa_to_sheet([opHeaders, ...opRows]);
  wsOp["!cols"] = opHeaders.map((h) => ({ wch: Math.max(h.length + 2, 14) }));
  XLSX.utils.book_append_sheet(wb, wsOp, "Por Operador");

  // --- Sheet 4: Por Tipo de Serviço ---
  const svcHeaders = ["Tipo de Serviço", "Quantidade", "Percentual"];
  const svcRows = data.serviceStats.map((s) => [
    s.name,
    s.count,
    data.stats.total > 0 ? `${Math.round((s.count / data.stats.total) * 100)}%` : "0%",
  ]);
  const wsSvc = XLSX.utils.aoa_to_sheet([svcHeaders, ...svcRows]);
  wsSvc["!cols"] = svcHeaders.map((h) => ({ wch: Math.max(h.length + 2, 18) }));
  XLSX.utils.book_append_sheet(wb, wsSvc, "Por Tipo de Serviço");

  // --- Sheet 5: Por Hora ---
  const hourHeaders = ["Hora", "Quantidade"];
  const hourRows = data.hourlyStats.map((h) => [h.hour, h.count]);
  const wsHour = XLSX.utils.aoa_to_sheet([hourHeaders, ...hourRows]);
  wsHour["!cols"] = [{ wch: 10 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsHour, "Por Hora");

  // Download
  const fileName = `relatorio_${format(data.dateFrom, "yyyy-MM-dd")}_${format(data.dateTo, "yyyy-MM-dd")}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

// ==================== PDF EXPORT ====================

export function exportToPDF(data: ExportData) {
  const doc = new jsPDF("landscape", "mm", "a4");
  const period = data.periodLabel;
  const pageWidth = doc.internal.pageSize.getWidth();

  // Helper: centered title
  const addTitle = (text: string, y: number, size = 16) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", "bold");
    doc.text(text, pageWidth / 2, y, { align: "center" });
  };

  const addSubtitle = (text: string, y: number) => {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(text, pageWidth / 2, y, { align: "center" });
  };

  // --- Page 1: Resumo ---
  addTitle("Relatório de Atendimento", 20);
  addSubtitle(`Período: ${period}  |  Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 28);

  autoTable(doc, {
    startY: 36,
    head: [["Indicador", "Valor"]],
    body: [
      ["Total de Senhas", String(data.stats.total)],
      ["Aguardando", String(data.stats.waiting)],
      ["Chamados", String(data.stats.called)],
      ["Em Atendimento", String(data.stats.inService)],
      ["Concluídos", String(data.stats.completed)],
      ["Não Compareceu", String(data.stats.noShow)],
      ["Cancelados", String(data.stats.cancelled)],
      ["", ""],
      ["Tempo Médio de Espera", `${data.avgWaitTime} min`],
      ["Tempo Médio de Atendimento", `${data.avgServiceTime} min`],
      ["Taxa de Conclusão", data.stats.total > 0 ? `${Math.round((data.stats.completed / data.stats.total) * 100)}%` : "0%"],
    ],
    theme: "grid",
    headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 40, right: 40 },
    columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 60, halign: "center" } },
  });

  // --- Page 2: Desempenho por Operador ---
  if (data.operatorStats.length > 0) {
    doc.addPage();
    addTitle("Desempenho por Operador", 20);
    addSubtitle(`Período: ${period}`, 28);

    autoTable(doc, {
      startY: 36,
      head: [["Operador", "Total", "Concluídos", "Não Compareceu", "Espera Média", "Atend. Médio", "Taxa Conclusão", "Senhas/Hora"]],
      body: data.operatorStats.map((op) => [
        op.name,
        String(op.total),
        String(op.completed),
        String(op.noShow),
        `${op.avgWait} min`,
        `${op.avgTime} min`,
        op.total > 0 ? `${Math.round((op.completed / op.total) * 100)}%` : "0%",
        op.avgTime > 0 ? (60 / op.avgTime).toFixed(1) : "—",
      ]),
      theme: "grid",
      headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        1: { halign: "center" }, 2: { halign: "center" }, 3: { halign: "center" },
        4: { halign: "center" }, 5: { halign: "center" }, 6: { halign: "center" }, 7: { halign: "center" },
      },
    });
  }

  // --- Page 3: Por Tipo de Serviço ---
  if (data.serviceStats.length > 0) {
    doc.addPage();
    addTitle("Senhas por Tipo de Serviço", 20);
    addSubtitle(`Período: ${period}`, 28);

    autoTable(doc, {
      startY: 36,
      head: [["Tipo de Serviço", "Quantidade", "Percentual"]],
      body: data.serviceStats.map((s) => [
        s.name,
        String(s.count),
        data.stats.total > 0 ? `${Math.round((s.count / data.stats.total) * 100)}%` : "0%",
      ]),
      theme: "grid",
      headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 40, right: 40 },
      columnStyles: { 1: { halign: "center" }, 2: { halign: "center" } },
    });
  }

  // --- Page 4: Distribuição por Hora ---
  if (data.hourlyStats.length > 0) {
    doc.addPage();
    addTitle("Distribuição por Hora", 20);
    addSubtitle(`Período: ${period}`, 28);

    autoTable(doc, {
      startY: 36,
      head: [["Hora", "Quantidade"]],
      body: data.hourlyStats.map((h) => [h.hour, String(h.count)]),
      theme: "grid",
      headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 60, right: 60 },
      columnStyles: { 0: { halign: "center" }, 1: { halign: "center" } },
    });
  }

  // --- Page 5+: Lista de Senhas ---
  doc.addPage();
  addTitle("Lista Detalhada de Senhas", 20);
  addSubtitle(`Período: ${period}  |  Total: ${data.tickets.length} senhas`, 28);

  autoTable(doc, {
    startY: 36,
    head: [["Senha", "Tipo Serviço", "Prioridade", "Status", "Paciente", "Guichê", "Operador", "Criado", "Chamado", "Espera", "Atend."]],
    body: data.tickets.map((t) => [
      t.display_number,
      t.service_types?.name || "—",
      ticketTypeLabel(t.ticket_type),
      statusLabel(t.status),
      t.patient_name || "—",
      t.counters?.name || "—",
      t.operator_name || "—",
      formatTime(t.created_at),
      formatTime(t.called_at),
      calcMinutes(t.created_at, t.called_at),
      calcMinutes(t.called_at, t.completed_at),
    ]),
    theme: "grid",
    headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: "bold", fontSize: 7 },
    bodyStyles: { fontSize: 7 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    didDrawPage: (pageData) => {
      // Footer with page numbers
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(
        `Página ${pageData.pageNumber} de ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
      );
    },
  });

  // Add page numbers to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Página ${i} de ${totalPages}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }

  const fileName = `relatorio_${format(data.dateFrom, "yyyy-MM-dd")}_${format(data.dateTo, "yyyy-MM-dd")}.pdf`;
  doc.save(fileName);
}
