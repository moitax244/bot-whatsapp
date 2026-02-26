app.post('/status', async (req, res) => {
  try {
    const { telefone, status } = req.body;

    // validações
    if (!telefone || !status) {
      return res.status(400).json({ ok: false, error: 'Envie telefone e status' });
    }

    if (!client) {
      return res.status(503).json({ ok: false, error: 'WhatsApp ainda conectando' });
    }

    let mensagem = '';

    if (status === 'confirmado') mensagem = '✅ Seu pedido foi confirmado!';
    else if (status === 'preparando') mensagem = '🍳 Seu pedido está sendo preparado!';
    else if (status === 'finalizado') mensagem = '🚚 Seu pedido saiu para entrega!';
    else mensagem = `Status: ${status}`;

    // timeout pra não travar o request
    await Promise.race([
      client.sendText(telefone + '@c.us', mensagem),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout ao enviar mensagem')), 15000)
      )
    ]);

    return res.json({ ok: true });
  } catch (err) {
    console.log('ERRO /status:', err?.message || err);
    return res.status(500).json({ ok: false, error: err?.message || 'erro' });
  }
});