document.addEventListener("DOMContentLoaded", function () { 
    const chatBox = document.getElementById("chat-box");
    const userInput = document.getElementById("user-input");
    const voiceButton = document.getElementById("voice-button");
    const sendButton = document.getElementById("send-button");

    // Debugging to ensure buttons are found
    console.log(voiceButton, sendButton);

    // Function to append messages to the chatbox
    function appendMessage(sender, text) {
        const messageDiv = document.createElement("div");
        messageDiv.classList.add("chat-message", sender);
        messageDiv.textContent = text;
        chatBox.appendChild(messageDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    // Show typing indicator
    function showTypingIndicator() {
        const typingIndicator = document.createElement("div");
        typingIndicator.classList.add("chat-message", "typing-indicator");
        typingIndicator.textContent = "Chatbot is typing...";
        chatBox.appendChild(typingIndicator);
        chatBox.scrollTop = chatBox.scrollHeight;
        return typingIndicator;
    }

    // Function to simulate the chatbot's response (replace with actual response logic)
    function getChatbotResponse(query) {
        // Here you'd send the query to your backend or chatbot API to get a real response
        return "This is a simulated response to: " + query;
    }

    // Function to handle sending a message
    function sendMessage() {
        const message = userInput.value.trim();
        if (message === "") return;

        appendMessage("user", message);
        userInput.value = "";

        const typingIndicator = showTypingIndicator();

        // Simulating a delay for bot response
        setTimeout(() => {
            chatBox.removeChild(typingIndicator);
            const botResponse = getChatbotResponse(message); // Get the response based on the message
            appendMessage("bot", botResponse);
            speakMessage(botResponse); // Speak the bot's response
        }, 1500);
    }

    // Check if send button exists and add event listener
    if (sendButton) {
        sendButton.addEventListener("click", sendMessage);
    } else {
        console.error("Send button not found.");
    }

    // Event listener for pressing Enter key
    userInput.addEventListener("keypress", function (event) {
        if (event.key === "Enter") {
            sendMessage();
        }
    });

    // Speech recognition for voice input
    if ("webkitSpeechRecognition" in window) {
        const recognition = new webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        recognition.onresult = function (event) {
            const speechText = event.results[0][0].transcript;
            userInput.value = speechText;
            sendMessage();
        };

        recognition.onerror = function (event) {
            console.error("Speech recognition error:", event);
        };

        // Check if voiceButton exists and add event listener
        if (voiceButton) {
            voiceButton.addEventListener("click", function () {
                recognition.start();
            });
        } else {
            console.error("Voice button not found.");
        }
    } else {
        voiceButton.style.display = "none"; // Hide button if speech recognition is unsupported
    }

    // Function to speak the chatbot's response
    function speakMessage(message) {
        const speechSynthesis = window.speechSynthesis;
        const utterance = new SpeechSynthesisUtterance(message);
        speechSynthesis.speak(utterance);
    }
});
