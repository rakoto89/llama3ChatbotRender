document.addEventListener("DOMContentLoaded", function () {
    const chatBox = document.getElementById("chat-box");
    const userInput = document.getElementById("user-input");
    const sendBtn = document.getElementById("send-btn");
    const voiceBtn = document.getElementById("voice-btn");
    const stopBtn = document.getElementById("stop-btn");

    let recognition;
    let isSpeaking = false;
    let synth = window.speechSynthesis;

    function appendMessage(sender, message) {
        const msgDiv = document.createElement("div");
        msgDiv.classList.add(sender === "bot" ? "bot-message" : "user-message");
        msgDiv.innerHTML = message;
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function sendMessage(text, useVoice = false) {
        if (!text.trim()) return;

        appendMessage("user", text);
        userInput.value = "";

        const thinkingMsg = document.createElement("div");
        thinkingMsg.classList.add("bot-message");
        thinkingMsg.textContent = "Thinking...";
        chatBox.appendChild(thinkingMsg);
        chatBox.scrollTop = chatBox.scrollHeight;

        fetch('/ask', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question: text })
        })
        .then(response => response.json())
        .then(data => {
            thinkingMsg.remove();
            if (data.answer) {
                appendMessage("bot", data.answer);
                if (useVoice) speakResponse(data.answer);
            } else {
                appendMessage("bot", "Error: No response from server.");
            }
        })
        .catch(() => {
            thinkingMsg.remove();
            appendMessage("bot", "Error: Could not get a response.");
        });
    }

    function speakResponse(text) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            synth.speak(utterance);
            isSpeaking = true;
            utterance.onend = () => isSpeaking = false;
        }
    }

    function stopSpeaking() {
        if (isSpeaking) {
            synth.cancel();
            isSpeaking = false;
        }
    }

    function handleTabKey(event) {
        if (event.key === "Tab") {
            event.preventDefault();

            const elements = ["user-input", "send-btn", "voice-btn", "stop-btn"];
            let currentElement = document.activeElement;
            let index = elements.indexOf(currentElement?.id);

            if (index === -1) return; // Prevent error if active element is not in the list

            index = (index + 1) % elements.length;
            let nextElement = document.getElementById(elements[index]);
            nextElement.focus();

            setTimeout(() => {
                if ('speechSynthesis' in window) {
                    let text = "";
                    if (nextElement.id === "user-input") text = "Enter your question";
                    else if (nextElement.id === "send-btn") text = "Send";
                    else if (nextElement.id === "voice-btn") text = "Voice";
                    else if (nextElement.id === "stop-btn") text = "Stop";

                    if (text) {
                        let utterance = new SpeechSynthesisUtterance(text);
                        synth.speak(utterance);
                    }
                }
            }, 100);
        }
    }

    // Initialize Speech Recognition only once
    if ("webkitSpeechRecognition" in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        recognition.onstart = () => appendMessage("bot", "Listening...");
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            sendMessage(transcript, true);
        };
        recognition.onerror = () => appendMessage("bot", "Sorry, I couldn't hear you.");
        recognition.onend = () => appendMessage("bot", "Stopped listening.");
    }

    sendBtn.addEventListener("click", () => sendMessage(userInput.value, false));
    userInput.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            sendBtn.click();
        }
    });

    voiceBtn.addEventListener("click", () => {
        if (!recognition) {
            alert("Voice recognition is not supported in this browser.");
            return;
        }
        if (recognition.running) {
            recognition.stop();
        } else {
            recognition.start();
        }
    });

    stopBtn.addEventListener("click", stopSpeaking);
    userInput.addEventListener("keydown", handleTabKey);
});
