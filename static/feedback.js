document.addEventListener("DOMContentLoaded", function() {
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
        window.location.href = "/";  // Redirect to the chatbot (index route)
    });

    // Skip Feedback & Redirect
    document.getElementById("skip-feedback").addEventListener("click", function() {
        window.location.href = "/";  // Redirect to the chatbot (index route)
    });

    // Send Feedback Button (Optional for clarity, since it submits the form)
    document.getElementById("send-feedback")?.addEventListener("click", function() {
        document.getElementById("feedback-form").submit();  // Trigger the form submission manually if needed
    });
});
