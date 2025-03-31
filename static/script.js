document.addEventListener("DOMContentLoaded", function () {
    const chatBox = document.getElementById("chat-box");
    const userInput = document.getElementById("user-input");
    const sendBtn = document.getElementById("send-btn");
    const voiceBtn = document.getElementById("voice-btn");
    const stopBtn = document.getElementById("stop-btn");
    const endBtn = document.getElementById("end-btn");

    let recognition;
    let isSpeaking = false;
    let usingVoice = false;
    const synth = window.speechSynthesis;
    let silenceTimeout; // Silence timeout to prevent quick response

    // Append message to chatbox
    function appendMessage(sender, message) {
        const msgDiv = document.createElement("div");
        msgDiv.classList.add(sender === "bot" ? "bot-message" : "user-message");
        msgDiv.innerHTML = message;
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;

        // Voice feedback if using voice
        if (sender === "bot" && usingVoice) {
            speakResponse(message);
        }
    }

    // Send user message
    function sendMessage() {
        const message = userInput.value.trim();
        if (message === "") return;

        appendMessage("user", message);
        userInput.value = "";

        // Send message to Flask server
        fetch("/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: message }),
        })
            .then((response) => response.json())
            .then((data) => {
                appendMessage("bot", data.response);
            })
            .catch((error) => {
                appendMessage("bot", "Error: Unable to get a response.");
                console.error("Error:", error);
            });
    }

    // Voice recognition start
    function startVoiceRecognition() {
        recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.lang = "en-US";

        recognition.onstart = function () {
            isSpeaking = true;
            usingVoice = true;
            voiceBtn.innerText = "Listening...";
        };

        recognition.onresult = function (event) {
            const transcript = event.results[0][0].transcript;
            appendMessage("user", transcript);
            sendVoiceMessage(transcript);
        };

        recognition.onerror = function (event) {
            console.error("Speech recognition error:", event.error);
            isSpeaking = false;
            voiceBtn.innerText = "🎙️ Voice";
        };

        recognition.onend = function () {
            isSpeaking = false;
            voiceBtn.innerText = "🎙️ Voice";
        };

        recognition.start();
    }

    // Send voice message
    function sendVoiceMessage(transcript) {
        fetch("/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: transcript }),
        })
            .then((response) => response.json())
            .then((data) => {
                appendMessage("bot", data.response);
            })
            .catch((error) => {
                appendMessage("bot", "Error: Unable to get a response.");
                console.error("Error:", error);
            });
    }

    // Stop voice recognition
    function stopVoiceRecognition() {
        if (isSpeaking && recognition) {
            recognition.stop();
            isSpeaking = false;
            voiceBtn.innerText = "🎙️ Voice";
        }
    }

    // Text-to-speech for bot response
    function speakResponse(response) {
        if (synth.speaking) {
            synth.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(response);
        utterance.lang = "en-US";
        synth.speak(utterance);
    }

    // End conversation and redirect to feedback
    function endConversation() {
        window.location.href = "/feedback"; // Redirect to feedback page
    }

    // Event listeners
    sendBtn.addEventListener("click", sendMessage);
    userInput.addEventListener("keypress", function (event) {
        if (event.key === "Enter") {
            sendMessage();
        }
    });

    voiceBtn.addEventListener("click", function () {
        if (!isSpeaking) {
            startVoiceRecognition();
        } else {
            stopVoiceRecognition();
        }
    });

    stopBtn.addEventListener("click", stopVoiceRecognition);
    endBtn.addEventListener("click", endConversation);
});
