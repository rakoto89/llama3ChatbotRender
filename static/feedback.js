document.addEventListener("DOMContentLoaded", function () {
  let lastInteractionWasKeyboard = false;

  // Detect if user used Tab (keyboard)
  window.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      lastInteractionWasKeyboard = true;
    }
  });

  // Detect if user used mouse
  window.addEventListener("mousedown", () => {
    lastInteractionWasKeyboard = false;
  });

  // Speak text aloud
  const speak = (text) => {
    window.speechSynthesis.cancel(); // Stop ongoing speech
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  };

  // Get all elements with tabindex="0"
  const tabbableElements = document.querySelectorAll('[tabindex="0"]');

  tabbableElements.forEach((el) => {
    el.addEventListener("focus", () => {
      if (!lastInteractionWasKeyboard) return;

      let text = "";

      if (el.id === "rate-experience") {
        text = "Rate your experience";
      } else if (el.classList.contains("rating-row")) {
        const input = el.querySelector("input[type='radio']");
        const value = input ? input.value : null;

        // Speak "5 stars", "4 stars", etc.
        if (value) {
          text = `${value} star${value === "1" ? "" : "s"}`;
        } else {
          text = "Rating option";
        }
      } else if (el.id === "comments") {
        text = "Write your feedback here";
      } else if (el.id === "send-feedback") {
        text = "Send Feedback";
      } else if (el.id === "return-chatbot") {
        text = "Return to Chatbot";
      } else if (el.id === "skip-feedback") {
        text = "Exit";
      }

      if (text) speak(text);
    });
  });
  // Handle feedback form submission
  document.getElementById("send-feedback").addEventListener("click", function () {
    const rating = document.querySelector('input[name="rating"]:checked'); // Get selected rating
    const feedback = document.getElementById("comments").value; // Get feedback text

    if (rating && feedback) {
      const feedbackData = {
        rating: rating.value,
        feedback: feedback
      };

      fetch("/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(feedbackData)
      })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          // Provide a success message to the user
          alert("Thank you for your feedback!");
        } else {
          alert("There was an error submitting your feedback.");
        }
      })
      .catch((error) => {
        alert("An error occurred. Please try again later.");
      });
    } else {
      alert("Please provide a rating and feedback before submitting.");
    }
  });

  // Redirect Return to Chatbot to APMA
  document.getElementById("return-chatbot").addEventListener("click", function () {
    window.location.href = "https://llama2chatbotrender.onrender.com/";
  });

  // Redirect Exit to MSN
  document.getElementById("skip-feedback").addEventListener("click", function () {
    window.location.href = "https://www.bowiestate.edu";
  });
});
