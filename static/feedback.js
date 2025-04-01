document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("feedback-form");
  const successMessage = document.getElementById("success-message");

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

  // Redirect to chatbot
  document.getElementById("return-chatbot").onclick = function () {
    window.location.href = "/chatbot"; // Replace with your actual chatbot route
  };

  // Skip feedback and go to chatbot
  document.getElementById("skip-feedback").onclick = function () {
    window.location.href = "/chatbot"; // Or a different skip route if needed
  };
});
