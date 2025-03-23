// Make sure this is the same port as the one in server.js
const ws = new WebSocket("ws://securechat.ddns.net:80");
window.socket = ws;
let token = "";

ws.onopen = () => console.log("Connected to the server>");
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === "auth"){
        token = data.token;
        username = username = data.username;
        //alert("Logged in Successfully!");
        document.getElementById("auth-section").classList.add("hidden");
        document.getElementById("chat-section").classList.remove("hidden");
    } else if (data.type === "message") {
        addMessage(data.data);
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

    // This will catch if the user just clicks the send button with nothing in the text box
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
function formatMessage(text) {
    if (typeof text !== "string") return ""; // ⛔ skip non-string
    text = text.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
    text = text.replace(/\*(.*?)\*/g, "<i>$1</i>");
    text = text.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
    return text;
}

WebSocket.onmessage = function (event) {
    const data = JSON.parse(event.data);
    const formattedMessage = formatMessage(data.data || data.message || "");
    document.getElementById("chatBox").innerHTML += `<p>${formattedMessage}</p>`;
};


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