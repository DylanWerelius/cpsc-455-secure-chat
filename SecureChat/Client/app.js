// Make sure this is the same port as the one in server.js
let token = "";
let rsaKeyPair;
let onlineUsers = [];
let offlineUsers = [];
let publicKeys = {};
let reconnectInterval = 1000; // start with 1s
let socket;


console.log("RSA key Generated successfully");

// Connect to the new websocket
const PROJECT = "secure-chat-evergarden"; 
//const ws = new WebSocket(`wss://${PROJECT}.glitch.me`);
ws = new WebSocket("ws://127.0.0.1:3000"); // localhost testing
window.socket = ws;

function connectWebSocket() {

    ws.onopen = () => {
        console.log("✅ Connected to WebSocket server.");
        reconnectInterval = 1000;
        updateConnectionStatus(true);
    };
    
    ws.onclose = () => {
        console.warn("⚠️ Disconnected. Reconnecting...");
        updateConnectionStatus(false);
        setTimeout(connectWebSocket, reconnectInterval);
        reconnectInterval = Math.min(reconnectInterval * 2, 30000);
    };

    ws.onerror = (e) => console.error("WebSocket error:", e);

    ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
    };
}
function updateConnectionStatus(connected) {
    const banner = document.getElementById("connection-status");
    if (!banner) return;

    if (connected) {
        banner.textContent = "Connected";
        banner.style.backgroundColor = "#4caf50";
        setTimeout(() => {
            banner.style.display = "none";
        }, 3000);
    } else {
        banner.textContent = "Reconnecting...";
        banner.style.backgroundColor = "#f44336";
        banner.style.display = "block";
    }
}

connectWebSocket();
(async () => {
    rsaKeyPair = await window.crypto.subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: 4096,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256"
        },
        true,
        ["encrypt", "decrypt"]
    );

    // This function is used to detect messages being received
    ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "auth") {
            token = data.token;
            username = data.username;
            document.getElementById("auth-section").classList.add("hidden");
            document.getElementById("chat-page").classList.remove("hidden");
            document.getElementById("chat-page").classList.add("chat-section");

            // send your public key to the server so it can relay to everyone else
            const spki = await crypto.subtle.exportKey("spki", rsaKeyPair.publicKey);
            ws.send(JSON.stringify({
                type: "public_key",
                username,
                key: Array.from(new Uint8Array(spki))
            }));
        } else if (data.type === "message") {
            //console.log("Message read from correct function");
            addMessage(data.message);

        } else if (data.type === "file") {
            if (data.sender === "You") return;
            
            //console.log("Receiving a file");
            const encryptedAESKey = new Uint8Array(data.aesKey);
            const iv = new Uint8Array(data.iv);
            const encryptedData = Uint8Array.from(atob(data.encrypted), c => c.charCodeAt(0));
            
            const rawAESKey = await crypto.subtle.decrypt(
                { name: "RSA-OAEP" },
                rsaKeyPair.privateKey,
                encryptedAESKey
            );

            const aesKey = await crypto.subtle.importKey(
                "raw",
                rawAESKey,
                { name: "AES-GCM" },
                false,
                ["decrypt"]
            );

            const decrypted = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv },
                aesKey,
                encryptedData
            );

            const blob = new Blob([decrypted], { type: data.mime });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = data.filename;
            link.textContent = `📎 Download: ${data.filename}`;
            link.classList.add("block", "text-blue-500", "hover:underline", "mt-2");
            document.getElementById("chat-log").appendChild(link);
        } else if (data.type === "private_message") {
            addMessage(`[Private] ${data.sender}: ${data.message}`);
            //console.log("📩 Decrypted:", decryptedMessage);
        } else if (data.type === "online_users") {
            handleUserUpdate(data.users);
        } else if (data.type === "error") {
            alert(data.message);
        } else if (data.type === "offline_users") {
            const offUL = document.getElementById("offline-users-list");
            offUL.innerHTML = "";
            data.users.forEach(u => {
                const li = document.createElement("li");
                li.textContent = u;
                offUL.appendChild(li);

                if (publicKeys[u])
                {
                    delete publicKeys[u];
                }
            });
        } else if (data.type === "public_key") {
            //console.log("New Recipient", data.username, " with key ", data.key);
            const bytes = new Uint8Array(data.key);
            publicKeys[data.username] = await crypto.subtle.importKey(
                "spki",
                bytes.buffer,
                { name: "RSA-OAEP", hash: "SHA-256" },
                true,
                ["encrypt"]
            );
        } else if (data.type === "success") {
            const username = document.getElementById("username").value;
            const password = document.getElementById("password").value;
            if (!username || !password) return showError("Please enter a username and password.");
            ws.send(JSON.stringify({ type: "login-no-captcha", username, password }));
        }
    };

    const fileInput = document.getElementById("fileInput");
    fileInput.addEventListener("change", async (e) => {
        console.log("File has been detected");

        // Get the file
        const file = e.target.files[0];
        if (!file) {
            console.log("Error adding file");
            return;
        }
        const arrayBuffer = await file.arrayBuffer();

        // Encrypt the file
        const aesKey = await crypto.subtle.generateKey(
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
        );
        
        const rawKey = await crypto.subtle.exportKey("raw", aesKey);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        
        const encryptedData = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            aesKey,
            arrayBuffer
        );
        const b64data = btoa(String.fromCharCode(...new Uint8Array(encryptedData)));

        // decide the recipients of the file
        let toSend = [];
        if (document.getElementById("recipient").value === "all") {
            toSend = onlineUsers.filter(u => u !== username);
        } else {
            toSend = [document.getElementById("recipient").value]
        }

        console.log("Recipients: ", toSend.toString());
        // wrap the AES key under the recipient's public key
        for (const recip of toSend) {
            const pubKey = publicKeys[recip];
            if (!pubKey) {
                console.error("No public key for", recip);
                continue;
            }
            const wrapped = await crypto.subtle.encrypt(
                { name: "RSA-OAEP" }, pubKey, rawKey
            )
            const wrappedArray = Array.from(new Uint8Array(wrapped));

            console.log("Sending File...");
            // Send a separate payload to that one user
            ws.send(JSON.stringify({
                type: "file",
                token,
                filename: file.name,
                mime: file.type,
                encrypted: b64data,
                iv: Array.from(iv),
                aesKey: wrappedArray,
                recipient: recip
            }));
            console.log("File Sent");
        }

        // Show the file on your own chat log
        const blob = new Blob([arrayBuffer], { type: file.type });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = file.name;
        link.textContent = `📎 Download: ${file.name}`;
        link.classList.add("block", "text-blue-500", "hover:underline", "mt-2");
        document.getElementById("chat-log").appendChild(link);
    });
})();

