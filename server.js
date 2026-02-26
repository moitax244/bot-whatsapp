const express = require("express");
const wppconnect = require("@wppconnect-team/wppconnect");

const app = express();
app.use(express.json());

let client = null;
let wppReady = false;
let lastWppError = null;
let lastQr = null;

// evita crash silencioso
process.on("unhandledRejection", (r) => console.log("[unhandledRejection]", r));
process.on("uncaughtException", (e) => console.log("[uncaughtException]", e));

function startWpp() {
  console.log("[WPP] iniciando...");

  wppconnect
    .create({
      session: "delivery",
      autoClose: 0,
      puppeteerOptions: {
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      },
      catchQR: (base64Qrimg) => {
        lastQr = base64Qrimg; // guarda o QR em base64
        console.log("[WPP] QR atualizado");
      },
      statusFind: (statusSession) => {
        console.log("[WPP] status:", statusSession);
      },
    })
    .then((cli) => {
      client = cli;
      wppReady = true;
      lastWppError = null;
      console.log("[WPP] WhatsApp conectado ✅");
    })
    .catch((err) => {
      lastWppError = err?.message || String(err);
      wppReady = false;
      client = null;
      console.log("[WPP] erro ao iniciar:", lastWppError);

      // tenta de novo em 10s
      setTimeout(startWpp, 10000);
    });
}

startWpp();

// home
app.get("/", (req, res) => {
  res.json({
    ok: true,
    server: "online",
    whatsapp: wppReady ? "conectado" : "conectando",
    lastWppError,
  });
});

// rota do QR (abre no navegador)
app.get("/qr", (req, res) => {
  if (!lastQr) return res.status(404).send("QR ainda não gerado");

  // lastQr geralmente vem como data:image/png;base64,....
  res.setHeader("Content-Type", "text/html");
  res.end(`
    <html>
      <body style="display:flex;justify-content:center;align-items:center;height:100vh;background:#111;">
        <div style="text-align:center;color:white;font-family:Arial">
          <h2>Escaneie o QR no WhatsApp</h2>
          <img src="${lastQr}" />
          <p>Recarregue a página se expirar</p>
        </div>
      </body>
    </html>
  `);
});

// endpoint status
app.post("/status", async (req, res) => {
  try {
    let { telefone, status } = req.body || {};

    if (!telefone || !status) {
      return res.status(400).json({ ok: false, error: "Envie telefone e status" });
    }

    telefone = String(telefone).replace(/\D/g, "");
    status = String(status).trim().toLowerCase();

    if (!client || !wppReady) {
      return res.status(503).json({
        ok: false,
        error: "WhatsApp ainda conectando",
        lastWppError,
      });
    }

    let mensagem = "";
    if (status === "confirmado") mensagem = "✅ Seu pedido foi confirmado!";
    else if (status === "preparando") mensagem = "🍳 Seu pedido está sendo preparado!";
    else if (status === "finalizado") mensagem = "🚚 Seu pedido saiu para entrega!";
    else mensagem = `ℹ️ Status: ${status}`;

    const chatId = `${telefone}@c.us`;

    await Promise.race([
      client.sendText(chatId, mensagem),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout ao enviar mensagem")), 15000)
      ),
    ]);

    return res.json({ ok: true, enviadoPara: chatId });
  } catch (err) {
    console.log("[/status] erro:", err?.message || err);
    return res.status(500).json({ ok: false, error: err?.message || "erro" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log("Servidor rodando na porta", PORT));