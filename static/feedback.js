document.addEventListener('DOMContentLoaded', function() {
    // Get all the star labels and input elements
    const starLabels = document.querySelectorAll('.stars label');
    const starInputs = document.querySelectorAll('.stars input');
    
    // Hover effect - make stars gold when hovering
    starLabels.forEach((label, index) => {
        label.addEventListener('mouseover', function() {
            for (let i = 0; i <= index; i++) {
                starLabels[i].style.color = 'gold';
            }
        });

        label.addEventListener('mouseout', function() {
            starLabels.forEach(label => {
                label.style.color = 'black'; // Reset color when not hovering
            });
        });
    });

    // Make the selected rating stick when clicked
    starInputs.forEach(input => {
        input.addEventListener('change', function() {
            const selectedValue = input.value;
            for (let i = 0; i < starLabels.length; i++) {
                starLabels[i].style.color = (i < selectedValue) ? 'gold' : 'black';
            }
        });
    });
});
