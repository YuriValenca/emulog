const { WebSocketServer } = require('ws');

const PORT = 8765;
const wss = new WebSocketServer({ port: PORT });

console.log(`\n🔌 Servidor WebSocket rodando em ws://localhost:${PORT}`);
console.log('   Aguardando conexões...\n');

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`✅ Cliente conectado: ${ip}  (total: ${wss.clients.size})`);

  ws.on('message', (raw) => {
    let msg;

    try {
      msg = JSON.parse(raw); // Tenta interpretar como JSON
    } catch {
      console.warn('⚠️  Mensagem inválida (não é JSON):', raw.toString());
      return;
    }

    console.log(`📦 Recebido de ${ip}:`, msg);

    // Repassa a mensagem para todos os outros clientes conectados
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === 1) {
        client.send(JSON.stringify(msg));
      }
    });
  });

  ws.on('close', () => {
    console.log(`❌ Cliente desconectado: ${ip}  (total: ${wss.clients.size})`);
  });

  ws.on('error', (err) => {
    console.error(`🔴 Erro no cliente ${ip}:`, err.message);
  });
});