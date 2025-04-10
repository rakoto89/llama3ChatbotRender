document.addEventListener("DOMContentLoaded", function () {
    const chatBox = document.getElementById("chat-box");
    const userInput = document.getElementById("user-input");
    const sendBtn = document.getElementById("send-btn");
    const voiceBtn = document.getElementById("voice-btn");
    const cancelVoiceBtn = document.getElementById("cancel-voice-btn");

    let recognition;
    let usingVoice = false;
    const synth = window.speechSynthesis;
    let silenceTimeout;
    let currentLanguage = 'en';

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.lang = currentLanguage;
        recognition.continuous = true;
        recognition.interimResults = false;
    } else {
        recognition = null;
        console.warn("Speech recognition not supported in this browser.");
    }

    function appendMessage(sender, message) {
        const msgDiv = document.createElement("div");
        msgDiv.classList.add(sender === "bot" ? "bot-message" : "user-message");
        msgDiv.innerHTML = message;
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function sendMessage(text, useVoice = false) {
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
        if (!recognition) {
            appendMessage("bot", "Sorry, voice input isn't supported in this browser. Please type your question.");
            return;
        }

        recognition.lang = currentLanguage;

        recognition.onresult = (event) => {
            clearTimeout(silenceTimeout);
            let transcript = event.results[event.results.length - 1][0].transcript || "";

            silenceTimeout = setTimeout(() => {
                if (transcript.trim().length > 1) {
                    sendMessage(transcript, true);
                } else {
                    appendMessage("bot", "Sorry, I didn’t catch that. Please try again.");
                }
                recognition.stop();
                usingVoice = false;
            }, 1500);
        };

        recognition.onerror = (event) => {
            console.error("SpeechRecognition error:", event.error);
            appendMessage("bot", "Voice recognition error occurred. Please try typing your question.");
            recognition.stop();
            usingVoice = false;
        };

        recognition.onend = () => {
            clearTimeout(silenceTimeout);
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
