// In simple terms, this is the Node.js code
// Written by Dylan Werelius & Victoria Guzman
// Video Reference: https://youtu.be/TItbp7c9MNQ
import WebSocket, { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import crypto from "crypto";
import { getDatabase, registerUser, authenticateUser, saveMessage, getChatHistory, initinalizeDatabase } from "./database.js";
import { console } from "inspector";

dotenv.config();

const SECRET_KEY = process.env.SECRET_KEY;// REPLACE WITH YOUR SECRET KEY
const messageRateLimit = new Map(); //stores last message sent
const onlineUsers = new Map(); //stores online users


<<<<<<< HEAD:SecureChat/index.js
const MAX_ATTEMPTS = 5;
const LOCK_TIME = 5 * 60 * 1000; // 5 minutes
=======
// Make sure this is the same port aas index.htmls
const wss = new WebSocketServer({ port: 3000 })
>>>>>>> 467051018a63df5418d10bee6a1176007d0f7a2a:SecureChat/server.js

// RSA Key Generation for Encryption
const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 4096 });




function checkBruteForce(username) {
    if (!loginAttempts.has(username)) return false;
    const { count, lastAttempt } = loginAttempts.get(username);
    return count >= MAX_ATTEMPTS && Date.now() - lastAttempt < LOCK_TIME;
}

function encryptMessage (message, aesKey) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", aesKey, iv);
    return Buffer.concat([iv, cipher.update(message), cipher.final()]).toString("hex");
}
// checks if connection is alive
function heartbeat() {
    this.isAlive = true;
}

<<<<<<< HEAD:SecureChat/index.js
async function startServer() {
    await initinalizeDatabase(); // Ensure MySQL connects before WebSocket starts

// Make sure this is the same port aas index.html
// Set up WebSocket server for LAN communication
    const wss = new WebSocketServer({ host: '0.0.0.0', port: 3000 }); 
    wss.on("connection", function connection(ws) {
=======
// This function will help us keep track of what users are currently online
function updateOnlineUsers() {
    console.log("Updating online users");
    const usersArray = Array.from(onlineUsers.keys());
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: "online_users", users: usersArray }));
        }
    });
}

wss.on("connection", function connection(ws) {
>>>>>>> 467051018a63df5418d10bee6a1176007d0f7a2a:SecureChat/server.js
    console.log("Client Connected");
    ws.isAlive = true;
    ws.on("pong", () => { ws.isAlive = true; }); //Clinet responds to server's ping


    ws.on("message", async function message(msg) {
        const data = JSON.parse(msg);

        if (data.type === "register") {
            //register a new user
            const hashedPassword = await bcrypt.hash(data.password, 10);
            const success = await registerUser(data.username, hashedPassword);
            ws.send(JSON.stringify({ type:success? "success": "error", message: success? "User registered.": "User already exists."}));

        } else if (data.type === "login") {
            //user authentication 
            const user = await authenticateUser(data.username);
            if(!user || !(await bcrypt.compare(data.password, user.password))) {
                ws.send(JSON.stringify({ type: "error", message: "Invaild credentials." }));
                return;
            }
<<<<<<< HEAD:SecureChat/index.js
            const token = jwt.sign({ username: data.username }, SECRET_KEY, {expiresIn: "1hr"});
            ws.send(JSON.stringify({type: "auth", token}));

            // track active user 
            onlineUsers.set(ws, data.username);
            broadcastMessage(`${data.username} has joined the chat.`);
            
=======
           const valid = await bcrypt.compare(data.password, users.get (data.username));
           if (!valid) {
            ws.send(JSON.stringify({ type: "error", message: "Invaild credentials."}));
            return; 
           }
           const token = jwt.sign({ username: data.username }, SECRET_KEY, {expiresIn: "1hr"});
           ws.send(JSON.stringify({type: "auth", token, username: data.username }));

           //Store user connections
           onlineUsers.set(data.username, ws);
           broadcastMessage(`${data.username} has joined the chat.`);
           updateOnlineUsers();
>>>>>>> 467051018a63df5418d10bee6a1176007d0f7a2a:SecureChat/server.js
        } else if (data.type === "message") {
            //Authenticate token before allowing messages
            try{
                console.log("Received token:", data.token);
                if (!data.token){
                    throw new Error("Missing token");
                }
                const decoded = jwt.verify(data.token, SECRET_KEY);
                const username = decoded.username;
                console.log("Token valid for user:", username);
                console.log("Checking message rate limit...")
                if (typeof messageRateLimit === "undefined") {
                    console.log("messageRateLimit is undefined");
                }else {
                    console.log("messageRateLimit is defined");
                }
                if (!data.recipient){
                    throw new Error("Missing recipient");
                }
                const now = Date.now();
<<<<<<< HEAD:SecureChat/index.js
=======

                // Note: move this and delete when stable
                // broadcastMessage(`${username}: ${data.data}`);
>>>>>>> 467051018a63df5418d10bee6a1176007d0f7a2a:SecureChat/server.js

                // Rate limit: Allow only one message per second 
                if (messageRateLimit.has(username) && now - messageRateLimt.get(username) < 1000) {
                    ws.send(JSON.stringify({ type: "error", message: "You're sending messages too fast! Try again in a second."}));
                    return;
                }

                messageRateLimit.set(username, now); //Upate timestamp
                await saveMessage(username, data.recipient, data.data);//save to mysql 
                //broadcastMessage(`${username}: ${data.data}`, ws);

                // Check the name of the recipient
                console.log(data.recipient);
                // This is to determine if the message is a DM or general message
                if (data.recipient != "all") {
                    sendPrivateMessage(username, data.recipient, data.data);
                } else {
                    broadcastMessage(`${username}: ${data.data}`);
                }

            } catch (err) {
                console.error("invalid token", err.message);
                ws.send(JSON.stringify({ type: "error", message: "Invalid token."}));
            }
        }
        else if (data.type === "get_history") {
            const history = await getChatHistory(data.sender, data.recipient);
            ws.send(JSON.stringify({ type: "chat_history", data: history}));
        }
    });
    ws.on("close", () => {
        // Retrieve username
        const entry = Array.from(onlineUsers.entries()).find(([users, socket]) => socket === ws);
        const username = entry ? entry[0] : null;


        if (username) {
            onlineUsers.delete(username);
            console.log("Client Disconnected. ");
            broadcastMessage(`${username} has left the chat.`);
            updateOnlineUsers();
        }
    });
});
    function broadcastMessage(message, senderUsername = null) {
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: "message", data: message }));
            }
        }); 
    }
<<<<<<< HEAD:SecureChat/index.js
    setInterval(() => {
        wss.clients.forEach((ws) => {
            if (!ws.isAlive) {
                console.log("Terminating inactive connection");
                return ws.terminate();
            }
            ws.isAlive = false;
            ws.ping();// send a ping to check if client is still active
        });
    }, 10000);
=======
    function sendPrivateMessage(sender, recipient, message) {
        const recipientSocket = onlineUsers.get(recipient);
        if (recipientSocket && recipientSocket.readyState === WebSocket.OPEN) {
            recipientSocket.send(JSON.stringify({ type: "private_message", sender, message }));
            ws.send(JSON.stringify({ type: "private_message", sender: "You", message }));
        } else {
            ws.send(JSON.stringify({ type: "error", message: `User ${recipient} is not online.` }));
        }
    }
});
>>>>>>> 467051018a63df5418d10bee6a1176007d0f7a2a:SecureChat/server.js

console.log("WebSocket server is running...");

}
startServer().catch(console.error);

