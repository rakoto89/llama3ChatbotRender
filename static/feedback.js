document.addEventListener("DOMContentLoaded", function () {
  let lastInteractionWasKeyboard = false;

  // Detect Tab vs Mouse
  window.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      lastInteractionWasKeyboard = true;
    }
  });

  window.addEventListener("mousedown", () => {
    lastInteractionWasKeyboard = false;
  });

  // Speak helper
  const speak = (text) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  };

  // Handle tab navigation speech
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
        text = value ? `${value} star${value === "1" ? "" : "s"}` : "Rating option";
      } else if (el.id === "comments") {
        text = "Write your feedback here";
      } else if (el.id === "send-feedback") {
        text = "Send Feedback";
      } else if (el.id === "return-chatbot") {
        text = "Return to Chatbot";
      } else if (el.id === "skip-feedback") {
        text = "Exit";
      }

      else if (el.id === "thank you") {
        text = "Thank you for your feedback!";
      }
      
      if (text) speak(text);
    });
  });

  // Handle form submission
  document.getElementById("send-feedback").addEventListener("click", function (e) {
    e.preventDefault();

    const rating = document.querySelector('input[name="rate"]:checked');
    const feedback = document.getElementById("comments").value.trim();

    if (!rating || !feedback) {
      alert("Please select a rating and write your feedback.");
      return;
    }

    const formData = new FormData();
    formData.append("rate", rating.value);
    formData.append("feedback", feedback);

    fetch("/feedback", {
      method: "POST",
      body: formData
    })
      .then((response) => {
        if (response.ok) {
          // Hide form & text
          document.getElementById("feedback-form").style.display = "none";
          document.getElementById("rate-experience").style.display = "none";
          document.getElementById("rate-description").style.display = "none";

          // Show thank-you message
          document.getElementById("success-message").style.display = "block";

          // Confetti burst
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 }
          });
        } else {
          alert("There was an error submitting your feedback.");
        }
      })
      .catch(() => {
        alert("An error occurred. Please try again later.");
      });
  });

  // Redirect buttons
  document.getElementById("return-chatbot").addEventListener("click", function () {
    window.location.href = "https://llama2chatbotrender.onrender.com/";
  });

  document.getElementById("skip-feedback").addEventListener("click", function () {
    window.location.href = "https://www.bowiestate.edu";
  });
});
