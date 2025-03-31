document.addEventListener("DOMContentLoaded", function () {
    const chatBox = document.getElementById("chat-box");
    const userInput = document.getElementById("user-input");
    const sendBtn = document.getElementById("send-btn");
    const voiceBtn = document.getElementById("voice-btn");
    const stopBtn = document.getElementById("stop-btn");
    const endBtn = document.getElementById("end-btn");

    const feedbackContainer = document.getElementById("feedback-container");
    const chatContainer = document.getElementById("chat-container");
    const thankYouContainer = document.getElementById("thank-you-container");
    const thankYouMessage = document.getElementById("thank-you-message");
    const goBackBtn = document.getElementById("go-back-btn");
    const skipFeedbackBtn = document.getElementById("skip-feedback-btn");
    const submitFeedbackBtn = document.getElementById("submit-feedback-btn");
    let selectedRating = 0;
    let recognition;
    let isSpeaking = false;

    // === Send Button Functionality ===
    sendBtn.addEventListener("click", function () {
        const message = userInput.value.trim();
        if (message !== "") {
            appendMessage("user", message);
            simulateBotResponse(message);
            userInput.value = "";
        }
    });

    // === Voice Button Functionality ===
    voiceBtn.addEventListener("click", function () {
        if (!isSpeaking) {
            startVoiceRecognition();
        }
    });

    // === Stop Button Functionality ===
    stopBtn.addEventListener("click", function () {
        if (isSpeaking) {
            stopVoiceRecognition();
        }
    });

    // === End Chat Button Functionality ===
    endBtn.addEventListener("click", function () {
        chatContainer.classList.add("hidden");
        feedbackContainer.classList.remove("hidden");
    });

    // === Feedback Section Button Functionalities ===
    submitFeedbackBtn.addEventListener("click", function () {
        thankYouMessage.innerHTML = `Thank you for using the chatbot and giving your feedback!`;
        feedbackContainer.classList.add("hidden");
        thankYouContainer.classList.remove("hidden");
    });

    goBackBtn.addEventListener("click", function () {
        feedbackContainer.classList.add("hidden");
        chatContainer.classList.remove("hidden");
    });

    skipFeedbackBtn.addEventListener("click", function () {
        thankYouMessage.innerHTML = `Thank you for using the chatbot!`;
        feedbackContainer.classList.add("hidden");
        thankYouContainer.classList.remove("hidden");
    });

    // === Handle Star Rating ===
    document.querySelectorAll("#stars span").forEach(star => {
        star.addEventListener("click", function () {
            selectedRating = this.dataset.value;
            document.querySelectorAll("#stars span").forEach(s => s.style.color = "#ccc");
            this.style.color = "orange";
        });
    });

    // === Append User and Bot Messages ===
    function appendMessage(sender, message) {
        const msgDiv = document.createElement("div");
        msgDiv.classList.add(sender === "bot" ? "bot-message" : "user-message");
        msgDiv.innerHTML = message;
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    // === Simulate Bot Response ===
    function simulateBotResponse(userMessage) {
        const botResponse = `I'm here to provide opioid information. You asked: "${userMessage}".`;
        setTimeout(() => {
            appendMessage("bot", botResponse);
        }, 1000);
    }

    // === Voice Recognition (Speech-to-Text) ===
    function startVoiceRecognition() {
        recognition = new webkitSpeechRecognition() || new SpeechRecognition();
        recognition.lang = "en-US";
        recognition.interimResults = false;
        recognition.onstart = () => {
            isSpeaking = true;
        };
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            userInput.value = transcript;
            appendMessage("user", transcript);
            simulateBotResponse(transcript);
        };
        recognition.onerror = (event) => {
            console.error("Voice recognition error:", event.error);
        };
        recognition.onend = () => {
            isSpeaking = false;
        };
        recognition.start();
    }

    // === Stop Voice Recognition ===
    function stopVoiceRecognition() {
        if (recognition) {
            recognition.stop();
            isSpeaking = false;
        }
    }

    // === Tab Accessibility: Announce Button Names ===
    document.querySelectorAll("button").forEach(button => {
        button.addEventListener("focus", function () {
            const label = this.getAttribute("aria-label");
            if (label) {
                speak(label);
            }
        });
    });

    // === Speak Function for Screen Readers ===
    function speak(text) {
        const synth = window.speechSynthesis;
        const utterance = new SpeechSynthesisUtterance(text);
        synth.speak(utterance);
    }
});
