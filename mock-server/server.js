const WebSocket = require('ws');
const http = require('http');

const PORT = 8080;
const server = http.createServer();

const wssOrder    = new WebSocket.Server({ noServer: true });
const wssResponse = new WebSocket.Server({ noServer: true });
const wssReply    = new WebSocket.Server({ noServer: true });
const wssCamera   = new WebSocket.Server({ noServer: true });

// パス別にルーティング
server.on('upgrade', (req, socket, head) => {
    const path = new URL(req.url, `http://localhost`).pathname;
    const map = {
        '/unity/order':    wssOrder,
        '/unity/response': wssResponse,
        '/unity/reply':    wssReply,
        '/unity/camera':   wssCamera,
    };
    const wss = map[path];
    if (wss) {
        wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws));
    } else {
        socket.destroy();
    }
});

function broadcast(wss, msg) {
    wss.clients.forEach(c => {
        if (c.readyState === WebSocket.OPEN) c.send(msg);
    });
}

// /unity/order: コマンド受信 → ランダム1〜5秒後に /unity/response へ done:* を送る
wssOrder.on('connection', (ws) => {
    console.log('🔌 [order] client connected');

    ws.on('message', (data) => {
        const msg = data.toString();
        console.log(`📩 [order] received: ${msg}`);

        const cmdType = msg.split(':')[0];

        // talk の場合は /unity/reply にも返信を送る
        if (cmdType === 'talk') {
            const text = msg.substring(5).trim();
            setTimeout(() => {
                const reply = `「${text}」ですね、わかりました！`;
                broadcast(wssReply, reply);
                console.log(`📤 [reply] sent: ${reply}`);
            }, 500);
        }

        // ランダム 1〜5 秒後に done 応答
        const delay = (1 + Math.random() * 4) * 1000;
        setTimeout(() => {
            const response = `done:${cmdType}`;
            broadcast(wssResponse, response);
            console.log(`📤 [response] sent: ${response}  (after ${(delay / 1000).toFixed(1)}s)`);
        }, delay);
    });

    ws.on('close', () => console.log('🔌 [order] client disconnected'));
});

// /unity/camera: 0.5秒ごとにカメラスキャン結果をブロードキャスト
const CAMERA_OBJECTS = ['box', 'sphere', 'cylinder'];
setInterval(() => {
    const detected = Math.random() > 0.35
        ? CAMERA_OBJECTS[Math.floor(Math.random() * CAMERA_OBJECTS.length)]
        : 'none';
    broadcast(wssCamera, detected);
}, 500);

server.listen(PORT, () => {
    console.log(`🚀 Mock Unity WebSocket server  ws://localhost:${PORT}`);
    console.log(`   order    <- ws://localhost:${PORT}/unity/order`);
    console.log(`   response -> ws://localhost:${PORT}/unity/response`);
    console.log(`   reply    -> ws://localhost:${PORT}/unity/reply`);
    console.log(`   camera   -> ws://localhost:${PORT}/unity/camera`);
});
