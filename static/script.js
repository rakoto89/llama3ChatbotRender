document.addEventListener("DOMContentLoaded", function () {
    const chatBox = document.getElementById("chat-box");
    const userInput = document.getElementById("user-input");
    const voiceButton = document.getElementById("voice-button");

    function appendMessage(sender, text) {
        const messageDiv = document.createElement("div");
        messageDiv.classList.add("chat-message", sender);
        messageDiv.textContent = text;
        chatBox.appendChild(messageDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function showTypingIndicator() {
        const typingIndicator = document.createElement("div");
        typingIndicator.classList.add("chat-message", "typing-indicator");
        typingIndicator.textContent = "Chatbot is typing...";
        chatBox.appendChild(typingIndicator);
        chatBox.scrollTop = chatBox.scrollHeight;
        return typingIndicator;
    }

    function sendMessage() {
        const message = userInput.value.trim();
        if (message === "") return;

        appendMessage("user", message);
        userInput.value = "";

        const typingIndicator = showTypingIndicator();

        setTimeout(() => {
            chatBox.removeChild(typingIndicator);
            appendMessage("bot", "This is a sample chatbot response about opioids.");
        }, 1500);
    }

    userInput.addEventListener("keypress", function (event) {
        if (event.key === "Enter") {
            sendMessage();
        }
    });

    if ("webkitSpeechRecognition" in window) {
        const recognition = new webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        recognition.onresult = function (event) {
            const speechText = event.results[0][0].transcript;
            userInput.value = speechText;
            sendMessage();
        };

        recognition.onerror = function (event) {
            console.error("Speech recognition error:", event);
        };

        voiceButton.addEventListener("click", function () {
            recognition.start();
        });
    } else {
        voiceButton.style.display = "none"; // Hide button if speech recognition is unsupported
    }
});
