document.addEventListener("DOMContentLoaded", function () {
    const chatBox = document.getElementById("chat-box");
    const userInput = document.getElementById("user-input");
    const sendBtn = document.getElementById("send-btn");
    const voiceBtn = document.getElementById("voice-btn");
    const stopBtn = document.getElementById("stop-speaking-btn");
    const pausePlayBtn = document.getElementById("pause-play-btn");
    const beep = document.getElementById("beep");
    const pausePlayIcon = document.getElementById("pause-play-icon");

    let recognition;
    let usingVoice = false;
    const synth = window.speechSynthesis;
    let currentLanguage = localStorage.getItem("selectedLanguage") || 'en';
    let isMuted = localStorage.getItem("isMuted") === "true";
    let isBotSpeaking = false;
    let finalTranscript = "";
    let utteranceQueue = [];

    function appendMessage(sender, message) {
        const msgDiv = document.createElement("div");
        msgDiv.classList.add(sender === "bot" ? "bot-message" : "user-message");
        msgDiv.innerHTML = message;
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;

        if (sender === "bot") speakText(message);
    }

    function speakText(text, callback) {
        if (!text.trim() || isMuted) return;

        if (synth.speaking || isBotSpeaking) {
            utteranceQueue.push({ text, callback });
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = currentLanguage;
        isBotSpeaking = true;

        utterance.onend = () => {
            isBotSpeaking = false;
            if (callback) callback();
            if (utteranceQueue.length > 0) {
                const nextUtterance = utteranceQueue.shift();
                speakText(nextUtterance.text, nextUtterance.callback);
            }
        };

        synth.speak(utterance);
    }

    function sendMessage(text) {
        if (!text.trim()) return;
        appendMessage("user", text);
        userInput.value = "";
        appendMessage("bot", "Thinking...");

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

    function startContinuousRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            appendMessage("bot", "Voice recognition not supported.");
            return;
        }

        recognition = new SpeechRecognition();
        recognition.lang = currentLanguage;
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onstart = () => {
            finalTranscript = "";
        };

        recognition.onresult = (event) => {
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + " ";
                }
            }
        };

        recognition.onerror = (event) => {
            console.error("Recognition error:", event.error);
        };

        recognition.onend = () => {
            if (usingVoice && !recognition.aborted) {
                recognition.start();
            }
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
        if (usingVoice) {
            usingVoice = false;
            voiceBtn.classList.remove("voice-active");

            if (synth.speaking || isBotSpeaking) {
                synth.cancel();
                isBotSpeaking = false;
            }

            if (recognition) {
                recognition.abort();
            }

            const botMessages = document.querySelectorAll(".bot-message");
            botMessages.forEach(msg => {
                if (
                    msg.textContent === "Listening..." ||
                    msg.textContent === "Thinking..."
                ) {
                    msg.remove();
                }
            });

            if (finalTranscript.trim()) {
                userInput.value = finalTranscript.trim();
            }

            finalTranscript = "";
        } else {
            if (synth.speaking || isBotSpeaking) {
                synth.cancel();
                isBotSpeaking = false;
            }

            usingVoice = true;
            finalTranscript = "";

            appendMessage("bot", "Listening...");
            startContinuousRecognition();
        }
    });

    pausePlayBtn.addEventListener("click", () => {
        if (synth.speaking || isBotSpeaking) {
            if (pausePlayIcon.src.includes("pause.png")) {
                // Pause the speech synthesis
                synth.pause();
                pausePlayIcon.src = "/static/images/play.png";
                pausePlayBtn.title = "Play";
            } else {
                // Resume speech synthesis
                synth.resume();
                pausePlayIcon.src = "/static/images/pause.png";
                pausePlayBtn.title = "Pause";
            }
        } else {
            // Start speech again from the beginning (or repeat last message)
            const lastBotMessage = document.querySelector(".bot-message:last-child");
            if (lastBotMessage) {
                speakText(lastBotMessage.textContent);
                pausePlayIcon.src = "/static/images/pause.png";
                pausePlayBtn.title = "Pause";
            }
        }
    });

    stopBtn.addEventListener("click", () => {
        if (synth.speaking || isBotSpeaking) {
            synth.cancel();
            isBotSpeaking = false;
        }

        if (recognition && usingVoice) {
            recognition.abort();
            usingVoice = false;
        }

        const botMessages = document.querySelectorAll(".bot-message");
        botMessages.forEach(msg => {
            if (msg.textContent === "Listening..." || msg.textContent === "Thinking...") {
                msg.remove();
            }
        });

        userInput.value = "";
        finalTranscript = "";
        voiceBtn.classList.remove("voice-active");
    });

    const volumeToggle = document.getElementById("volume-toggle");
    const volumeIcon = document.getElementById("volume-icon");

    volumeToggle.addEventListener("click", () => {
        isMuted = !isMuted;
        localStorage.setItem("isMuted", isMuted.toString());
        volumeIcon.src = isMuted ? "/static/images/mute.png" : "/static/images/volume.png";
        volumeToggle.title = isMuted ? "Unmute" : "Mute";
    });
});
