document.addEventListener("DOMContentLoaded", function () {
    const chatBox = document.getElementById("chat-box");
    const userInput = document.getElementById("user-input");
    const sendBtn = document.getElementById("send-btn");
    const voiceBtn = document.getElementById("voice-btn");
    const stopBtn = document.getElementById("stop-btn");

    let recognition;
    let isSpeaking = false;
    const synth = window.speechSynthesis;

    function appendMessage(sender, message) {
        const msgDiv = document.createElement("div");
        msgDiv.classList.add(sender === "bot" ? "bot-message" : "user-message");
        msgDiv.innerHTML = message;
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function removePreviousThinkingMessage() {
        const lastThinkingMessage = document.querySelector(".bot-message:last-child");
        if (lastThinkingMessage && lastThinkingMessage.textContent === "Thinking...") {
            lastThinkingMessage.remove();
        }
    }

    function sendMessage(text, useVoice = false) {
        if (!text.trim()) return;

        appendMessage("user", text);
        userInput.value = "";

        removePreviousThinkingMessage();
        const thinkingMsg = document.createElement("div");
        thinkingMsg.classList.add("bot-message");
        thinkingMsg.textContent = "Thinking...";
        chatBox.appendChild(thinkingMsg);
        chatBox.scrollTop = chatBox.scrollHeight;

        if (useVoice) {
            speakResponse("Thinking...");  // Speak "Thinking..." only when using voice input
        }

        fetch("/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question: text }),
        })
        .then(response => response.json())
        .then(data => {
            removePreviousThinkingMessage();
            appendMessage("bot", data.answer);
            if (useVoice) speakResponse(data.answer);
        })
        .catch(() => {
            removePreviousThinkingMessage();
            appendMessage("bot", "Error: Could not get a response.");
        });
    }

    function speakResponse(text) {
        if ("speechSynthesis" in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            synth.speak(utterance);
            isSpeaking = true;
            utterance.onend = () => { isSpeaking = false; };
        }
    }

    function stopSpeaking() {
        if (isSpeaking) {
            synth.cancel();
            isSpeaking = false;
        }
    }

    sendBtn.addEventListener("click", () => {
        sendBtn.disabled = true;
        sendMessage(userInput.value, false);  // Don't speak "Thinking..." for text input
        setTimeout(() => sendBtn.disabled = false, 500);
    });

    userInput.addEventListener("keypress", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            sendBtn.click();
        }
    });

    voiceBtn.addEventListener("click", () => {
        if ("webkitSpeechRecognition" in window) {
            recognition = new webkitSpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = "en-US";

            recognition.onstart = () => {
                appendMessage("bot", "Listening...");
                speakResponse("Listening...");  // Speak "Listening..." when using voice input
            };

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                sendMessage(transcript, true);  // Pass true to trigger "Thinking..." and voice output
            };

            recognition.onerror = () => {
                appendMessage("bot", "Sorry, I couldn't hear you. Please try again.");
                speakResponse("Sorry, I couldn't hear you. Please try again.");  // Speak the error message
            };

            recognition.start();
        } else {
            alert("Voice recognition is not supported in this browser.");
        }
    });

    stopBtn.addEventListener("click", stopSpeaking);
});
