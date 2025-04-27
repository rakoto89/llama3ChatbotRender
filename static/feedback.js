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
            ratingLabels: ["Terrible", "Bad", "Okay", "Good", "Amazing"],
            titles: {
                home: "Home",
                language: "Language Preferences",
                feedback: "Feedback",
                resources: "Resources",
                exit: "Exit"
            }
        },
        es: {
            title: "Califica tu experiencia",
            description: "¡Valoramos mucho tus comentarios! Califica tu experiencia y proporciónanos tus valiosos comentarios.",
            feedbackPlaceholder: "Escribe tus comentarios aquí...",
            submitAlt: "Enviar comentarios",
            success: "¡Gracias por tus comentarios!",
            exit: "Salir",
            ratingLabels: ["Terrible", "Malo", "Regular", "Bueno", "Increíble"],
            titles: {
                home: "Inicio",
                language: "Preferencias de idioma",
                feedback: "Comentarios",
                resources: "Recursos",
                exit: "Salir"
            }
        },
        fr: {
            title: "Évaluez votre expérience",
            description: "Nous apprécions beaucoup vos commentaires ! Évaluez votre expérience et fournissez-nous vos précieux retours.",
            feedbackPlaceholder: "Écrivez vos commentaires ici...",
            submitAlt: "Soumettre des commentaires",
            success: "Merci pour vos commentaires !",
            exit: "Quitter",
            ratingLabels: ["Terrible", "Mauvais", "Moyen", "Bon", "Incroyable"],
            titles: {
                home: "Accueil",
                language: "Préférences linguistiques",
                feedback: "Commentaires",
                resources: "Ressources",
                exit: "Quitter"
            }
        },
        zh: {
            title: "评价您的体验",
            description: "我们非常重视您的反馈！请评价您的体验并提供宝贵意见。",
            feedbackPlaceholder: "请在此写下您的反馈...",
            submitAlt: "提交反馈",
            success: "感谢您的反馈！",
            exit: "退出",
            ratingLabels: ["糟糕", "差", "一般", "好", "非常好"],
            titles: {
                home: "首页",
                language: "语言偏好",
                feedback: "反馈",
                resources: "资源",
                exit: "退出"
            }
        };
        yo: {
            title: "Ṣe Ayẹwo Iriri Rẹ",
            description: "A fẹ́ kí a gbọ́ ìbáṣepọ̀ rẹ! Jọwọ ṣe ayẹwo iriri rẹ kí o sì fi ìtànná ọpọlọ sọ.",
            feedbackPlaceholder: "Jọwọ kọ ìbáṣepọ̀ rẹ síbí...",
            submitAlt: "Firanṣẹ Ẹ̀dá",
            success: "O ṣeun fún ìbáṣepọ̀ rẹ!",
            exit: "Jade",
            ratingLabels: ["Buburu", "Kò dáa", "Dédé", "Dáa", "Dáadáa gan"],
            titles: {
                home: "Ilé",
                language: "Èdè",
                feedback: "Ìbáṣepọ̀",
                resources: "Àwọn oríṣìíríṣìí",
                exit: "Jade"
            }
        };
        tw: {
            title: "Kɔ So Hwɛ W'adwuma No",
            description: "Yɛhwehwɛ w'anoasɛm! Mesrɛ bɔ dwumadie no ho mmɔden na kyɛ yɛn w'adwene.",
            feedbackPlaceholder: "Twerɛ w'adwene wɔ ha...",
            submitAlt: "Soma Adwene",
            success: "Yɛda wo ase sɛ wode w'adwene maa yɛn!",
            exit: "Pue",
            ratingLabels: ["Bɔne", "Mmerɛ", "Ɛfata", "Pa", "Pa ara"],
            titles: {
                home: "Fie",
                language: "Kasafua",
                feedback: "Nsɛm",
                resources: "Nkonim",
                exit: "Pue"
            }
        };
        hi: {
            title: "अपने अनुभव का मूल्यांकन करें",
            description: "हम आपकी प्रतिक्रिया को महत्व देते हैं! कृपया अपना अनुभव साझा करें।",
            feedbackPlaceholder: "यहाँ अपनी प्रतिक्रिया लिखें...",
            submitAlt: "प्रतिक्रिया भेजें",
            success: "आपकी प्रतिक्रिया के लिए धन्यवाद!",
            exit: "बाहर जाएं",
            ratingLabels: ["बेहद खराब", "खराब", "सामान्य", "अच्छा", "बहुत अच्छा"],
            titles: {
                home: "मुखपृष्ठ",
                language: "भाषा",
                feedback: "प्रतिक्रिया",
                resources: "संसाधन",
                exit: "बाहर जाएं"
            }
        };
        ar: {
            title: "قيّم تجربتك",
            description: "نحن نقدر ملاحظاتك! يرجى تقييم تجربتك وتقديم آرائك.",
            feedbackPlaceholder: "اكتب ملاحظاتك هنا...",
            submitAlt: "إرسال الملاحظات",
            success: "شكرًا لملاحظاتك!",
            exit: "خروج",
            ratingLabels: ["سيء جدًا", "سيء", "عادي", "جيد", "جيد جدًا"],
            titles: {
                home: "الرئيسية",
                language: "اللغة",
                feedback: "ملاحظات",
                resources: "الموارد",
                exit: "خروج"
            }
        };
        ha: {
            title: "Kimanta Kwarewarka",
            description: "Muna daraja ra'ayinka! Don Allah kimanta ƙwarewarka kuma ba da shawara.",
            feedbackPlaceholder: "Rubuta ra'ayinka a nan...",
            submitAlt: "Aika Ra'ayi",
            success: "Mun gode da ra'ayinka!",
            exit: "Fita",
            ratingLabels: ["Mummuna", "Mara kyau", "Matsakaici", "Mai kyau", "Mafi kyau"],
            titles: {
                home: "Gida",
                language: "Harshe",
                feedback: "Ra'ayi",
                resources: "Kayan aiki",
                exit: "Fita"
            }
        }
    };

    function updateSubmitImage(lang) {
        const img = document.getElementById("submit-img");
        const imgMap = {
            en: "Send_Feedback2.png",
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
        updateSubmitImage(lang);
        currentLanguage = lang;

        // ✅ Update sidebar tooltip titles
        document.querySelector('[title="Home"]').title = t.titles.home;
        document.querySelector('[title="Language Preferences"]').title = t.titles.language;
        document.querySelector('[title="Feedback"]').title = t.titles.feedback;
        document.querySelector('[title="Resources"]').title = t.titles.resources;
        document.querySelector('[title="Exit"]').title = t.titles.exit;
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
                applyLanguage(selectedLang);  // updates the text AND tooltips
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
            const t = translations[currentLanguage];

            if (el.id === "rate-experience") {
                text = t.title;
            } else if (el.classList.contains("rating-row")) {
                const input = el.querySelector("input[type='radio']");
                const value = input ? input.value : null;
                text = value ? `${value} star${value === "1" ? "" : "s"}` : "Rating option";
            } else if (el.id === "comments") {
                text = t.feedbackPlaceholder;
            } else if (el.id === "send-feedback") {
                text = t.submitAlt;
            } else if (el.id === "return-chatbot") {
                text = "Return to Chatbot";
            } else if (el.id === "skip-feedback") {
                text = t.exit;
            } else if (el.id === "success-message") {
                text = t.success;
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

        // Add audio element to play the success sound
        const successAudio = new Audio('/static/Voicy_Confetti.mp3');

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
                successMessage.querySelector("h2").textContent = translations[currentLanguage].success;

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

                // Play the success sound effect
                successAudio.play();
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
