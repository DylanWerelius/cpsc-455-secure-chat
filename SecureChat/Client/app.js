// Make sure this is the same port as the one in server.js
const ws = new WebSocket("ws://192.168.1.160:80");
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