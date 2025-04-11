document.addEventListener("DOMContentLoaded", function () {
  let lastInteractionWasKeyboard = false;

  let currentLanguage = localStorage.getItem("selectedLanguage") || "en";

  const translations = {
    en: {
      title: "Rate your experience",
      description: "We highly value your feedback! Rate your experience and provide us with your valuable feedback.",
      feedbackPlaceholder: "Write your feedback here...",
      submitAlt: "Submit Feedback",
      success: "Thank you for your feedback!",
      exit: "Exit",
      ratingLabels: ["Terrible", "Bad", "Okay", "Good", "Amazing"]
    },
    es: {
      title: "Califica tu experiencia",
      description: "¡Valoramos mucho tus comentarios! Califica tu experiencia y proporciónanos tus valiosos comentarios.",
      feedbackPlaceholder: "Escribe tus comentarios aquí...",
      submitAlt: "Enviar comentarios",
      success: "¡Gracias por tus comentarios!",
      exit: "Salir",
      ratingLabels: ["Terrible", "Malo", "Regular", "Bueno", "Increíble"]
    },
    fr: {
      title: "Évaluez votre expérience",
      description: "Nous apprécions beaucoup vos commentaires ! Évaluez votre expérience et fournissez-nous vos précieux retours.",
      feedbackPlaceholder: "Écrivez vos commentaires ici...",
      submitAlt: "Soumettre des commentaires",
      success: "Merci pour vos commentaires !",
      exit: "Sortie",
      ratingLabels: ["Terrible", "Mauvais", "Moyen", "Bon", "Incroyable"]
    },
    zh: {
      title: "评价您的体验",
      description: "我们非常重视您的反馈！请评价您的体验并提供宝贵意见。",
      feedbackPlaceholder: "请在此写下您的反馈...",
      submitAlt: "提交反馈",
      success: "感谢您的反馈！",
      exit: "退出",
      ratingLabels: ["糟糕", "差", "一般", "好", "非常好"]
    }
  };

  function updateSubmitImage(lang) {
    const img = document.getElementById("submit-img");
    const imgMap = {
      en: "Send_Feedback.png",
      es: "Enviar_Comentarios.png",
      fr: "Soumettre.png",
      zh: "提交反馈.png"
    };
    if (img && imgMap[lang]) {
      img.src = `/static/images/${imgMap[lang]}`;
    }
  }

  function applyLanguage(lang) {
    const t = translations[lang];
    document.getElementById("rate-experience").textContent = t.title;
    document.getElementById("rate-description").textContent = t.description;
    document.getElementById("comments").placeholder = t.feedbackPlaceholder;
    document.querySelector("#send-feedback img").alt = t.submitAlt;
    document.querySelectorAll(".rating-label").forEach((label, i) => {
      label.textContent = t.ratingLabels[i];
    });
    updateSubmitImage(lang); // <-- added here
    currentLanguage = lang;
  }

  applyLanguage(currentLanguage);

  const langBtn = document.getElementById("lang-btn");
  const langOptions = document.getElementById("language-options");

  if (langBtn && langOptions) {
    langBtn.addEventListener("click", () => {
      langOptions.style.display = langOptions.style.display === "block" ? "none" : "block";
    });

    document.querySelectorAll("#language-options button").forEach(button => {
      button.addEventListener("click", () => {
        const selectedLang = button.getAttribute("data-lang");
        localStorage.setItem("selectedLanguage", selectedLang);
        applyLanguage(selectedLang);
      });
    });
  }

  window.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      lastInteractionWasKeyboard = true;
    }
  });

  window.addEventListener("mousedown", () => {
    lastInteractionWasKeyboard = false;
  });

  const speak = (text) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  };

  const tabbableElements = document.querySelectorAll('[tabindex="0"]');
  tabbableElements.forEach((el) => {
    el.addEventListener("focus", () => {
      if (!lastInteractionWasKeyboard) return;

      let text = "";

      if (el.id === "rate-experience") {
        text = translations[currentLanguage].title;
      } else if (el.classList.contains("rating-row")) {
        const input = el.querySelector("input[type='radio']");
        const value = input ? input.value : null;
        text = value ? `${value} star${value === "1" ? "" : "s"}` : "Rating option";
      } else if (el.id === "comments") {
        text = translations[currentLanguage].feedbackPlaceholder;
      } else if (el.id === "send-feedback") {
        text = translations[currentLanguage].submitAlt;
      } else if (el.id === "return-chatbot") {
        text = "Return to Chatbot";
      } else if (el.id === "skip-feedback") {
        text = translations[currentLanguage].exit;
      } else if (el.id === "success-message") {
        text = translations[currentLanguage].success;
      }

      if (text) speak(text);
    });
  });

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
          document.getElementById("feedback-form").style.display = "none";
          document.getElementById("rate-experience").style.display = "none";
          document.getElementById("rate-description").style.display = "none";

          const successMessage = document.getElementById("success-message");
          successMessage.style.display = "block";
          successMessage.tabIndex = "0";

          successMessage.addEventListener("focus", () => {
            if (lastInteractionWasKeyboard) {
              speak(translations[currentLanguage].success);
            }
          });

          const exitButton = document.createElement("button");
          exitButton.textContent = translations[currentLanguage].exit;
          exitButton.id = "skip-feedback";
          exitButton.tabIndex = "0";
          exitButton.style.backgroundColor = "red";
          exitButton.style.color = "white";
          exitButton.style.padding = "10px 20px";
          exitButton.style.border = "none";
          exitButton.style.cursor = "pointer";
          exitButton.style.fontSize = "16px";
          exitButton.style.borderRadius = "5px";
          exitButton.style.marginTop = "20px";
          exitButton.style.display = "block";
          exitButton.style.margin = "20px auto";
          exitButton.style.textAlign = "center";
          exitButton.style.width = "fit-content";

          exitButton.addEventListener("focus", () => {
            if (lastInteractionWasKeyboard) {
              speak(translations[currentLanguage].exit);
            }
          });

          exitButton.addEventListener("click", function () {
            window.location.href = "https://www.bowiestate.edu";
          });

          successMessage.appendChild(exitButton);

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

  const ratingRows = document.querySelectorAll(".rating-row");
  ratingRows.forEach(row => {
    const radio = row.querySelector("input[type='radio']");
    row.addEventListener("click", () => {
      radio.checked = true;
      ratingRows.forEach(r => r.classList.remove("selected"));
      row.classList.add("selected");
    });
  });
});
    
