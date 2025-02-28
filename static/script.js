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
            appendMessage("bot", data.answer);
            if (useVoice) speakResponse(data.answer);
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
            event.preventDefault(); // Prevent default tab behavior

            const elements = ["user-input", "send-btn", "voice-btn", "stop-btn"];
            let currentElement = document.activeElement;
            let index = elements.indexOf(currentElement.id);

            // Move to the next element in the array
            index = (index + 1) % elements.length;
            let nextElement = document.getElementById(elements[index]);
            nextElement.focus();

            // Speak the element's label
            setTimeout(() => {
                if ('speechSynthesis' in window) {
                    let text = nextElement.getAttribute("aria-label") || nextElement.placeholder;
                    if (text) {
                        let utterance = new SpeechSynthesisUtterance(text);
                        synth.speak(utterance);
                    }
                }
            }, 100); // Adding a slight delay to ensure focus
        }
    }

    // Event Listeners
    sendBtn.addEventListener("click", () => sendMessage(userInput.value, false));
    userInput.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            sendBtn.click();
        }
    });

    voiceBtn.addEventListener("click", () => {
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
            recognition.start();
        } else {
            alert("Voice recognition is not supported in this browser.");
        }
    });

    stopBtn.addEventListener("click", stopSpeaking);
    userInput.addEventListener("keydown", handleTabKey);
});
