document.addEventListener("DOMContentLoaded", function () {
    const chatBox = document.getElementById("chat-box");
    const userInput = document.getElementById("user-input");
    const voiceButton = document.getElementById("voice-button");

    function appendMessage(sender, message) {
        const msgDiv = document.createElement("div");
        msgDiv.classList.add("chat-message", sender);
        msgDiv.textContent = message;
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;

        // Text-to-Speech for bot responses
        if (sender === "bot") {
            const speech = new SpeechSynthesisUtterance(message);
            speechSynthesis.speak(speech);
        }
    }

    function sendMessage() {
        const message = userInput.value.trim();
        if (message === "") return;

        appendMessage("user", message);
        userInput.value = "";

        fetch("/ask", {
            method: "POST",
            body: JSON.stringify({ question: message }),
            headers: { "Content-Type": "application/json" }
        })
        .then(response => response.json())
        .then(data => {
            appendMessage("bot", data.answer);
        })
        .catch(error => {
            appendMessage("bot", "Error: Unable to connect to the server.");
            console.error("Error:", error);
        });
    }

    // Handle Voice Input
    voiceButton.addEventListener("click", function () {
        const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.lang = "en-US";
        recognition.start();

        recognition.onresult = function (event) {
            const voiceInput = event.results[0][0].transcript;
            userInput.value = voiceInput;
            sendMessage();
        };

        recognition.onerror = function () {
            appendMessage("bot", "Sorry, I couldn't hear you. Please try again.");
        };
    });

    // Enter key sends message
    userInput.addEventListener("keypress", function (event) {
        if (event.key === "Enter") {
            sendMessage();
        }
    });
});

