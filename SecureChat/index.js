// In simple terms, this is the Node.js code
// Written by Dylan Werelius
// Video Reference: https://youtu.be/TItbp7c9MNQ

import WebSocket, { WebSocketServer } from "ws";

// Make sure this is the same port aas index.html
const wss = new WebSocketServer({ port: 3000 })

wss.on("connection", function connection(ws) {
    ws.on("message", function message(message) {
        const data = JSON.parse(message);

        if (data.type === "message") {
            wss.clients.forEach((client) => {
                if (client != ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: "message", data: data.data }));
                }
            });
        }
    });
});