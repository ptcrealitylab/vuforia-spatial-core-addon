const VideoUIStates = {
    EMPTY: 'EMPTY', // No recording yet
    WAITING_FOR_USER: 'WAITING_FOR_USER', // URL has been set, but waiting until user starts the load manually
    RECORDING: 'RECORDING', // Currently recording
    SAVING: 'SAVING', // Saving the recording
    LOADING: 'LOADING', // Loading the recording
    PAUSED: 'PAUSED', // Video paused
    PLAYING: 'PLAYING', // Playing video
};

class VideoUI {
    constructor(parentElement, callbacks) {
        this.parentElement = parentElement;
        this.callbacks = callbacks;
        this.icons = ['empty', 'emptyBlocked', 'paused', 'recording', 'playing', 'loading', 'saving', 'waitingForUser'].map(iconName => {
            /* <---- all icons get added to dom here ---->  */
            const imageElement = document.createElement('img');
            if (iconName === 'saving') {
                imageElement.src = 'sprites/saving0.png';
            } else {
                imageElement.src = `sprites/${iconName}.png`;
            }
            imageElement.iconName = iconName;
            this.parentElement.appendChild(imageElement);
            imageElement.hidden = true;
            /* <---- ------------------------------ ---->  */
            imageElement.addEventListener('pointerup', e => {
                if (e.button === 0) {
                    this.callbacks.onButtonPress(this);
                }
            });
            return imageElement;
        });
        this.icons.getByName = (name) => {
            return this.icons.find(icon => icon.iconName.toLowerCase() === name.toLowerCase());
        };

        this.spriteAnimationStartTime = Date.now();
        this.savingSrcs = [0, 1, 2, 3].map(index => `sprites/saving${index}.png`);
        //icons are animated together here
        this.animateIcons();

        this.setState(VideoUIStates.EMPTY);
    }
    
    animateIcons() {
        const elapsedTime = Date.now() - this.spriteAnimationStartTime;
        const modulo = Math.floor((elapsedTime / 1000 * 2) % 4); // Change saving animation frame twice per second
        //wait to mount before beginning
        this.icons.getByName('saving').src = this.savingSrcs[modulo];
        //wait to mount before beginning
        this.icons.getByName('loading').style.transform = `rotate(${elapsedTime / 1000 * 2 * Math.PI / 4}rad)`; // One rotation per four seconds
        window.requestAnimationFrame(() => this.animateIcons());
    }

    //this should mount and unmount the icons
    setIconByName(iconName) {
        this.icons.forEach(icon => icon.hidden = true);
        this.icons.getByName(iconName).hidden = false;
    }

    setState(state) {
        this.state = state;
        if (this.state === VideoUIStates.EMPTY) {
            if (window.isDesktop()) {
                this.setIconByName('emptyBlocked'); // Recording disabled on desktop
            } else {
                this.setIconByName('empty');
            }
        } else if (this.state === VideoUIStates.WAITING_FOR_USER) {
            this.setIconByName('waitingForUser');
        } else if (this.state === VideoUIStates.RECORDING) {
            this.setIconByName('recording');
        } else if (this.state === VideoUIStates.SAVING) {
            this.setIconByName('saving');
        } else if (this.state === VideoUIStates.LOADING) {
            this.setIconByName('loading');
        } else if (this.state === VideoUIStates.PAUSED) {
            this.setIconByName('paused');
        } else if (this.state === VideoUIStates.PLAYING) {
            this.setIconByName('playing');
        }
    }

    setCurrentTime(_currentTime) {
        // TODO: add scrubber and show playback time in UI
    }
}

export { VideoUI, VideoUIStates };
