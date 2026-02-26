app.post('/status', async (req, res) => {
  try {
    let { telefone, status } = req.body || {};

    // validações
    if (!telefone || !status) {
      return res.status(400).json({ ok: false, error: 'Envie telefone e status' });
    }

    // limpa telefone: deixa só números
    telefone = String(telefone).replace(/\D/g, '');

    // status como string
    status = String(status).trim().toLowerCase();

    // se ainda não conectou
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

    // timeout pra não travar o request
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