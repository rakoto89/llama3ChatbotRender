document.addEventListener("DOMContentLoaded", function () {
    let recognition;
    let synth = window.speechSynthesis;

    // Function to speak text
    function speakText(text) {
        if (synth.speaking) {
            synth.cancel(); // Stop ongoing speech before speaking a new one
        }
        let utterance = new SpeechSynthesisUtterance(text);
        synth.speak(utterance);
    }

    // Check if the browser supports Speech Recognition
    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        // Capture the recognized speech and insert into the input field
        recognition.onresult = function (event) {
            document.getElementById('questionInput').value = event.results[0][0].transcript;
        };

        recognition.onerror = function (event) {
            console.error('Speech recognition error:', event.error);
        };
    } else {
        alert("Your browser does not support speech recognition.");
    }

    // Elements to speak when focused
    const elementsToSpeak = {
        questionInput: "Enter your question",
        startVoice: "Send Voice",
        stopVoice: "Stop"
    };

    // Add focus event listener for tab navigation
    Object.keys(elementsToSpeak).forEach(id => {
        document.getElementById(id).addEventListener('focus', function () {
            speakText(elementsToSpeak[id]);
        });
    });

    // Ensure clicking the input field or buttons does NOT trigger speech
    Object.keys(elementsToSpeak).forEach(id => {
        document.getElementById(id).addEventListener('click', function (event) {
            event.stopPropagation(); // Prevent unintended speech
        });
    });

    // Start voice recognition when "Send Voice" button is clicked
    document.getElementById('startVoice').addEventListener('click', function () {
        if (recognition) {
            recognition.start();
        }
    });

    // Stop voice recognition when "Stop" button is clicked
    document.getElementById('stopVoice').addEventListener('click', function () {
        if (recognition) {
            recognition.stop();
        }
    });
});

