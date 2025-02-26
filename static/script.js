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
        msgDiv.textContent = message;
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function removeLastUserMessage(text) {
        const lastUserMessage = document.querySelector(".user-message:last-child");
        if (lastUserMessage && lastUserMessage.textContent === text) {
            lastUserMessage.remove();
        }
    }

    function removePreviousThinkingMessage() {
        const lastThinkingMessage = document.querySelector(".bot-message:last-child");
        if (lastThinkingMessage && lastThinkingMessage.textContent === "Thinking...") {
            lastThinkingMessage.remove();
        }
    }

    function sendMessage(text, useVoice = false) {
        if (!text.trim()) return;

        removeLastUserMessage(text);  // Ensure no duplicate user message
        appendMessage("user", text);
        userInput.value = "";

        removePreviousThinkingMessage(); // Remove old "Thinking..." before adding a new one
        const thinkingMsg = document.createElement("div");
        thinkingMsg.classList.add("bot-message");
        thinkingMsg.textContent = "Thinking...";
        chatBox.appendChild(thinkingMsg);
        chatBox.scrollTop = chatBox.scrollHeight;

        fetch("/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question: text }),
        })
        .then(response => response.json())
        .then(data => {
            removePreviousThinkingMessage(); // Remove "Thinking..." once response is received
            appendMessage("bot", data.answer);
            if (useVoice) speakResponse(data.answer);
        })
        .catch(error => {
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
                removeLastUserMessage(transcript);  // Prevent duplicate question
                appendMessage("user", transcript);
                
                removePreviousThinkingMessage(); // Ensure "Thinking..." is added only once
                const thinkingMsg = document.createElement("div");
                thinkingMsg.classList.add("bot-message");
                thinkingMsg.textContent = "Thinking...";
                chatBox.appendChild(thinkingMsg);
                chatBox.scrollTop = chatBox.scrollHeight;

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
