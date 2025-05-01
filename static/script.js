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
    let isMuted = localStorage.getItem("isMuted") === "true";  // Track mute state
    let isBotSpeaking = false;
    let finalTranscript = "";
    let lastSpokenText = "";
    let currentUtterance = null;
    let isPaused = false;

    const languageData = {
        // Same languageData as before
    };

    // Function to update the volume toggle based on mute state
    function updateMuteState() {
        const volumeToggle = document.getElementById("volume-toggle");
        const volumeIcon = document.getElementById("volume-icon");

        if (volumeToggle && volumeIcon) {
            volumeToggle.title = isMuted
                ? languageData[currentLanguage].titles.unmute
                : languageData[currentLanguage].titles.mute;
            volumeIcon.src = isMuted ? "/static/images/mute.png" : "/static/images/volume.png";
        }
    }

    // Function to speak text if it's not muted
    function speakText(text, callback) {
        if (!text.trim() || isMuted) return;
        synth.cancel();
        lastSpokenText = text;
        currentUtterance = new SpeechSynthesisUtterance(text);
        currentUtterance.lang = currentLanguage;
        isBotSpeaking = true;
        currentUtterance.onend = () => {
            isBotSpeaking = false;
            currentUtterance = null;
            isPaused = false;
            playPauseIcon.src = "/static/images/pause.png";
            playPauseBtn.title = languageData[currentLanguage].titles.pause;
        };
        synth.speak(currentUtterance);
        playPauseIcon.src = "/static/images/pause.png";
        playPauseBtn.title = languageData[currentLanguage].titles.pause;
    }

    // Event listener for mute toggle
    const volumeToggle = document.getElementById("volume-toggle");
    if (volumeToggle) {
        volumeToggle.addEventListener("click", () => {
            isMuted = !isMuted;
            localStorage.setItem("isMuted", isMuted.toString()); // Save mute state
            updateMuteState();  // Update mute state on page
            if (synth.speaking) synth.cancel();
        });
    }

    // Listen for changes in localStorage (e.g., mute state changes from other pages)
    window.addEventListener('storage', (event) => {
        if (event.key === "isMuted") {
            isMuted = event.newValue === "true";
            updateMuteState();  // Update mute state on page
        }
    });

    // Update language, bot message, and other UI elements
    document.querySelector(".chat-header").textContent = languageData[currentLanguage].chatbotTitle;
    userInput.placeholder = languageData[currentLanguage].placeholder;
    document.querySelector(".bot-message").textContent = languageData[currentLanguage].botMessage;

    // Example of sending a message when the user clicks the send button
    sendBtn.addEventListener("click", () => {
        usingVoice = false;
        sendMessage(userInput.value);
    });

    // Initialize the page with mute state
    updateMuteState();

    // Speak welcome message on page load (if not muted)
    const welcomeText = languageData[currentLanguage].botMessage;
    speakText(welcomeText);
});
