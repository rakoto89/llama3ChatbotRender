document.addEventListener("DOMContentLoaded", function () {
    const chatBox = document.getElementById("chat-box");
    const userInput = document.getElementById("user-input");
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.continuous = false;
    recognition.lang = "en-US";

    function addMessage(sender, text) {
        const messageDiv = document.createElement("div");
        messageDiv.classList.add("chat-message", sender);
        messageDiv.textContent = text;
        chatBox.appendChild(messageDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function showTypingIndicator() {
        const typingDiv = document.createElement("div");
        typingDiv.classList.add("typing-indicator");
        typingDiv.textContent = "AI is typing...";
        typingDiv.id = "typing";
        chatBox.appendChild(typingDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function removeTypingIndicator() {
        const typingDiv = document.getElementById("typing");
        if (typingDiv) {
            typingDiv.remove();
        }
    }

    function sendMessage() {
        const text = userInput.value.trim();
        if (text === "") return;
        addMessage("user", text);
        userInput.value = "";
        showTypingIndicator();

        setTimeout(() => {
            removeTypingIndicator();
            addMessage("bot", "Here is some information about opioids..."); // Replace with actual bot response
        }, 1000);
    }

    userInput.addEventListener("keypress", function (event) {
        if (event.key === "Enter") {
            sendMessage();
        }
    });

    document.querySelector("button").addEventListener("click", sendMessage);
    
    // Create and add voice input button
    const voiceButton = document.createElement("button");
    voiceButton.id = "voice-button";
    voiceButton.textContent = "🎤 Speak";
    voiceButton.style.marginLeft = "10px";
    document.querySelector(".chat-input-container").appendChild(voiceButton);
    
    // Voice-to-text feature
    document.getElementById("voice-button").addEventListener("click", function () {
        recognition.start();
    });

    recognition.onresult = function (event) {
        userInput.value = event.results[0][0].transcript;
        sendMessage();
    };
});