// register a new user (victoria)
function register() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    if (!username || !password) return showError("Please enter a username and password.");
  
    // Add Captcha Check
    console.log("Validating Captcha");
    const captchaResponse = grecaptcha.getResponse();
    
    if (!captchaResponse) {
        showError("Please complete the CAPTCHA");
        return;
    }
  
    ws.send(JSON.stringify({ type: "register", username, password, recaptchaToken: captchaResponse }));
    //ws.send(JSON.stringify({ type: "register", username, password }));
}

// user authentication (login) (victoria)
function login() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    if (!username || !password) return showError("Please enter a username and password.");
  
    // Add Captcha Check
    console.log("Validating Captcha");
    const captchaResponse = grecaptcha.getResponse();
    
    if (!captchaResponse) {
        showError("Please complete the CAPTCHA");
        return;
    }
    
    ws.send(JSON.stringify({ type: "login", username, password, recaptchaToken: captchaResponse }));
    //ws.send(JSON.stringify({ type: "login", username, password }));
}

function sendMessage() {
    const messageInput = document.getElementById("message");
    const recipient = document.getElementById("recipient").value;
    const message = messageInput.value.trim();

    // This is where the message gets sent
    if (message) {
        ws.send(JSON.stringify({
            type: "message",
            token,
            recipient,
            data: message
        }));
        document.getElementById("message").value = "";
    }
    //console.log("🔐 Sending encrypted:", message);
}
// select emoji 
function toggleEmojiPicker() {
    const picker = document.getElementById("emojiPicker");
    picker.style.display = picker.style.display === "none" ? "flex" : "none";
  }
// add emoji to text feild
function addEmoji(emoji) {
    const input = document.getElementById("message");
    if (input) {
      input.value += emoji;
      input.focus(); // optional: refocus input after insert
    }
  }

document.querySelectorAll(".emoji").forEach(emoji => {
    emoji.addEventListener("click", function () {
        const messageInput = document.getElementById("message");
        messageInput.value += this.innerText; // Insert emoji into input field
        document.getElementById("emojiPicker").style.display = "none"; // Hide picker after selection
    });
});

//
function formatMessage(text) {
    if (typeof text !== "string") return ""; // ⛔ skip non-string
    text = text.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
    text = text.replace(/\*(.*?)\*/g, "<i>$1</i>");
    text = text.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
    return text;
}

document.getElementById("message").addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        sendMessage();
    }
});

function addMessage(message) {
    const node = document.createElement("P");
    const text = document.createTextNode(message);

    node.appendChild(text);
    node.classList.add("text-gray-700", "py-1");

    // This will add the message to the chat on the users' screen
    document.getElementById("chat-log").appendChild(node);
}

function showError(message) {
    const errorElement = document.getElementById("auth-error");
    errorElement.textContent = message;
    errorElement.classList.remove("hidden");
}

function handleUserUpdate(serverUsers) {
    // remove yourself
    const current = serverUsers;

    // Who is offline
    const wentOffline = onlineUsers.filter(u => !current.includes(u));
    // Who is online
    const cameOnline = onlineUsers.filter(u => !onlineUsers.includes(u));

    // move them in n out
    wentOffline.forEach(u => {
        offlineUsers.push(u);
        onlineUsers = onlineUsers.filter(x => x !== u);
      });
      cameOnline.forEach(u => {
        onlineUsers.push(u);
        offlineUsers = offlineUsers.filter(x => x !== u);
      });
    
      // sync (in case of out‑of‑order)
      onlineUsers = current.slice();
    
      renderUserLists();
}

// write to the list
function renderUserLists() {
    const onlineList = document.getElementById("online-users-list");
    const offlineList = document.getElementById("offline-users-list");
    const dropdown = document.getElementById("recipient");
    onlineList.innerHTML = "";
    offlineList.innerHTML = "";
    dropdown.innerHTML = '<option value="all">All</option>';

  
    onlineUsers.forEach(u => {
      const li = document.createElement("li");
      li.textContent = u === username ?  u + " (You)" : u;
      onlineList.appendChild(li);
      
      if (u !== username)
      {
        const option = document.createElement("option");
        option.value = u;
        option.textContent = u;
        dropdown.appendChild(option);
      }
    });
  
    offlineUsers.forEach(u => {
      const li = document.createElement("li");
      li.textContent = u;
      offlineList.appendChild(li);
    });
  }