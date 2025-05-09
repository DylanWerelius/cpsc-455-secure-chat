// In simple terms, this is the server code
// Written by Dylan Werelius & Victoria Guzman
// Video Reference: https://youtu.be/TItbp7c9MNQ

// Updated server.js with SQLite user auth
require("dotenv").config();
const express   = require("express");
const http      = require("http");
const path      = require("path");
const fs        = require("fs");
const jwt       = require("jsonwebtoken");
const bcrypt    = require("bcryptjs");
const { WebSocketServer } = require("ws");
const {
  getDatabase,
  saveMessage,
  createUser,
  findUserByUsername,
  getAllUsers
} = require("./database.js");
const { fileURLToPath } = require("url");
const { dirname, join } = require("path");

const SECRET_KEY = process.env.SECRET_KEY;
const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET;
const LOCAL_CAPTCHA_SECRET = process.env.LOCAL_RECAPTCHA;

const messageRateLimit = new Map();
const onlineUsers = new Map();
const loginAttempts = new Map();
const userSPKIs = new Map();

const MAX_ATTEMPTS = 5;
const LOCK_TIME_MS = 60000;
const securityLogPath = path.join("logs", "security.txt");
const logDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

// Create the server and web socket server
const app = express();
// Tell the app to find the Client in the Client Directory
app.use(express.static(path.join(__dirname, "Client")));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

(async () => {
    await getDatabase();
    console.log("SQLite initialized");
})();
  
async function verifyRecaptcha(token) {
    const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `secret=${RECAPTCHA_SECRET}&response=${token}`
    });
    const data = await response.json();
    return data.success;
}

async function verifyLocalRecaptcha(token) {
    const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `secret=${LOCAL_CAPTCHA_SECRET}&response=${token}`
    });
    const data = await response.json();
    return data.success;
}

function logSecurityEvent(username, reason) {
  const logLine = `${new Date().toISOString()} - ${username}: ${reason}\n`;
  fs.appendFile(securityLogPath, logLine, (err) => {
    if (err) console.error("Failed to write security log:", err);
  });
}

function heartbeat() {
    this.isAlive = true;
}

async function updateUserLists() {
    const registered = await getAllUsers();
    const online = Array.from(onlineUsers.keys());
    const offline = registered.filter(u => !online.includes(u));

    wss.clients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "online_users",  users: online  }));
          ws.send(JSON.stringify({ type: "offline_users", users: offline }));
        }
    });
}

function logMessageToFile(sender, recipient, message) {
    const timestamp = new Date().toISOString();
    const logLine = `${timestamp} - ${sender} → ${recipient}: ${message}\n`;
    const filePath = path.join(logDir, `chat_${sender}_to_${recipient}.txt`);
    fs.appendFile(filePath, logLine, (err) => {
        if (err) console.error(" Failed to write log:", err);
    });
}

