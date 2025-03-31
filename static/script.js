document.addEventListener("DOMContentLoaded", function () {
    const chatBox = document.getElementById("chat-box");
    const userInput = document.getElementById("user-input");
    const sendBtn = document.getElementById("send-btn");
    const voiceBtn = document.getElementById("voice-btn");
    const stopBtn = document.getElementById("stop-btn");
    const endBtn = document.getElementById("end-btn");

    let synth = window.speechSynthesis;

    // === Speak Button Text on Focus ===
    function speakElementText(element) {
        if ("speechSynthesis" in window) {
            let text = "";

            if (element.id === "send-btn") {
                text = "Send button.";
            } else if (element.id === "voice-btn") {
                text = "Voice button.";
            } else if (element.id === "stop-btn") {
                text = "Stop button.";
            } else if (element.id === "end-btn") {
                text = "End Chat.";
            }

            if (text) {
                let utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = 0.9;
                synth.speak(utterance);
            }
        }
    }

    // === Add Focus Event Listeners to Buttons ===
    sendBtn.addEventListener("focus", () => speakElementText(sendBtn));
    voiceBtn.addEventListener("focus", () => speakElementText(voiceBtn));
    stopBtn.addEventListener("focus", () => speakElementText(stopBtn));
    endBtn.addEventListener("focus", () => speakElementText(endBtn)); // ✅ Added End Chat button here
});
