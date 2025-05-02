// Start of script.js
document.addEventListener("DOMContentLoaded", function () {
    const chatBox = document.getElementById("chat-box");
    const userInput = document.getElementById("user-input");
    const sendBtn = document.getElementById("send-btn");
    const voiceBtn = document.getElementById("voice-btn");
    const stopBtn = document.getElementById("stop-speaking-btn");
    const playPauseBtn = document.getElementById("play-pause-btn");
    const playPauseIcon = document.getElementById("play-pause-icon");
    const beep = document.getElementById("beep");

    let recognition;
    let usingVoice = false;
    const synth = window.speechSynthesis;
    let currentLanguage = localStorage.getItem("selectedLanguage") || 'en';
    let isMuted = localStorage.getItem("isMuted") === "true";
    let isBotSpeaking = false;
    let finalTranscript = "";
    let lastSpokenText = "";
    let currentUtterance = null;
    let isPaused = false;

    const languageData = {
        en: {
            placeholder: "Enter your question...",
            chatbotTitle: "Opioid Awareness Chatbot",
            botMessage: "Welcome to the Opioid Awareness Chatbot! Here you will learn all about opioids!",
            listeningMessage: "Listening...",
            thinkingMessage: "Thinking...",
            titles: {
                home: "Home",
                language: "Language Preferences",
                feedback: "Feedback",
                resources: "Resources",
                exit: "Exit",
                send: "Send your message",
                voice: "Ask using your voice",
                stop: "Stop speaking",
                mute: "Mute",
                unmute: "Unmute",
                play: "Play",
                pause: "Pause"
            }
        },
        // ... include other languages here (es, fr, zh) as in your original code
    };

    function speakText(text) {
        if (!text.trim() || isMuted) return;
        synth.cancel();
        lastSpokenText = text;
        currentUtterance = new SpeechSynthesisUtterance(text);
        currentUtterance.lang = currentLanguage;
        isBotSpeaking = true;

        playPauseBtn.style.display = "inline-block";
        playPauseIcon.src = "/static/images/pause.png";
        playPauseBtn.title = languageData[currentLanguage].titles.pause;

        currentUtterance.onend = () => {
            isBotSpeaking = false;
            currentUtterance = null;
            isPaused = false;
            playPauseBtn.style.display = "none";
            playPauseIcon.src = "/static/images/pause.png";
            playPauseBtn.title = languageData[currentLanguage].titles.pause;
        };

        synth.speak(currentUtterance);
    }

    function appendMessage(sender, message) {
        const msgDiv = document.createElement("div");
        msgDiv.classList.add(sender === "bot" ? "bot-message" : "user-message");
        msgDiv.innerHTML = message;
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;

        if (sender === "bot") speakText(message);
    }

    function sendMessage(text) {
        if (!text.trim()) return;
        appendMessage("user", text);
        userInput.value = "";
        appendMessage("bot", languageData[currentLanguage].thinkingMessage);

        fetch("/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question: text, language: currentLanguage })
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

    playPauseBtn.addEventListener("click", () => {
        if (synth.speaking && !synth.paused) {
            synth.pause();
            isPaused = true;
            playPauseIcon.src = "/static/images/play.png";
            playPauseBtn.title = languageData[currentLanguage].titles.play;
        } else if (synth.paused) {
            synth.resume();
            isPaused = false;
            playPauseIcon.src = "/static/images/pause.png";
            playPauseBtn.title = languageData[currentLanguage].titles.pause;
        } else if (!synth.speaking && lastSpokenText) {
            speakText(lastSpokenText);
        }
    });

    stopBtn.addEventListener("click", () => {
        if (synth.speaking || isBotSpeaking) synth.cancel();
        if (recognition && usingVoice) recognition.abort();
        userInput.value = "";
        finalTranscript = "";
        voiceBtn.classList.remove("voice-active");
        playPauseBtn.style.display = "none";

        const botMessages = document.querySelectorAll(".bot-message");
        botMessages.forEach(msg => {
            if (
                msg.textContent === languageData[currentLanguage].listeningMessage ||
                msg.textContent === languageData[currentLanguage].thinkingMessage
            ) {
                msg.remove();
            }
        });
    });

    // The rest of your script (voiceBtn listener, language change logic, volume toggle, welcome message) stays unchanged
    // For brevity, I’ve left those sections collapsed here. Let me know if you want them copied again in full.

    // Speak welcome message on load
    const welcomeText = languageData[currentLanguage].botMessage;
    speakText(welcomeText);
});
