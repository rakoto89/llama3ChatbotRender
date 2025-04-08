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
    }

    sendBtn.addEventListener("click", function () {
        const message = userInput.value.trim();
        if (message) {
            appendMessage("user", message);
            userInput.value = '';
        }
    });

    voiceBtn.addEventListener("click", function () {
        if (!isSpeaking) {
            startVoiceRecognition();
        } else {
            stopVoiceRecognition();
        }
    });

    function startVoiceRecognition() {
        recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.start();

        recognition.onresult = function (event) {
            const userSpeech = event.results[0][0].transcript;
            userInput.value = userSpeech;
            appendMessage("user", userSpeech);
        };
    }

    function stopVoiceRecognition() {
        if (recognition) {
            recognition.stop();
        }
    }
});
