document.getElementById("user-input").addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        sendMessage();
    }
});

function sendMessage() {
    let userInput = document.getElementById("user-input").value.trim();
    if (userInput === "") return;

    let chatBox = document.getElementById("chat-box");

    // Add user message to chat
    let userMessage = document.createElement("div");
    userMessage.classList.add("chat-message", "user");
    userMessage.textContent = userInput;
    chatBox.appendChild(userMessage);

    document.getElementById("user-input").value = ""; // Clear input
    chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll

    // Show loading animation
    let loadingMessage = document.createElement("div");
    loadingMessage.classList.add("chat-message", "bot", "loading");
    loadingMessage.textContent = "Thinking...";
    chatBox.appendChild(loadingMessage);
    chatBox.scrollTop = chatBox.scrollHeight;

    // Send request to Flask backend
    fetch("/ask", {
        method: "POST",
        body: new URLSearchParams({ question: userInput }),
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
    })
    .t
