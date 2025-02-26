document.addEventListener("DOMContentLoaded", function () {
    const chatBox = document.getElementById("chat-box");
    const userInput = document.getElementById("user-input");
    const sendBtn = document.getElementById("send-btn");
    const voiceBtn = document.getElementById("voice-btn");
    const stopBtn = document.getElementById("stop-btn");

    let recognition;
    let isSpeaking = false;
    const synth = window.speechSynthesis;

    function appendMessage(sender, message) {
        const msgDiv = document.createElement("div");
        msgDiv.classList.add(sender === "bot" ? "bot-message" : "user-message");
        msgDiv.textContent = message;
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function sendMessage(text, useVoice = false) {
        if (!text.trim()) return;

        // Prevent duplicate user messages
        if (document.querySelector(".user-message:last-child")?.textContent === text) return;

        appendMessage("user", text);
        userInput.value = "";

        // Show "Thinking..." message
        const thinkingMsg = document.createElement("div");
        thinkingMsg.classList.add("bot-message");
        thinkingMsg.textContent = "Thinking...";
        chatBox.appendChild(thinkingMsg);
        chatBox.scrollTop = chatBox.scrollHeight;

        // Send request to Flask backend
        fetch("/ask", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ question: text }),
        })
        .then(response => response.json())
        .then(data => {
            chatBox.removeChild(thinkingMsg);
            appendMessage("bot", data.answer);
            
            if (useVoice) {
                speakResponse(data.answer);
            }
        })
        .catch(error => {
            chatBox.removeChild(thinkingMsg);
            appendMessage("bot", "Error: Could not get a response.");
        });
    }

    function speakResponse(text) {
        if ("speechSynthesis" in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            synth.speak(utterance);
            isSpeaking = true;
            utterance.onend = () => { isSpeaking = false; };
        }
    }

    function stopSpeaking() {
        if (isSpeaking) {
            synth.cancel();
            isSpeaking = false;
        }
    }

    sendBtn.addEventListener("click", () => {
        sendMessage(userInput.value, false); // No voice when clicking Send
    });

    userInput.addEventListener("keypress", function (event) {
        if (event.key === "Enter") {
            sendMessage(userInput.value, false); // No voice when pressing Enter
        }
    });

    voiceBtn.addEventListener("click", () => {
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
                
                // Prevent duplicate user messages
                if (document.querySelector(".user-message:last-child")?.textContent === transcript) return;

                appendMessage("user", transcript);
                sendMessage(transcript, true); // Voice response when using Voice button
            };

            recognition.onerror = () => {
                appendMessage("bot", "Sorry, I couldn't hear you. Please try again.");
            };

            recognition.start();
        } else {
            alert("Voice recognition is not supported in this browser.");
        }
    });

    stopBtn.addEventListener("click", stopSpeaking);
});