wss.on("connection", function connection(ws) {
    ws.isAlive = true;
    ws.on("pong", heartbeat);

    ws.on("message", async function message(message) {
        const data = JSON.parse(message);

        if (data.type === "register") {
            //const isHuman = await verifyRecaptcha(data.recaptchaToken);
            const isHuman = await verifyLocalRecaptcha(data.recaptchaToken);
            if (!isHuman) {
                ws.send(JSON.stringify({ type: "error", message: "CAPTCHA verification failed." }));
                return;
            }

            const existingUser = await findUserByUsername(data.username);
            if (existingUser) {
                ws.send(JSON.stringify({ type: "error", message: "Username already taken." }));
                return;
            }
            const hashedPassword = await bcrypt.hash(data.password, 10);
            await createUser(data.username, hashedPassword);
            ws.send(JSON.stringify({ type: "success", message: "User registered." }));

        } else if (data.type === "login-no-captcha"){
            const now = Date.now();
            const attempts = loginAttempts.get(data.username) || { count: 0, lastAttempt: 0 };
            if (attempts.count >= MAX_ATTEMPTS && (now - attempts.lastAttempt < LOCK_TIME_MS)) {
                logSecurityEvent(data.username, "Account locked due to too many failed attempts");
                ws.send(JSON.stringify({ type: "error", message: "Too many failed login attempts. Please wait before trying again." }));
                return;
            }

            const userRecord = await findUserByUsername(data.username);
            if (!userRecord) {
                logSecurityEvent(data.username, "User not found");
                ws.send(JSON.stringify({ type: "error", message: "User not found." }));
                return;
            }

            const valid = await bcrypt.compare(data.password, userRecord.password);
            if (!valid) {
                attempts.count++;
                attempts.lastAttempt = now;
                loginAttempts.set(data.username, attempts);
                logSecurityEvent(data.username, "Invalid password");
                ws.send(JSON.stringify({ type: "error", message: "Invalid credentials." }));
                return;
            }

            loginAttempts.delete(data.username);
            const token = jwt.sign({ username: data.username }, SECRET_KEY, { expiresIn: "1h" });
            ws.send(JSON.stringify({ type: "auth", token, username: data.username }));

            // send all user public keys
            for (const [otherUser, keyBytes] of userSPKIs.entries()) {
                ws.send(JSON.stringify({
                    type: "public_key",
                    username: otherUser,
                    key: keyBytes
                }));
            }

            onlineUsers.set(data.username, ws);
            broadcastMessage(`${data.username} has joined the chat.`, data.username);
            //updateOnlineUsers();
            await updateUserLists();
        } else if (data.type === "login") {
            //const isHuman = await verifyRecaptcha(data.recaptchaToken);
            const isHuman = await verifyLocalRecaptcha(data.recaptchaToken);
            if (!isHuman) {
                ws.send(JSON.stringify({ type: "error", message: "CAPTCHA verification failed." }));
                return;
            }
            
            const now = Date.now();
            const attempts = loginAttempts.get(data.username) || { count: 0, lastAttempt: 0 };
            if (attempts.count >= MAX_ATTEMPTS && (now - attempts.lastAttempt < LOCK_TIME_MS)) {
                logSecurityEvent(data.username, "Account locked due to too many failed attempts");
                ws.send(JSON.stringify({ type: "error", message: "Too many failed login attempts. Please wait before trying again." }));
                return;
            }

            const userRecord = await findUserByUsername(data.username);
            if (!userRecord) {
                logSecurityEvent(data.username, "User not found");
                ws.send(JSON.stringify({ type: "error", message: "User not found." }));
                return;
            }

            const valid = await bcrypt.compare(data.password, userRecord.password);
            if (!valid) {
                attempts.count++;
                attempts.lastAttempt = now;
                loginAttempts.set(data.username, attempts);
                logSecurityEvent(data.username, "Invalid password");
                ws.send(JSON.stringify({ type: "error", message: "Invalid credentials." }));
                return;
            }

            loginAttempts.delete(data.username);
            const token = jwt.sign({ username: data.username }, SECRET_KEY, { expiresIn: "1h" });
            ws.send(JSON.stringify({ type: "auth", token, username: data.username }));

            // send all user public keys
            for (const [otherUser, keyBytes] of userSPKIs.entries()) {
                ws.send(JSON.stringify({
                    type: "public_key",
                    username: otherUser,
                    key: keyBytes
                }));
            }

            onlineUsers.set(data.username, ws);
            broadcastMessage(`${data.username} has joined the chat.`, data.username);
            //updateOnlineUsers();
            await updateUserLists();

        } else if (data.type === "message") {
            try {
                const decoded = jwt.verify(data.token, SECRET_KEY);
                const username = decoded.username;
                const now = Date.now();

                if (messageRateLimit.has(username) && now - messageRateLimit.get(username) < 1000) {
                    ws.send(JSON.stringify({ type: "error", message: "You're sending messages too fast! Try again in a second." }));
                    return;
                }

                messageRateLimit.set(username, now);

                if (data.recipient !== "all") {
                    sendPrivateMessage(username, data.recipient, data.data);
                } else {
                    broadcastMessage(`${username}: ${data.data}`, username);
                }

                await saveMessage(username, data.recipient, data.data);
            } catch (err) {
                ws.send(JSON.stringify({ type: "error", message: "Invalid token." }));
            }
        } else if (data.type === "file") {
            try {
                const decoded = jwt.verify(data.token, SECRET_KEY);
                const username = decoded.username;

                if (data.recipient && data.recipient !== "all") {
                    sendPrivateFile(username, data.recipient, data);
                } else {
                    broadcastFile(username, data);
                }

                await saveMessage(username, data.recipient, `[File] ${data.filename}`);
            } catch (err) {
                ws.send(JSON.stringify({ type: "error", message: "Invalid token" }));
            }
        } else if (data.type === "public_key") {
            // cache the user key
            userSPKIs.set(data.username, data.key);

            // send the new user's key to everyone else
            wss.clients.forEach(c => {
                if (c.readyState === WebSocket.OPEN && c !== ws) {
                  c.send(JSON.stringify(data));
                }
            });
        }
    });

    ws.on("close", async () => {
        const entry = Array.from(onlineUsers.entries()).find(([user, socket]) => socket === ws);
        const username = entry ? entry[0] : null;
        if (username) {
            onlineUsers.delete(username);
            broadcastMessage(`${username} has left the chat.`, username);
            //updateOnlineUsers();
            await updateUserLists();
        }
    });

    function broadcastMessage(message, senderUsername = null) {
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: "message", message }));
            }
        });
        if (senderUsername) logMessageToFile(senderUsername, "All", message);
    }

    function sendPrivateMessage(sender, recipient, message) {
        const recipientSocket = onlineUsers.get(recipient);
        if (recipientSocket && recipientSocket.readyState === WebSocket.OPEN) {
            recipientSocket.send(JSON.stringify({ type: "private_message", sender, message }));
            ws.send(JSON.stringify({ type: "private_message", sender: "You", message }));
            logMessageToFile(sender, recipient, message);
        } else {
            ws.send(JSON.stringify({ type: "error", message: `User ${recipient} is not online.` }));
            logMessageToFile(sender, `${recipient} (offline)`, message);
        }
    }

    // This is like the broadcastMessage function but for files
    function broadcastFile(sender, fileData) {
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: "file",
                    sender,
                    filename: fileData.filename,
                    mime: fileData.mime,
                    encrypted: fileData.encrypted,
                    iv: fileData.iv,
                    aesKey: fileData.aesKey
                }));
            }
        });
        logMessageToFile(sender, "All", `[File] ${fileData.filename}`);
    }

    function sendPrivateFile(sender, recipient, fileData) {
        const recipientSocket = onlineUsers.get(recipient);
        if (recipientSocket && recipientSocket.readyState === WebSocket.OPEN) {
            recipientSocket.send(JSON.stringify({
                type: "file",
                sender,
                filename: fileData.filename,
                mime: fileData.mime,
                encrypted: fileData.encrypted,
                iv: fileData.iv,
                aesKey: fileData.aesKey
            }));

            // Send a copy to the sender's client to show the file was sent.
            ws.send(JSON.stringify({
                type: "file",
                sender: "You",
                filename: fileData.filename,
                mime: fileData.mime,
                encrypted: fileData.encrypted,
                iv: fileData.iv,
                aesKey: fileData.aesKey
            }));
            logMessageToFile(sender, recipient, `[File] ${fileData.filename}`);
        } else {
            ws.send(JSON.stringify({ type: "error", message: `User ${recipient} is not online.` }));
            logMessageToFile(sender, `${recipient} (offline)`, `[File] ${fileData.filename}`);
        }
    }
});

setInterval(() => {
    wss.clients.forEach((ws) => {
        if (!ws.isAlive) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
}, 10000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
