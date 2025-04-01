document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("feedback-form");
    const successMessage = document.getElementById("success-message");
    const returnChatbotButton = document.getElementById("return-chatbot");
    const skipFeedbackButton = document.getElementById("skip-feedback");

    let selectedRating = 0; // Default rating

    // Capture rating selection
    document.querySelectorAll("input[name='rate']").forEach(radio => {
        radio.addEventListener("change", function () {
            selectedRating = this.value;
        });
    });

    // Handle form submission
    if (form) {
        form.onsubmit = function (event) {
            event.preventDefault();

            const formData = new FormData(form);

            fetch("/feedback", {
                method: "POST",
                body: formData
            })
            .then(response => response.text())
            .then(data => {
                successMessage.style.display = "block";
                form.reset();
            })
            .catch(error => {
                console.error("Submission failed:", error);
            });
        };
    }

    // Redirect to chatbot
    if (returnChatbotButton) {
        returnChatbotButton.onclick = function () {
            window.location.href = "/chatbot";
        };
    }

    // Skip feedback and go to chatbot
    if (skipFeedbackButton) {
        skipFeedbackButton.onclick = function () {
            window.location.href = "/chatbot";
        };
    }
});
