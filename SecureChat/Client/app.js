// Make sure this is the same port as the one in server.js
const ws = new WebSocket("ws://securechat.ddns.net:80");
window.socket = ws;
let token = "";

let rsaKeyPair;
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
});

ws.onopen = () => console.log("Connected to the server");

// This function is used to detect messages being received
ws.onmessage = async (event) => {
    const data = JSON.parse(event.data);

    if (data.type === "auth"){
        token = data.token;
        username = username = data.username;
        //alert("Logged in Successfully!");
        document.getElementById("auth-section").classList.add("hidden");
        document.getElementById("chat-section").classList.remove("hidden");
    } else if (data.type === "message") {
        console.log("Message read from correct function");
        addMessage(data.message);
    } else if (data.type === "file") {
        console.log("Receiving a file");
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
        document.getElementById("chat-box").appendChild(link);
    } else if (data.type === "private_message") {
        addMessage(`[Private] ${data.sender}: ${data.message}`);
    } else if (data.type === "online_users") {
        updateOnlineUsersList(data.users);
    } else if (data.type === "error") {
        alert(data.message);
    }
};

// register a new user (victoria)
function register() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    if (!username || !password) return showError("Please enter a username and password.");
    ws.send(JSON.stringify({ type: "register", username, password }));
}

// user authentication (login) (victoria)
function login() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    if (!username || !password) return showError("Please enter a username and password.");
    ws.send(JSON.stringify({ type: "login", username, password }));
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
}

function toggleEmojiPicker() {
    const picker = document.getElementById("emojiPicker");
    picker.style.display = picker.style.display === "none" ? "flex" : "none";
  }
  
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

// Don't delete
// WebSocket.onmessage = function (event) {
//     console.log("Function call from line 92 WebSocket.onmessage");
//     const data = JSON.parse(event.data);
//     const formattedMessage = formatMessage(data.data || data.message || "");
//     document.getElementById("chatBox").innerHTML += `<p>${formattedMessage}</p>`;
// };


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
    document.getElementById("chat-box").appendChild(node);
}

function showError(message) {
    const errorElement = document.getElementById("auth-error");
    errorElement.textContent = message;
    errorElement.classList.remove("hidden");
}

function updateOnlineUsersList(users) {
    const dropdown = document.getElementById("recipient");
    
    // Clear the previous options (except "All")
    dropdown.innerHTML = '<option value="all">All</option>';

    users.forEach((user) => {
        // Don't include yourself in the list
        if (user !== username) {
            const option = document.createElement("option");
            option.value = user;
            option.textContent = user;
            dropdown.appendChild(option);
        }
    });
}

const fileInput = document.getElementById("fileInput");
fileInput.addEventListener("change", async (e) => {
    console.log("File has been detected");
    const file = e.target.files[0];
    if (!file) {
        console.log("Error adding file");
        return;
    }
    const arrayBuffer = await file.arrayBuffer();
    const aesKey = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt"]
    );
    
    const rawKey = await crypto.subtle.exportKey("raw", aesKey);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        aesKey,
        arrayBuffer
    );
    
    const payload = {
        type: "file",
        token,
        filename: file.name,
        mime: file.type,
        encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
        iv: Array.from(iv),
        aesKey: Array.from(new Uint8Array(rawKey)), // Placeholder, to be encrypted via RSA later
        recipient: document.getElementById("recipient").value
    };
    
    console.log("Sending File...");
    ws.send(JSON.stringify(payload));
    console.log("File Sent");
});

// Delete once file sharing works
// ws.addEventListener("message", async (event) => {
//     console.log("Message read from the file only function");
//     const data = JSON.parse(event.data);
//     if (data.type === "file") {
//         console.log("Receiving a file");
//         const encryptedAESKey = new Uint8Array(data.aesKey);
//         const iv = new Uint8Array(data.iv);
//         const encryptedData = Uint8Array.from(atob(data.encrypted), c => c.charCodeAt(0));
        
//         const rawAESKey = await crypto.subtle.decrypt(
//             { name: "RSA-OAEP" },
//             rsaKeyPair.privateKey,
//             encryptedAESKey
//         );
              
//         const aesKey = await crypto.subtle.importKey(
//             "raw",
//             rawAESKey,
//             { name: "AES-GCM" },
//             false,
//             ["decrypt"]
//         );
              
//         const decrypted = await crypto.subtle.decrypt(
//             { name: "AES-GCM", iv },
//             aesKey,
//             encryptedData
//         );
              
//         const blob = new Blob([decrypted], { type: data.mime });
//         const link = document.createElement("a");
//         link.href = URL.createObjectURL(blob);
//         link.download = data.filename;
//         link.textContent = `📎 Download: ${data.filename}`;
//         link.classList.add("block", "text-blue-500", "hover:underline", "mt-2");
//         document.getElementById("chatBox").appendChild(link);
//     }
// });