const wppconnect = require('@wppconnect-team/wppconnect');

wppconnect.create().then((client) => {
  console.log('Bot iniciado!');

  client.onMessage((message) => {
    if (message.body === 'oi') {
      client.sendText(message.from, 'Olá! Seu bot está funcionando 🚀');
    }
  });
});