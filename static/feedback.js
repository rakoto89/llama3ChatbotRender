document.addEventListener("DOMContentLoaded", function() {
    function speakText(text) {
        const utterance = new SpeechSynthesisUtterance(text);
        speechSynthesis.speak(utterance);
    }

    function handleTabFocus(event, text) {
        if (event.key === "Tab") {
            speakText(text);
        }
    }

    function preventClickSpeech(event) {
        event.stopPropagation(); // Stops the click event from triggering speech
    }

    // Elements that should speak only when tabbed to
    const elementsWithSpeech = {
        "rate-experience": "Rate your experience",
        "comments": "Write your feedback here",
        "send-feedback": "Send Feedback",
        "return-chatbot": "Return to Chatbot",
        "skip-feedback": "Exit"
    };

    // Add keydown event (for Tab navigation) and click event (to prevent speech)
    Object.keys(elementsWithSpeech).forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener("keydown", function(event) {
                handleTabFocus(event, elementsWithSpeech[id]);
            });
            element.addEventListener("click", preventClickSpeech);
        }
    });

    // Special case: Star rating rows
    document.querySelectorAll(".rating-row").forEach(row => {
        row.addEventListener("keydown", function(event) {
            if (event.key === "Tab") {
                const ratingValue = row.querySelector("input").value;
                speakText(`${ratingValue} stars`);
            }
        });
        row.addEventListener("click", preventClickSpeech);
    });

    // Handle Feedback Form Submission
    document.getElementById("feedback-form").onsubmit = function(event) {
        event.preventDefault();

        const selectedRating = document.querySelector('input[name="rate"]:checked');
        if (!selectedRating) {
            alert("Please select a rating before submitting.");
            return;
        }

        const ratingValue = selectedRating.value;
        const comments = document.getElementById("comments").value;

        const formData = new FormData();
        formData.append("rate", ratingValue);
        formData.append("comments", comments);

        fetch("/feedback", {
            method: "POST",
            body: formData
        })
        .then(response => response.text())
        .then(data => {
            document.getElementById("success-message").style.display = "block";
            document.getElementById("feedback-form").reset();
        })
        .catch(error => console.error("Error:", error));
    };

    // Return to Chatbot Page
    document.getElementById("return-chatbot").addEventListener("click", function() {
        window.location.href = "https://llama2chatbotrender.onrender.com/";
    });

    // Skip Feedback & Redirect
    document.getElementById("skip-feedback").addEventListener("click", function() {
        window.location.href = "https://www.bowiestate.edu/";
    });
});
