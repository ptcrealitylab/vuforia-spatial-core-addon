export function createErrorPopup(container, error) {
    const popup = document.createElement('div');
    popup.classList.add('error-popup');
    popup.textContent = 'Error: ' + error;

    container.appendChild(popup);
    setTimeout(() => {
        container.removeChild(popup);
    }, 5000);
}
