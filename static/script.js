document.addEventListener("DOMContentLoaded", function () {
    const chatBox = document.getElementById("chat-box");
    const userInput = document.getElementById("user-input");
    const sendBtn = document.getElementById("send-btn");
    const voiceBtn = document.getElementById("voice-btn");

    let recognition;
    let isSpeaking = false;
    let usingVoice = false;
    const synth = window.speechSynthesis;

    function appendMessage(sender, message) {
        const msgDiv = document.createElement("div");
        msgDiv.classList.add(sender === "bot" ? "bot-message" : "user-message");
        msgDiv.innerHTML = message;
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;

        if (sender === "bot" && usingVoice && message === "Listening...") {
            speakResponse(message, () => {
                playBeep();
                startVoiceRecognition();
            });
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

        appendMessage("user", text);
        userInput.value = "";

        removePreviousThinkingMessage();
        const thinkingMsg = document.createElement("div");
        thinkingMsg.classList.add("bot-message");
        thinkingMsg.textContent = "Thinking...";
        chatBox.appendChild(thinkingMsg);
        chatBox.scrollTop = chatBox.scrollHeight;

        if (useVoice) speakResponse("Thinking...");

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

    function speakResponse(text, callback) {
        if ("speechSynthesis" in window) {
            const cleanText = text.replace(/<br\s*\/?>/g, " ");
            if (cleanText.trim() === "") return;

            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.onend = () => {
                isSpeaking = false;
                if (callback) callback();
            };
            synth.speak(utterance);
            isSpeaking = true;
        }
    }

    function startVoiceRecognition() {
        if ("webkitSpeechRecognition" in window) {
            recognition = new webkitSpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = "en-US";

            recognition.onstart = () => {
                appendMessage("bot", "Listening...");
            };

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                sendMessage(transcript, true);
            };

            recognition.onerror = (event) => {
                appendMessage("bot", "Error recognizing speech.");
            };

            recognition.start();
        } else {
            alert("Your browser does not support speech recognition.");
        }
    }

    sendBtn.addEventListener("click", () => {
        sendMessage(userInput.value, false);
    });

    voiceBtn.addEventListener("click", () => {
        usingVoice = true;
        startVoiceRecognition();
    });
});
