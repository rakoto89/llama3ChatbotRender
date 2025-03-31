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

    function appendMessage(sender, message) {
        const msgDiv = document.createElement("div");
        msgDiv.classList.add(sender === "bot" ? "bot-message" : "user-message");
        msgDiv.innerHTML = message;
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
        
        if (sender === "bot" && usingVoice && message === "Listening...") {
            speakResponse(message, () => {
                playBeep(); // Play beep after saying "Listening..."
                startVoiceRecognition();
            });
        }
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

        if (useVoice) speakResponse("Thinking...");

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

    function speakResponse(text, callback) {
        if ("speechSynthesis" in window) {
            const cleanText = text.replace(/<br\s*\/?>/g, " "); // Replaces <br> with space

            if (cleanText.trim() === "") return;

            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.onend = () => {
                isSpeaking = false;
                if (callback) callback();
            };
            synth.speak(utterance);
            isSpeaking = true;
        }
    }

    function stopSpeaking() {
        if (isSpeaking) {
            synth.cancel();
            isSpeaking = false;
        }
    }

    function playBeep() {
        const beep = new Audio("/static/beep2.mp3"); 
        beep.play();
    }

    function speakElementText(element) {
        if ("speechSynthesis" in window) {
            let text = element.getAttribute("data-speak") || "";

            if (text) {
                let utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = 0.9;
                synth.speak(utterance);
            }
        }
    }

    voiceBtn.addEventListener("click", () => {
        usingVoice = true;
        appendMessage("bot", "Listening...");
    });

    stopBtn.addEventListener("click", stopSpeaking);

    sendBtn.addEventListener("click", () => {
        sendBtn.disabled = true;
        sendMessage(userInput.value, false);
        setTimeout(() => sendBtn.disabled = false, 700);
    });

    endBtn.addEventListener("click", () => {
        openFeedbackPage();
    });

    // ⭐️ Opens Feedback Page
    function openFeedbackPage() {
        const feedbackHTML = `
        <div id="feedback-container" tabindex="0" data-speak="Please rate your chat experience.">
            <h2>Rate Your Chat Experience</h2>

            <div id="rating-container">
                ${[1, 2, 3, 4, 5].map(num => `
                    <div class="rating-row" tabindex="0" data-rating="${num}" data-speak="${num} star${num > 1 ? 's' : ''}.">
                        ${Array(num).fill().map(() => '⭐').join('')}
                        ${Array(5 - num).fill().map(() => '☆').join('')}
                    </div>
                `).join('')}
            </div>

            <h3 id="feedback-label" tabindex="0" data-speak="Please provide feedback.">Please provide feedback</h3>
            <textarea id="feedback-text" rows="4" cols="50" placeholder="Enter any additional feedback..." tabindex="0" data-speak="Feedback text area."></textarea>

            <button id="submit-feedback-btn" tabindex="0" data-speak="Submit feedback.">Submit Feedback</button>
            <button id="go-back-btn" tabindex="0" data-speak="Go back to chatbot.">Go Back to Chatbot</button>
            <button id="skip-feedback-btn" tabindex="0" data-speak="Skip feedback.">Skip Feedback</button>
        </div>
        `;

        document.body.innerHTML = feedbackHTML;

        // Tab and Speak Functionality for New Elements
        addTabAndSpeakListeners();

        // Handle feedback submission
        document.getElementById("submit-feedback-btn").addEventListener("click", () => {
            alert("Thank you for your feedback!");
            window.location.href = "/"; // Return to chatbot
        });

        // Go back to chatbot
        document.getElementById("go-back-btn").addEventListener("click", () => {
            window.location.href = "/"; // Return to chatbot
        });

        // Skip feedback
        document.getElementById("skip-feedback-btn").addEventListener("click", () => {
            window.location.href = "/"; // Skip feedback
        });
    }

    function addTabAndSpeakListeners() {
        const focusableElements = document.querySelectorAll("[tabindex]");
        focusableElements.forEach(element => {
            element.addEventListener("focus", () => speakElementText(element));
        });

        // Tab navigation to read elements out loud
        document.addEventListener("keydown", function (event) {
            if (event.key === "Tab") {
                setTimeout(() => {
                    const focusedElement = document.activeElement;
                    if (focusedElement) {
                        speakElementText(focusedElement);
                    }
                }, 100);
            }
        });
    }
});
