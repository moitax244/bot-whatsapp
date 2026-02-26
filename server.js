const wppconnect = require('@wppconnect-team/wppconnect');
const express = require('express');

const app = express();
app.use(express.json());

let client;

wppconnect.create({
  session: 'delivery',
  puppeteerOptions: {
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
}).then((cli) => {
  client = cli;
  console.log('WhatsApp conectado');
});

app.get('/', (req, res) => {
  res.send('Bot online');
});

app.post('/status', async (req, res) => {
  const { telefone, status } = req.body;

  let mensagem = '';

  if (status === 'confirmado')
    mensagem = '✅ Seu pedido foi confirmado!';
  if (status === 'preparando')
    mensagem = '🍳 Seu pedido está sendo preparado!';
  if (status === 'finalizado')
    mensagem = '🚚 Seu pedido saiu para entrega!';

  await client.sendText(telefone + '@c.us', mensagem);

  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Servidor rodando'));