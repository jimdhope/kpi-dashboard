document.addEventListener('DOMContentLoaded', function() {
    const colorInputs = document.querySelectorAll('input[type="color"]');
    const hexInputs = document.querySelectorAll('.hex-input');

    colorInputs.forEach(input => {
        input.addEventListener('input', function(e) {
            const hexInput = document.getElementById('hex_' + this.id);
            hexInput.value = this.value.toUpperCase();
            document.documentElement.style.setProperty(`--${this.id}`, this.value);
        });
    });

    hexInputs.forEach(input => {
        input.addEventListener('input', function(e) {
            const colorId = this.id.replace('hex_', '');
            const colorInput = document.getElementById(colorId);
            if (/^#[0-9A-Fa-f]{6}$/.test(this.value)) {
                colorInput.value = this.value;
                document.documentElement.style.setProperty(`--${colorId}`, this.value);
            }
        });
    });
});