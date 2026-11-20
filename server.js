const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const QRCode = require('qrcode');
const os = require('os');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('./digital-twin-config.json', 'utf8')).appConfig;
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: config.websocketPath });

app.use(express.static('public'));

// Trova l'indirizzo IP locale nella rete Wi-Fi
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Endpoint per generare il QR code da inquadrare con lo smartphone
app.get('/qr', async (req, res) => {
  const ip = getLocalIP();
  // Se usi ngrok o un tunnel HTTPS, sostituisci questo URL con l'URL pubblico HTTPS
  const controllerUrl = `http://${ip}:${config.serverPort}/controller.html`;
  try {
    const qrDataUrl = await QRCode.toDataURL(controllerUrl, { width: 250, margin: 1 });
    res.json({ qr: qrDataUrl, url: controllerUrl });
  } catch (err) {
    res.status(500).json({ error: 'Errore generazione QR' });
  }
});

// Gestione stanze/connessioni WebSocket (PC e Smartphone)
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('Nuovo dispositivo connesso. Totale:', clients.size);

  ws.on('message', (message) => {
    // Inoltra i dati dei sensori dal telefono a tutti gli schermi PC connessi
    for (const client of clients) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message.toString());
      }
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log('Dispositivo disconnesso.');
  });
});

server.listen(config.serverPort, () => {
  console.log(`Server avviato su http://localhost:${config.serverPort}`);
});
