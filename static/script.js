document.addEventListener("DOMContentLoaded", function () { 
    const chatBox = document.getElementById("chat-box");
    const userInput = document.getElementById("user-input");
    const sendBtn = document.getElementById("send-btn");
    const voiceBtn = document.getElementById("voice-btn");
    const stopBtn = document.getElementById("stop-btn");

    let recognition;
    let isSpeaking = false;
    let usingVoice = false;
    const synth = window.speechSynthesis;

    function appendMessage(sender, message, hideFromChat = false) {
        if (hideFromChat) return; // Prevent "Listening..." from appearing in chat

        const msgDiv = document.createElement("div");
        msgDiv.classList.add(sender === "bot" ? "bot-message" : "user-message");
        msgDiv.innerHTML = message;
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function removePreviousThinkingMessage() {
        const lastThinkingMessage = document.querySelector(".bot-message:last-child");
        if (lastThinkingMessage && lastThinkingMessage.textContent === "Thinking...") {
            lastThinkingMessage.remove();
        }
    }

    function sendMessage(text, useVoice = false) {
        if (!text.trim()) return;

        appendMessage("user", text);
        userInput.value = "";

        removePreviousThinkingMessage();
        const thinkingMsg = document.createElement("div");
        thinkingMsg.classList.add("bot-message");
        thinkingMsg.textContent = "Thinking...";
        chatBox.appendChild(thinkingMsg);
        chatBox.scrollTop = chatBox.scrollHeight;

        fetch("/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question: text }),
        })
        .then(response => response.json())
        .then(data => {
            removePreviousThinkingMessage();
            appendMessage("bot", data.answer);
            if (useVoice) speakResponse(data.answer);
        })
        .catch(() => {
            removePreviousThinkingMessage();
            appendMessage("bot", "Error: Could not get a response.");
        });
    }

    function speakResponse(text) {
        if ("speechSynthesis" in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            isSpeaking = true;
            synth.speak(utterance);
            utterance.onend = () => { isSpeaking = false; };
        }
    }

    function stopSpeaking() {
        if (isSpeaking) {
            synth.cancel();
            isSpeaking = false;
        }
    }

    function startVoiceRecognition() {
        if (!("webkitSpeechRecognition" in window)) {
            alert("Voice recognition is not supported in this browser.");
            return;
        }

        recognition = new webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        usingVoice = true;
        appendMessage("bot", "Listening...", true); // Hide from chat

        /*** Ensure bot does not hear itself ***/
        setTimeout(() => {
            recognition.start();
        }, 1000); // Delay recognition slightly

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript.trim();

            // Block the bot from hearing "Listening" or any similar phrase
            if (transcript.toLowerCase().includes("listening")) {
                console.warn("Ignored 'Listening...' to prevent self-loop.");
                return;
            }

            sendMessage(transcript, true);
            usingVoice = false;
        };

        recognition.onerror = () => {
            appendMessage("bot", "Sorry, I couldn't hear you. Please try again.");
            usingVoice = false;
        };
    }

    voiceBtn.addEventListener("click", startVoiceRecognition);
    stopBtn.addEventListener("click", stopSpeaking);

    sendBtn.addEventListener("click", () => {
        sendBtn.disabled = true;
        sendMessage(userInput.value, false);
        setTimeout(() => sendBtn.disabled = false, 500);
    });

    userInput.addEventListener("keypress", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            sendBtn.click();
        }
    });

});
