let finalTranscript = "";

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
        if (!isMuted) beep.play();
    };

    recognition.onresult = (event) => {
        let interimTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript + " ";
            } else {
                interimTranscript += transcript;
            }
        }
    };

    recognition.onerror = (event) => {
        console.error("Recognition error:", event.error);
    };

    recognition.onend = () => {
        if (usingVoice) {
            // Auto-restart unless user stopped it
            recognition.start();
        }
    };

    recognition.start();
}

voiceBtn.addEventListener("click", () => {
    if (usingVoice) {
        // Stop listening, now send the message
        usingVoice = false;
        recognition.stop();

        if (finalTranscript.trim()) {
            appendMessage("user", finalTranscript.trim());
            sendMessage(finalTranscript.trim());
        }
        finalTranscript = "";
    } else {
        // Start listening
        usingVoice = true;
        appendMessage("bot", languageData[currentLanguage].listeningMessage);
        startContinuousRecognition();
    }
});
