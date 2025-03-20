// In simple terms, this is the Node.js code
// Written by Dylan Werelius & Victoria Guzman
// Video Reference: https://youtu.be/TItbp7c9MNQ

import WebSocket, { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import fs from "fs";
import crypto from "crypto";
import { initializeDatabase, registerUser, authenticateUser, saveMessage } from "./database.js";

dotenv.config();

const SECRET_KEY = process.env.SECRET_KEY;// REPLACE WITH YOUR SECRET KEY
//const users = new Map(); //store users (username -> hashed password)
const messageRateLimt = new Map(); //stores last message timestamp per user
const onlineUsers = new Map(); //stores active websocket connectins
const loginAttempts = {};

const AES_KEY = crypto.randomBytes(32);
const AES_IV = crypto.randomBytes(16);

// Initialize MySQL Database
// IIFE to initialize database asynchronously
(async () => {
    await initializeDatabase();
    console.log("✅ Database initialized successfully.");
})();

// Make sure this is the same port aas index.htmls
const wss = new WebSocketServer({ host: '0.0.0.0', port: 80 })

// checks if connection is alive
function heartbeat() {
    this.isAlive = true;
}
function isBlocked(ip) {
    if (!loginAttempts[ip]) return false;
    const { count, lastAttempt } = loginAttempts[ip];
    return count >= 5 && Date.now() - lastAttempt < 10 * 60 * 1000; // 10 minutes
}
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
    console.log("Client Connected");
    ws.isAlive = true;
    ws.on("pong", heartbeat); //Clinet responds to server's ping

    ws.on("message", async function message(message) {
        const data = JSON.parse(message);

        if (data.type === "register") {
            console.log(`📩 Received registration request for: ${data.username}`);
        
            const hashedPassword = await bcrypt.hash(data.password, 10);
            const success = await registerUser(data.username, hashedPassword);
            
            if (!success) {
                console.error(`❌ Failed to register ${data.username} - Username may already exist.`);
                ws.send(JSON.stringify({ type: "error", message: "Username already exists." }));
            } else {
                console.log(`✅ User ${data.username} registered successfully.`);
                ws.send(JSON.stringify({ type: "success", message: "User registered successfully." }));
            }
        }else if (data.type === "login") {
            //user authentication 
            const userIp = ws._socket.remoteAddress;
            if(isBlocked(userIp)) {
                ws.send(JSON.stringify({ type: "error", message: "Too many login attempts. Please try again later."}));
                return;
            }

            const user = await authenticateUser(data.username);
            if (!user) {
                ws.send(JSON.stringify({ type: "error", message: "User not found."}));
                return;
            }
            const valid = await bcrypt.compare(data.password, user.password);
            if (!valid) {
                loginAttempts[userIp] = loginAttempts[userIp] || { count: 0, lastAttempt: 0 };
                loginAttempts[userIp].count++;
                loginAttempts[userIp].lastAttempt = Date.now();
                ws.send(JSON.stringify({ type: "error", message: "Invalid password."}));
                return;
            }else {
                loginAttempts[userIp] = { count: 0, lastAttempt: 0 };
                ws.send(JSON.stringify({ type: "success", message: "Login successful."}));
            }
           const token = jwt.sign({ username: data.username }, SECRET_KEY, {expiresIn: "1hr"});
           ws.send(JSON.stringify({type: "auth", token, username: data.username }));

           //Store user connections
           onlineUsers.set(data.username, ws);
           broadcastMessage(`${data.username} has joined the chat.`);
           updateOnlineUsers();
        } else if (data.type === "message") {
            //Authenticate token before allowing messages
            try{
                const decoded = jwt.verify(data.token, SECRET_KEY);
                const username = decoded.username;
                const now = Date.now();

                // Note: move this and delete when stable
                // broadcastMessage(`${username}: ${data.data}`);

                // Rate limit: Allow only one message per second 
                if (messageRateLimt.has(username) && now - messageRateLimt.get(username) < 1000) {
                    ws.send(JSON.stringify({ type: "error", message: "You're sending messages too fast! Try again in a second."}));
                    return;
                }

                messageRateLimt.set(username, now); //Upate timestamp

                // Check the name of the recipient
                console.log(data.recipient);
                // This is to determine if the message is a DM or general message
                if (data.recipient != "all") {
                    sendPrivateMessage(username, data.recipient, data.data);
                } else {
                    broadcastMessage(`${username}: ${data.data}`);
                }
                // save message to database 
                await saveMessage(username, data.recipient, data.data);

            } catch (err) {
                ws.send(JSON.stringify({ type: "error", message: "Invalid token."}));
            }
        }else if (data.type === "file") {
            const data = JSON.parse(message)
            const { filename, fileData } = data;
            const filePath = `uploads/${filename}.enc`;
    
            fs.writeFileSync(filePath, Buffer.from(fileData, 'base64'));
    
            console.log(`📁 Encrypted file received: ${filename}`);
        
        }else if (data.type === "chat"){
            const logPath = `logs/chat_${data.sender}_to_${data.receiver}.txt`;
            const logEntry = `${new Date().toISOString()} - ${data.sender}: ${data.message}\n`;

            fs.appendFileSync(logPath, logEntry);

            console.log(`💬 Logged message: ${logEntry}`);
            const encryptedMessage = encryptMessage(data.message);
            console.log(`🔒 Encrypted Message: ${encryptedMessage}`);
    
            ws.send(JSON.stringify({ type: "chat", message: encryptedMessage }));
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
    function encryptFile(filePath, outputPath) {
        const cipher = crypto.createCipheriv('aes-256-cbc', AES_KEY, AES_IV);
        const input = fs.createReadStream(filePath);
        const output = fs.createWriteStream(outputPath);
    
        input.pipe(cipher).pipe(output);
    }
    
    function decryptFile(encryptedPath, outputPath) {
        const decipher = crypto.createDecipheriv('aes-256-cbc', AES_KEY, AES_IV);
        const input = fs.createReadStream(encryptedPath);
        const output = fs.createWriteStream(outputPath);
    
        input.pipe(decipher).pipe(output);
    }
    function encryptMessage(message) {
        const cipher = crypto.createCipheriv('aes-256-cbc', AES_KEY, AES_IV);
        let encrypted = cipher.update(message, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return encrypted;
    }
    
    function decryptMessage(encryptedMessage) {
        const decipher = crypto.createDecipheriv('aes-256-cbc', AES_KEY, AES_IV);
        let decrypted = decipher.update(encryptedMessage, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    
    ws.on("message", (message) => {
        const data = JSON.parse(message);
        
        if (data.type === "chat") {
            const encryptedMessage = encryptMessage(data.message);
            console.log(`🔒 Encrypted Message: ${encryptedMessage}`);
    
            ws.send(JSON.stringify({ type: "chat", message: encryptedMessage }));
        }
    });
    
    function broadcastMessage(message, senderUsername = null) {
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ 
                    type: "message", 
                    data: message
                }));
            }
        });
    }
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

console.log("WebSocket server is running...");