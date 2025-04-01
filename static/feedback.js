document.addEventListener("DOMContentLoaded", function () {
    console.log("JavaScript loaded!");

    // Select all star inputs and labels
    const stars = document.querySelectorAll(".stars input");
    const labels = document.querySelectorAll(".stars label");

    stars.forEach(star => {
        star.addEventListener("change", function () {
            console.log(`You selected ${this.value} stars`);
            highlightStars(this.value);
        });
    });

    function highlightStars(value) {
        labels.forEach((label, index) => {
            label.style.color = (index < value) ? "gold" : "black";
        });
    }
});
