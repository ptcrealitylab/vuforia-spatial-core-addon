export class VideoToggle {
    constructor() {
        this.toggleDivContainer = document.getElementById('toggleModeDivContainer');
        this.onToggle = null;
        this.videoMode = true;

        this.create();
        this.add();
    }

    create() {
        this.toggleDiv = document.createElement('div');
        this.toggleDiv.setAttribute('id', 'toggleModeDiv');
        this.toggleDiv.className = 'toggleModeDiv';

        const toggleModeSlider = document.createElement('div');
        toggleModeSlider.setAttribute('id', 'toggleModeSlider');
        toggleModeSlider.className = 'toggleModeSlider';
        toggleModeSlider.classList.add('mode_right');
        this.toggleDiv.appendChild(toggleModeSlider);

        const noVideoIcon = document.createElement('div');
        noVideoIcon.setAttribute('id', 'captureNoVideo');
        noVideoIcon.classList.add('inactiveToggle', 'toggleIcon');

        const noVideoImg = document.createElement('img');
        noVideoImg.src = 'sprites/no-video.png';
        noVideoIcon.appendChild(noVideoImg);

        this.toggleDiv.appendChild(noVideoIcon);

        const videoIcon = document.createElement('div');
        videoIcon.setAttribute('id', 'captureVideo');
        videoIcon.classList.add('activeToggle', 'toggleIcon');

        const videoImg = document.createElement('img');
        videoImg.src = 'sprites/video.png';
        videoImg.style.paddingLeft = '2px';
        videoIcon.appendChild(videoImg);

        this.toggleDiv.appendChild(videoIcon);

        this.toggleDiv.addEventListener('pointerup', () => {
            this.toggleMode(toggleModeSlider, noVideoIcon, videoIcon);
            this.videoMode = !this.videoMode;

            if (this.onToggle) {
                this.onToggle(this.videoMode);
            }
        });
    }
    add() {
        this.toggleDivContainer.appendChild(this.toggleDiv);
    }
    remove() {
        if (this.toggleDiv.parentElement) {
            this.toggleDivContainer.removeChild(this.toggleDiv);
        }
    }
    toggleMode(toggleModeSlider, icon_left, icon_right) {
        if (toggleModeSlider.classList.contains('mode_left')) {
            toggleModeSlider.classList.replace('mode_left', 'mode_right');
            icon_right.classList.replace('inactiveToggle', 'activeToggle');
            icon_left.classList.replace('activeToggle', 'inactiveToggle');
        } else {
            toggleModeSlider.classList.replace('mode_right', 'mode_left');
            icon_right.classList.replace('activeToggle', 'inactiveToggle');
            icon_left.classList.replace('inactiveToggle', 'activeToggle');
        }
    }
}
