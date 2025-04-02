document.addEventListener("DOMContentLoaded", function() { 
    function speak(text) {
        const utterance = new SpeechSynthesisUtterance(text);
        speechSynthesis.speak(utterance);
    }

    // Speak when tabbing to "Rate your experience" heading
    document.getElementById("rate-experience").addEventListener("focus", function() {
        speak("Rate your experience");
    });

    // Speak when tabbing to each star rating
    document.querySelectorAll('input[name="emoji-rating"]').forEach(function(radio) {
        radio.addEventListener("focus", function() {
            speak("first row 5 stars second row 4 stars third row 3 stars fourth row 2 stars fifth row 1 star");
        });
    });

    // Speak when tabbing to the feedback textarea
    document.getElementById("comments").addEventListener("focus", function() {
        speak("Write your feedback here");
    });

    // Speak when tabbing to "Send Feedback"
    document.getElementById("send-feedback").addEventListener("focus", function() {
        speak("Send Feedback");
    });

    // Speak when tabbing to "Return to Chatbot"
    document.getElementById("return-chatbot").addEventListener("focus", function() {
        speak("Return to Chatbot");
    });

    // Speak when tabbing to "Exit"
    document.getElementById("skip-feedback").addEventListener("focus", function() {
        speak("Exit");
    });

    // Handle Feedback Form Submission
    document.getElementById("feedback-form").onsubmit = function(event) {
        event.preventDefault();

        // Get selected rating
        const selectedRating = document.querySelector('input[name="rate"]:checked');
        if (!selectedRating) {
            alert("Please select a rating before submitting.");
            return;
        }

        // Get rating value and comments
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
            document.getElementById("feedback-form").reset(); // Reset form after submission
        })
        .catch(error => console.error("Error:", error));
    };

    // Return to Chatbot Page
    document.getElementById("return-chatbot").addEventListener("click", function() {
        window.location.href = "https://llama2chatbotrender.onrender.com/";  // Keep your original URL
    });

    // Skip Feedback & Redirect
    document.getElementById("skip-feedback").addEventListener("click", function() {
        window.location.href = "https://www.bowiestate.edu/";  // Keep your original URL
    });

    // Optional: Fix for "Send Feedback" button if needed
    document.getElementById("send-feedback").addEventListener("click", function() {
        document.getElementById("feedback-form").submit();  // Trigger the form submission manually if needed
    });
});
