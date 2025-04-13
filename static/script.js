document.addEventListener("DOMContentLoaded", function () {
    const chatBox = document.getElementById("chat-box");
    const userInput = document.getElementById("user-input");
    const sendBtn = document.getElementById("send-btn");
    const voiceBtn = document.getElementById("voice-btn");
    const beep = new Audio("/static/beep2.mp3");

    let recognition;
    let usingVoice = false;
    const synth = window.speechSynthesis;
    let currentLanguage = localStorage.getItem("selectedLanguage") || 'en';
    let isMuted = false; // Tracks mute state
    let isBotSpeaking = false; // Tracks if the bot is currently speaking
    let processingTimeout;

    const languageData = {
        en: {
            placeholder: "Enter your question...",
            chatbotTitle: "Opioid Awareness Chatbot",
            botMessage: "Welcome to the Opioid Awareness Chatbot! Here you will learn all about opioids!",
            listeningMessage: "Listening...",
            thinkingMessage: "Thinking...",
            systemMessages: {
                stopListening: "I have been asked to stop listening.",
                stopTalking: "I have been asked to stop talking.",
                noSpeech: "Recognition error: no speech",
                aborted: "Recognition error: aborted"
            },
            titles: {
                home: "Home",
                language: "Language Preferences",
                feedback: "Feedback",
                resources: "Resources",
                exit: "Exit",
                send: "Send your message",
                voice: "Ask using your voice"
            }
        },
        // other languages here
    };

    function appendMessage(sender, message) {
        const msgDiv = document.createElement("div");
        msgDiv.classList.add(sender === "bot" ? "bot-message" : "user-message");
        msgDiv.innerHTML = message;
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;

        if (sender === "bot" && usingVoice) speakText(message);
    }

    function speakText(text, callback) {
        if (!text.trim() || isMuted) return; // Silent when muted
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = currentLanguage;

        isBotSpeaking = true; // Start speaking
        utterance.onend = () => {
            isBotSpeaking = false; // Stop speaking
            if (callback) callback();
        };

        synth.speak(utterance);
    }

    function sendMessage(text) {
        if (!text.trim()) return;

        appendMessage("user", text);
        userInput.value = "";

        appendMessage("bot", languageData[currentLanguage].thinkingMessage);

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
            const response = data.answer || "Error: Could not get a response.";
            appendMessage("bot", response);
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
        recognition.lang = currentLanguage;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            if (!isMuted) {
                beep.play(); // <-- Beep will play only if not muted
            }
        };

        recognition.onresult = (event) => {
            if (isBotSpeaking) {
                // Ignore any input while the bot is speaking
                return;
            }

            const transcript = event.results[0][0].transcript;

            appendMessage("user", transcript);

            const lastBotMessage = document.querySelector(".bot-message:last-child");
            if (lastBotMessage && lastBotMessage.textContent === languageData[currentLanguage].listeningMessage) {
                lastBotMessage.remove();
            }

            appendMessage("bot", languageData[currentLanguage].thinkingMessage);

            fetch("/ask", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question: transcript, language: currentLanguage })
            })
            .then(res => res.json())
            .then(data => {
                document.querySelector(".bot-message:last-child").remove();
                const response = data.answer || "Error: Could not get a response.";
                appendMessage("bot", response);
            })
            .catch(err => {
                document.querySelector(".bot-message:last-child").remove();
                appendMessage("bot", "Fetch Error: " + err);
            });

            recognition.stop();
        };

        recognition.onerror = (event) => {
            if (event.error === "no-speech") {
                appendMessage("bot", languageData[currentLanguage].systemMessages.noSpeech);
            } else if (event.error === "aborted") {
                appendMessage("bot", languageData[currentLanguage].systemMessages.aborted);
            } else {
                appendMessage("bot", "Recognition Error: " + event.error);
            }
            recognition.stop();
        };

        recognition.onend = () => {
            clearTimeout(processingTimeout);
            processingTimeout = setTimeout(() => {
                if (usingVoice) {
                    recognition.start();
                }
            }, 5000); // Waits for a 5-second pause before processing
        };

        recognition.start();
    }

    sendBtn.addEventListener("click", () => {
        usingVoice = false;
        sendMessage(userInput.value);
    });

    userInput.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            usingVoice = false;
            sendMessage(userInput.value);
        }
    });

    voiceBtn.addEventListener("click", () => {
        if (synth.speaking || usingVoice) {
            if (synth.speaking) synth.cancel();
            if (recognition) recognition.abort();
            usingVoice = false;
            return;
        }

        usingVoice = true;
        appendMessage("bot", languageData[currentLanguage].listeningMessage);
        startVoiceRecognition();
    });

    // Additional setup code...
});
