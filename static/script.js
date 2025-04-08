document.addEventListener("DOMContentLoaded", function () {
    const chatBox = document.getElementById("chat-box");
    const userInput = document.getElementById("user-input");
    const sendBtn = document.getElementById("send-btn");
    const voiceBtn = document.getElementById("voice-btn");
    const cancelVoiceBtn = document.getElementById("cancel-voice-btn");
    const languageOptions = document.getElementById("language-options");

    let recognition;
    let isSpeaking = false;
    let usingVoice = false;
    const synth = window.speechSynthesis;

    // Play beep sound when voice recording starts
    function playBeep() {
        const audio = new Audio('beep.mp3');
        audio.play();
    }

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

            recognition.onend = () => {
                // auto-restart can be added here
            };

            recognition.start();
        } else {
            alert("Your browser does not support speech recognition.");
        }
    }

    function changeLanguage(language) {
        // Set language for chatbot
        if (language === "en") {
            // Set to English
        } else if (language === "es") {
            // Set to Spanish
        } else if (language === "fr") {
            // Set to French
        } else if (language === "zh") {
            // Set to Chinese
        }
        alert("Language changed to " + language);
    }

    function showLanguageOptions() {
        languageOptions.style.display = "block";
    }

    sendBtn.addEventListener("click", () => {
        sendMessage(userInput.value, false);
    });

    voiceBtn.addEventListener("click", () => {
        usingVoice = true;
        startVoiceRecognition();
    });

    cancelVoiceBtn.addEventListener("click", () => {
        stopSpeaking();
    });
});
