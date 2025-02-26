document.addEventListener("DOMContentLoaded", function () {
    const chatBox = document.getElementById("chat-box");
    const userInput = document.getElementById("user-input");
    const sendBtn = document.getElementById("send-btn");
    const voiceBtn = document.getElementById("voice-btn");
    const stopBtn = document.getElementById("stop-btn");

    let recognition;
    let isSpeaking = false;
    let lastUserMessage = ""; // Store last user message
    const synth = window.speechSynthesis;

    function appendMessage(sender, message) {
        const msgDiv = document.createElement("div");
        msgDiv.classList.add(sender === "bot" ? "bot-message" : "user-message");
        msgDiv.textContent = message;
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function removeDuplicateUserMessage(text) {
        const lastUserMessageElement = document.querySelector(".user-message:last-child");
        if (lastUserMessageElement && lastUserMessageElement.textContent === text) {
            lastUserMessageElement.remove();
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

        // Prevent duplicate user messages
        if (text === lastUserMessage) return;
        lastUserMessage = text; // Store current message

        removeDuplicateUserMessage(text);
        appendMessage("user", text);
        userInput.value = "";

        removePreviousThinkingMessage(); // Ensure only one "Thinking..." bubble
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
            removePreviousThinkingMessage(); // Remove "Thinking..." after response
            if (data.answer) {
                appendMessage("bot", data.answer);
                if (useVoice) speakResponse(data.answer);
            } else {
                appendMessage("bot", "Sorry, I couldn't find an answer.");
            }
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
                if (transcript === lastUserMessage) return; // Prevent duplicate messages

                lastUserMessage = transcript; // Store last message
                removeDuplicateUserMessage(transcript);
                appendMessage("user", transcript);

                removePreviousThinkingMessage(); // Ensure only one "Thinking..." bubble
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
