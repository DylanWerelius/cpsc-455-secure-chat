# CPSC 455 SecureChat
Created by Dylan Werelius & Victoria Guzman <br>
Cal State Fullerton CPSC 455

# What is SecureChat
SecureChat is a real‑time, end‑to‑end encrypted chat application built with WebSockets, SQLite, and a lack of sleep. It has a front end using vanilla JavaScript and CSS. It supports registration, login, public and private messaging, file transfer, online/offline user lists, and Google reCAPTCHA protection.

# I. Features
- User Registration & Login
- Google reCAPTCHA on login and register to prevent bot sign-ups/logins
- JWT Authentication: token‐based session for WebSocket messages
- Online/Offline User Lists: Real‑time lists of connected and registered-but-offline users
- Public Chat & Private Messaging: Broadcast to all or one‑to‑one encrypted chats (end-to-end encrypted)
- Encrypted File Sharing (end-to-end encryted)
- Message Rate Limiting
- Security Logging: Records invalid login attempts and lockouts in logs/security.txt
- 24/7 Uptime
- Heartbeat & Cleanup: Ping/pong to detect dead clients

# II. Architecture & Implementation
Front End<br>
- HTML, CSS, Vanilla JS
- Front end hosted on Glitch

Back End<br>
- Websocket Server hosted on Glitch
- Node.js server hosted on Glitch
- Node.js, Express, WebSockets, CommonJS
- Upgrades HTTP requests to WebSocket connections
- Verifies reCAPTCHA attemps

Database
- SQLite

# III. Encryption
What is Encrypted?
- File Contents are end-to-end encrypted
- AES Key Wrapping
- Messages are end-to-end encrypted

# IV. Further Information
- Rate Limiting: max 1 message per second per user
- Account Lockout: 5 consecutive invalid login attempts → 1 min lock
- Process Management: For production, use pm2 or a systemd service to run npm start
- HTTPS/WSS is handled through Glitch
- Extensibility: You can extend message encryption to chat texts by applying the same AES+RSA workflow.

# V. How to use SecureChat
To Create and Account <br>
Step 1: Navigate to https://secure-chat-evergarden.glitch.me <br>
Step 2: Create an Username and a Password <br>
Step 3: Complete the reCAPTCHA <br>
Step 4: Click the Register button <br>
Step 5: Start Chatting <br>

To Log In to an Existing Account<br>
Step 1: Navigate to https://secure-chat-evergarden.glitch.me <br>
Step 2: Enter your Username and Password <br>
Step 3: Complete the reCAPTCHA <br>
Step 4: Click the Login button <br>
Step 5: Continue Chatting <br>

# DEVLOPER NOTES - PLEASE IGNORE
Instructions for running:
1. navigate to the SecureChat directory with "cd SecureChat"
2. a. type "npm i ws bcryptjs jsonwebtoken dotenv sqlite3 sqlite express node-fetch@2"
   b. type "npm install electron --save-dev"
   c. type "npm install electron-packager --save-dev"
3. create a file called .env at the in the SecureChat folder
4. open the .env file and type "SECRET_KEY=3v3rg@rd3n" (without the quotes obviously) and save it
5. to get a distribution (.exe file) type "npx electron-packager . SecureChat --platform=win32 --arch=x64 --out=distribution"

Dev Testing:
- To make sure the server is running, ssh to the pi and type "netstat -tulnp | grep 80" in the console.
- If nothing comes up, then it is not running.
- If its running, you should get "tcp    0   0 0.0.0.0:80         0.0.0.0:*        LISTEN      -"
