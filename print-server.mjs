/**
 * Print Server Local — Recebe requisições HTTP do frontend e envia
 * comandos ESC/POS para impressoras de rede via TCP (porta 9100).
 *
 * Uso: node print-server.mjs
 * PM2:  pm2 start ecosystem.config.cjs
 *
 * Endpoint: POST http://localhost:3002/print
 */

import http from "node:http";
import net from "node:net";

const PORT = process.env.PRINT_SERVER_PORT || 3002;

// ── ESC/POS helpers ──────────────────────────────────────────────
const ESC = 0x1b;
const GS = 0x1d;

const CMD = {
  INIT: Buffer.from([ESC, 0x40]),
  CENTER: Buffer.from([ESC, 0x61, 0x01]),
  LEFT: Buffer.from([ESC, 0x61, 0x00]),
  BOLD_ON: Buffer.from([ESC, 0x45, 0x01]),
  BOLD_OFF: Buffer.from([ESC, 0x45, 0x00]),
  DOUBLE_SIZE: Buffer.from([GS, 0x21, 0x11]),
  NORMAL_SIZE: Buffer.from([GS, 0x21, 0x00]),
  LARGE_SIZE: Buffer.from([GS, 0x21, 0x01]),
  CUT: Buffer.from([GS, 0x56, 0x00]),
  PARTIAL_CUT: Buffer.from([GS, 0x56, 0x01]),
  FEED3: Buffer.from([ESC, 0x64, 0x03]),
  LINE: Buffer.from("--------------------------------\n"),
};

function textToBuffer(text) {
  return Buffer.from(text, "utf-8");
}

function buildEscPos(ticket, layout = {}, printer = {}) {
  const buffers = [CMD.INIT, CMD.CENTER];

  // Header / clinic name
  if (layout.clinicName) {
    buffers.push(CMD.BOLD_ON, textToBuffer(layout.clinicName + "\n"), CMD.BOLD_OFF);
  }
  if (layout.header) {
    buffers.push(textToBuffer(layout.header + "\n"));
  }

  buffers.push(CMD.LINE);

  // Ticket number
  buffers.push(CMD.BOLD_ON, textToBuffer("SENHA\n"), CMD.BOLD_OFF);
  buffers.push(CMD.DOUBLE_SIZE, textToBuffer(ticket.displayNumber + "\n"), CMD.NORMAL_SIZE);

  // Type
  const typeLabels = { normal: "Normal", priority: "Prioritario", preferential: "Preferencial" };
  buffers.push(textToBuffer("Tipo: " + (typeLabels[ticket.type] || ticket.type) + "\n"));

  // Date/time
  if (layout.showDateTime !== false) {
    const d = new Date(ticket.createdAt);
    const dateStr = d.toLocaleDateString("pt-BR");
    const timeStr = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    buffers.push(textToBuffer(`Data: ${dateStr} ${timeStr}\n`));
  }

  // Name / CPF
  if (printer.printName && ticket.patientName) {
    buffers.push(textToBuffer("Nome: " + ticket.patientName + "\n"));
  }
  if (printer.printCpf && ticket.patientCpf) {
    buffers.push(textToBuffer("CPF: " + ticket.patientCpf + "\n"));
  }

  buffers.push(CMD.LINE);

  // Custom message
  if (layout.customMessage) {
    buffers.push(textToBuffer(layout.customMessage + "\n"));
  }

  // Footer
  if (layout.footer) {
    buffers.push(textToBuffer(layout.footer + "\n"));
  }
  if (layout.lgpdNotice) {
    buffers.push(textToBuffer(layout.lgpdNotice + "\n"));
  }

  // Feed + Cut
  buffers.push(CMD.FEED3);
  if (printer.autoCut !== false) {
    buffers.push(CMD.PARTIAL_CUT);
  }

  return Buffer.concat(buffers);
}

// ── TCP send to printer ──────────────────────────────────────────
function sendToPrinter(ip, port, data) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket.setTimeout(5000);

    socket.connect(port, ip, () => {
      socket.write(data, () => {
        socket.end();
        resolve(true);
      });
    });

    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error(`Timeout conectando a ${ip}:${port}`));
    });

    socket.on("error", (err) => {
      socket.destroy();
      reject(err);
    });
  });
}

// ── CORS headers ─────────────────────────────────────────────────
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

// ── HTTP Server ──────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  // Health check
  if (req.method === "GET" && (req.url === "/" || req.url === "/health")) {
    res.writeHead(200, { ...corsHeaders(), "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "print-server" }));
    return;
  }

  // Print endpoint
  if (req.method === "POST" && req.url === "/print") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const { ticket, layout, printer } = JSON.parse(body);

        if (!ticket?.displayNumber) {
          res.writeHead(400, { ...corsHeaders(), "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "ticket.displayNumber obrigatório" }));
          return;
        }

        const ip = printer?.ip;
        const port = printer?.port || 9100;

        if (!ip) {
          res.writeHead(400, { ...corsHeaders(), "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "printer.ip obrigatório" }));
          return;
        }

        const escPosData = buildEscPos(ticket, layout || {}, printer || {});

        console.log(`[Print] Enviando para ${ip}:${port} — Senha: ${ticket.displayNumber}`);

        await sendToPrinter(ip, port, escPosData);

        console.log(`[Print] ✅ Impresso com sucesso: ${ticket.displayNumber}`);

        res.writeHead(200, { ...corsHeaders(), "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, displayNumber: ticket.displayNumber }));
      } catch (err) {
        console.error(`[Print] ❌ Erro:`, err.message);
        res.writeHead(500, { ...corsHeaders(), "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, corsHeaders());
  res.end("Not Found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🖨️  Print Server rodando em http://0.0.0.0:${PORT}`);
  console.log(`   POST /print — Envia ESC/POS para impressora de rede`);
  console.log(`   GET  /health — Health check`);
});
