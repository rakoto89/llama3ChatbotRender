document.addEventListener("DOMContentLoaded", function () {
    const chatBox = document.getElementById("chat-box");
    const userInput = document.getElementById("user-input");
    const sendBtn = document.getElementById("send-btn");
    const voiceBtn = document.getElementById("voice-btn");
    const stopBtn = document.getElementById("stop-btn");

    let recognition;
    let isSpeaking = false;
    let lastUserMessage = "";
    const synth = window.speechSynthesis;

    function appendMessage(sender, message, isThinking = false) {
        const msgDiv = document.createElement("div");
        msgDiv.classList.add(sender === "bot" ? "bot-message" : "user-message");
        if (isThinking) msgDiv.classList.add("thinking");
        msgDiv.textContent = message;
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function removePreviousThinkingMessage() {
        const thinkingMessage = document.querySelector(".bot-message.thinking");
        if (thinkingMessage) thinkingMessage.remove();
    }

    function sendMessage(text, useVoice = false) {
        if (!text.trim() || text === lastUserMessage) return;

        lastUserMessage = text;
        appendMessage("user", text);
        userInput.value = "";

        removePreviousThinkingMessage();
        appendMessage("bot", "Thinking...", true);

        fetch("/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question: text }),
        })
        .then(response => response.json())
        .then(data => {
            removePreviousThinkingMessage();
            if (data.answer) {
                appendMessage("bot", data.answer);
                if (useVoice) speakResponse(data.answer);
            } else {
                appendMessage("bot", "Sorry, I couldn't find an answer.");
            }
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

    sendBtn.addEventListener("click", () => sendMessage(userInput.value, false));

    userInput.addEventListener("keypress", function (event) {
        if (event.key === "Enter") sendMessage(userInput.value, false);
    });

    voiceBtn.addEventListener("click", () => {
        if ("webkitSpeechRecognition" in window) {
            recognition = new webkitSpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = "en-US";

            recognition.onstart = () => appendMessage("bot", "Listening...");

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                if (transcript === lastUserMessage) return;

                lastUserMessage = transcript;
                sendMessage(transcript, true);
            };

            recognition.onerror = () => appendMessage("bot", "Sorry, I couldn't hear you. Please try again.");
            recognition.start();
        } else {
            alert("Voice recognition is not supported in this browser.");
        }
    });

    stopBtn.addEventListener("click", stopSpeaking);
});
