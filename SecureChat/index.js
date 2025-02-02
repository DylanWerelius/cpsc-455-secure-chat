// In simple terms, this is the Node.js code
// Written by Dylan Werelius & Victoria Guzman
// Video Reference: https://youtu.be/TItbp7c9MNQ

import WebSocket, { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
dotenv.config();

const SECRET_KEY = process.env.SECRET_KEY;// REPLACE WITH YOUR SECRET KEY
const users = new Map(); //store users (username -> hashed password)
const messageRateLimt = new Map(); //stores last message timestamp per user 


// Make sure this is the same port aas index.html
const wss = new WebSocketServer({ port: 3000 })

// checks if connection is alive
function heartbeat() {
    this.isAlive = true;
}

wss.on("connection", function connection(ws) {
    console.log("Client Connected");
    ws.isAlive = true;
    ws.on("pong", heartbeat); //Clinet responds to server's ping

    ws.on("message", async function message(message) {
        const data = JSON.parse(message);

        if (data.type === "register") {
            //register a new user
            if (users.has(data.username)){
                ws.send(JSON.stringify({ type: "error", message: "Username already taken."}));
                return;
            }
            const hashedPassword = await bcrypt.hash(data.password, 10);
            users.set(data.username, hashedPassword);
            ws.send(JSON.stringify({ type:"success", message: "User registered."}));
        } else if (data.type === "login") {
            //user authentication 
            if(!users.has(data.username)){
                ws.send(JSON.stringify({ type: "error", message: "User not found." }));
                return;
            }
           const valid = await bcrypt.compare(data.password, users.get (data.username));
           if (!valid) {
            ws.send(JSON.stringify({ type: "error", message: "Invaild credentials."}));
            return; 
           }
           const token = jwt.sign({ username: data.username }, SECRET_KEY, {expiresIn: "1hr"});
           ws.send(JSON.stringify({type: "auth", token}));
        } else if (data.type === "message") {
            //Authenticate token before allowing messages
            try{
                const decoded = jwt.verify(data.token, SECRET_KEY);
                const username = decoded.username;
                const now = Date.now();

                // Rate limit: Allow only one message per second 
                if (messageRateLimt.has(username) && now - messageRateLimt.get(username) < 1000) {
                    ws.send(JSON.stringify({ type: "error", message: "You're sending messages too fast! Try again in a second."}));
                    return;
                }

                messageRateLimt.set(username, now); //Upate timestamp

                //Broadcast message
                wss.clients.forEach((client) => {
                    if (client != ws && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ type: "message", data: `${decoded.username}: ${data.data}` }));
                    }
                });
            } catch (err) {
                ws.send(JSON.stringify({ type: "error", message: "Invalid token."}));
            }
        }
    });
    ws.on("close", () => {
        console.log("Client Disconnected. ");
    });
});

// Periodically check if the connection is alive
const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (!ws.isAlive) {
            console.log("Terminating inactive connection");
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();// send a ping to check if client is still active
    });
}, 10000); // Runs every 10 seconds

console.log("WebSocket server with authentication, rate limiting, and connection handling running...");