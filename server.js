const wppconnect = require('@wppconnect-team/wppconnect');
const express = require('express');

const app = express();
app.use(express.json());

let client = null;

// rota simples pra healthcheck (Railway usa isso pra ver se tá vivo)
app.get('/', (req, res) => {
  res.json({
    ok: true,
    server: 'online',
    whatsapp: client ? 'conectado' : 'conectando'
  });
});

app.post('/status', async (req, res) => {
  try {
    let { telefone, status } = req.body || {};

    if (!telefone || !status) {
      return res.status(400).json({ ok: false, error: 'Envie telefone e status' });
    }

    telefone = String(telefone).replace(/\D/g, '');
    status = String(status).trim().toLowerCase();

    if (!client) {
      return res.status(503).json({ ok: false, error: 'WhatsApp ainda conectando' });
    }

    let mensagem = '';
    if (status === 'confirmado') mensagem = '✅ Seu pedido foi confirmado!';
    else if (status === 'preparando') mensagem = '🍳 Seu pedido está sendo preparado!';
    else if (status === 'finalizado') mensagem = '🚚 Seu pedido saiu para entrega!';
    else mensagem = `ℹ️ Status: ${status}`;

    const chatId = `${telefone}@c.us`;

    console.log('[STATUS] recebendo:', { telefone, status, chatId });
    console.log('[STATUS] enviando:', mensagem);

    await Promise.race([
      client.sendText(chatId, mensagem),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout ao enviar mensagem')), 15000)
      )
    ]);

    console.log('[STATUS] enviado OK:', chatId);
    return res.json({ ok: true, enviadoPara: chatId });
  } catch (err) {
    console.log('ERRO /status:', err?.message || err);
    return res.status(500).json({ ok: false, error: err?.message || 'erro' });
  }
});

// ✅ SUBIR O SERVIDOR PRIMEIRO (isso resolve o 502)
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('Servidor rodando na porta', PORT);
  startWhatsapp(); // depois inicia o WhatsApp
});

// ✅ WhatsApp em background + retry se der erro
function startWhatsapp() {
  console.log('Iniciando WhatsApp...');

  wppconnect.create({
    session: 'delivery',
    autoClose: 0,
    headless: true,
    puppeteerOptions: {
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  })
  .then((cli) => {
    client = cli;
    console.log('WhatsApp conectado');
  })
  .catch((err) => {
    client = null;
    console.log('ERRO WhatsApp:', err?.message || err);
    setTimeout(startWhatsapp, 5000); // tenta de novo
  });
}