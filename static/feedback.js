document.addEventListener("DOMContentLoaded", function() {
    function speakText(text) {
        const utterance = new SpeechSynthesisUtterance(text);
        speechSynthesis.speak(utterance);
    }

    // Speak when "Rate your experience" is focused
    document.getElementById("rate-experience").addEventListener("focus", function() {
        speakText("Rate your experience");

document.getElementById("rate-experience").addEventListener("focus", function() {
    let rateExperience = this; 
    rateExperience.disabled = true; 
    speakText("Rate your experience");
    setTimeout(() => rateExperience.disabled = false, 700);
    });

    // Speak when tabbing through each star rating row
    document.querySelectorAll(".rating-row").forEach(row => {
        row.addEventListener("focus", function() {
            const ratingValue = row.querySelector("input").value;
            speakText(`${ratingValue} stars`);
        });
    });

    // Speak when "Write your feedback here" textarea is focused
    document.getElementById("comments").addEventListener("focus", function() {
        speakText("Write your feedback here");
    });

    // Speak when tabbing through buttons
    document.getElementById("send-feedback").addEventListener("focus", function() {
        speakText("Send Feedback");
    });

    document.getElementById("return-chatbot").addEventListener("focus", function() {
        speakText("Return to Chatbot");
    });

    document.getElementById("skip-feedback").addEventListener("focus", function() {
        speakText("Exit");
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
