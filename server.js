const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = 3000;

// Serve static files from the current directory
app.use(express.static(__dirname));

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

app.get('/api/qr', async (req, res) => {
    try {
        const ip = getLocalIP();
        const url = `http://${ip}:${PORT}/mobile.html`;
        const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, scale: 8 });
        res.json({ url, qrCode: qrDataUrl });
    } catch (err) {
        res.status(500).json({ error: 'Failed' });
    }
});

io.on('connection', (socket) => {
    // When mobile connects, it emits an event or just waits.
    socket.on('mobile_photo_captured', (data) => {
        // Send this back to all clients (the PC browser)
        // Broadcasts to all connected PC windows
        io.emit('pc_receive_photo', data);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    const ip = getLocalIP();
    console.log(`\n========================================`);
    console.log(`All Converter Local Server Running!`);
    console.log(`========================================`);
    console.log(`PC Web App: 
    http://localhost:${PORT}`);
    console.log(`\nMobile Scanner URL (LAN required): 
    http://${ip}:${PORT}/mobile.html`);
    console.log(`========================================\n`);
});
