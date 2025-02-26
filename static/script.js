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

    // Define backend API URL (adjust if necessary)
    let apiUrl = window.location.origin + "/ask";  // Ensures compatibility on Render

    // Send request to Flask backend
    fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: userInput })
    })
    .then(response => response.json())
    .then(data => {
        // Remove loading message
        chatBox.removeChild(loadingMessage);

        // Add bot response
        let botMessage = document.createElement("div");
        botMessage.classList.add("chat-message", "bot");
        botMessage.textContent = data.answer || "Sorry, I couldn't get a response.";
        chatBox.appendChild(botMessage);
        chatBox.scrollTop = chatBox.scrollHeight;
    })
    .catch(error => {
        console.error("Error:", error);
        chatBox.removeChild(loadingMessage);

        let errorMessage = document.createElement("div");
        errorMessage.classList.add("chat-message", "bot", "error");
        errorMessage.textContent = "An error occurred. Please try again later.";
        chatBox.appendChild(errorMessage);
    });
}
