const express = require('express');
const wppconnect = require('@wppconnect-team/wppconnect');

const app = express();
app.use(express.json());

let client = null;
let wppReady = false;
let lastWppError = null;

// QR em imagem (base64)
let lastQrBase64 = null;
let lastQrAttempts = 0;

// NÃO DEIXA O PROCESSO MORRER SEM MOSTRAR O ERRO
process.on('unhandledRejection', (reason) => {
  console.log('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.log('[uncaughtException]', err);
});

app.get('/', (req, res) => {
  res.json({
    ok: true,
    bot: 'online',
    whatsapp: wppReady ? 'conectado' : 'conectando',
    lastWppError: lastWppError ? String(lastWppError) : null,
    qr: lastQrBase64 ? '/qr' : null,
    qrAttempts: lastQrAttempts,
  });
});

app.get('/health', (req, res) => {
  res.status(200).send('ok');
});

// QR como IMAGEM (pra escanear fácil)
app.get('/qr', (req, res) => {
  if (!lastQrBase64) return res.status(404).send('QR ainda não gerado');

  const pngBase64 = lastQrBase64.replace(/^data:image\/png;base64,/, '');
  const img = Buffer.from(pngBase64, 'base64');

  res.writeHead(200, {
    'Content-Type': 'image/png',
    'Cache-Control': 'no-store',
  });
  res.end(img);
});

app.post('/status', async (req, res) => {
  try {
    let { telefone, status } = req.body || {};

    if (!telefone || !status) {
      return res.status(400).json({ ok: false, error: 'Envie telefone e status' });
    }

    telefone = String(telefone).replace(/\D/g, '');
    status = String(status).trim().toLowerCase();

    if (!client || !wppReady) {
      return res.status(503).json({
        ok: false,
        error: 'WhatsApp ainda conectando',
        lastWppError: lastWppError ? String(lastWppError) : null,
        qr: lastQrBase64 ? '/qr' : null,
      });
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
      ),
    ]);

    console.log('[STATUS] enviado OK:', chatId);
    return res.json({ ok: true, enviadoPara: chatId });
  } catch (err) {
    console.log('ERRO /status:', err?.message || err);
    return res.status(500).json({ ok: false, error: err?.message || 'erro' });
  }
});

// Inicia WPPConnect
wppconnect
  .create({
    session: 'delivery',
    autoClose: 0,
    puppeteerOptions: {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },

    // <- AQUI é a mágica: pega QR (imagem e ASCII)
    catchQR: (base64Qrimg, asciiQR, attempts) => {
      lastQrBase64 = base64Qrimg;
      lastQrAttempts = attempts;
      wppReady = false;

      console.log('[WPP] QR atualizado - tentativas:', attempts);
      // Se quiser ver no log também:
      // console.log(asciiQR);
      console.log('[WPP] Abra: /qr para escanear');
    },

    // tenta considerar logado
    statusFind: 'isLogged',
  })
  .then((cli) => {
    client = cli;

    console.log('[WPP] client criado');

    // Detecta quando realmente fica pronto
    client.onStateChange((state) => {
      console.log('[WPP] state:', state);

      if (state === 'CONNECTED' || state === 'MAIN') {
        wppReady = true;
        lastWppError = null;
        console.log('[WPP] WhatsApp conectado e pronto!');
      }

      if (state === 'UNPAIRED' || state === 'UNPAIRED_IDLE' || state === 'DISCONNECTED') {
        wppReady = false;
      }
    });
  })
  .catch((err) => {
    lastWppError = err?.message || err;
    wppReady = false;
    console.log('[WPP] ERRO ao iniciar:', lastWppError);
  });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Servidor rodando na porta', PORT));
    return res.json({ ok: true, enviadoPara: chatId });
  } catch (err) {
    console.log('ERRO /status:', err?.message || err);
    return res.status(500).json({ ok: false, error: err?.message || 'erro' });
  }
});

// ⚠️ SOBE O SERVIDOR PRIMEIRO (pra não virar 502)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Servidor rodando na porta', PORT));

// ✅ INICIA O WHATSAPP “EM BACKGROUND” E COM CATCH
(async () => {
  try {
    console.log('[WPP] iniciando...');

    const cli = await wppconnect.create({
      session: 'delivery',
      autoClose: 0,
      puppeteerOptions: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-zygote',
          '--single-process',
        ],
      },
    });

    client = cli;
    wppReady = true;
    lastWppError = null;
    console.log('WhatsApp conectado');
  } catch (e) {
    lastWppError = e?.message || e;
    wppReady = false;
    console.log('[WPP] ERRO AO CONECTAR:', lastWppError);
    // mantém o servidor vivo mesmo se o WhatsApp falhar
  }
})();
