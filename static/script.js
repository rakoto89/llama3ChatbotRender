document.addEventListener("DOMContentLoaded", function () {
    const chatBox = document.getElementById("chat-box");
    const userInput = document.getElementById("user-input");
    const sendBtn = document.getElementById("send-btn");
    const voiceBtn = document.getElementById("voice-btn");
    const cancelVoiceBtn = document.getElementById("cancel-voice-btn");

    let recognition;
    let usingVoice = false;
    const synth = window.speechSynthesis;
    let currentLanguage = 'en';

    function appendMessage(sender, message) {
        const msgDiv = document.createElement("div");
        msgDiv.classList.add(sender === "bot" ? "bot-message" : "user-message");
        msgDiv.innerHTML = message;
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function sendMessage(text) {
        if (!text.trim()) return;

        appendMessage("user", text);
        userInput.value = "";

        appendMessage("bot", "Thinking...");

        fetch("/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                question: text,
                language: currentLanguage
            }),
        })
        .then(res => res.json())
        .then(data => {
            document.querySelector(".bot-message:last-child").remove();
            appendMessage("bot", data.answer || "Error: Could not get a response.");
        })
        .catch(() => {
            document.querySelector(".bot-message:last-child").remove();
            appendMessage("bot", "Error: Could not get a response.");
        });
    }

    function startVoiceRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            appendMessage("bot", "Voice recognition not supported.");
            return;
        }

        recognition = new SpeechRecognition();
        recognition.lang = "en-US";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;

            fetch("/ask", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question: transcript })
            })
            .then(res => res.json())
            .then(data => {
                appendMessage("user", transcript);
                appendMessage("bot", data.answer || "Error: Could not get a response.");
            })
            .catch(err => {
                appendMessage("bot", "Fetch Error: " + err);
            });

            recognition.stop();
        };

        recognition.onerror = (event) => {
            appendMessage("bot", "Recognition Error: " + event.error);
            recognition.stop();
        };

        recognition.onend = () => {
            usingVoice = false;
        };

        recognition.start();
    }

    sendBtn.addEventListener("click", () => sendMessage(userInput.value));
    userInput.addEventListener("keydown", e => {
        if (e.key === "Enter") sendMessage(userInput.value);
    });

    voiceBtn.addEventListener("click", () => {
        usingVoice = true;
        appendMessage("bot", "Listening...");
        startVoiceRecognition();
    });

    cancelVoiceBtn.addEventListener("click", () => {
        if (recognition && usingVoice) {
            recognition.abort();
            usingVoice = false;
            appendMessage("bot", "Voice input canceled.");
        }

        if (synth.speaking) {
            synth.cancel();
            appendMessage("bot", "Voice output canceled.");
        }
    });
});
