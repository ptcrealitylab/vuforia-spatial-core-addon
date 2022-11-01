const VideoManagerStates = {
    EMPTY: 'EMPTY', // No recording yet
    WAITING_FOR_USER: 'WAITING_FOR_USER', // URL has been set, but waiting until user starts the load manually
    RECORDING: 'RECORDING', // Currently recording
    SAVING: 'SAVING', // Saving the recording
    LOADING: 'LOADING', // Loading the recording
    PAUSED: 'PAUSED', // Video paused
    PLAYING: 'PLAYING', // Playing video
};

// eslint-disable-next-line no-unused-vars
class VideoManager {
    constructor(spatialInterface) {
        this.callbacks = {
            'STATE': [],
            'LOAD': []
        };

        this.id = Math.random().toString();
        this.spatialInterface = spatialInterface;

        this.icons = ['empty', 'paused', 'recording', 'playing', 'loading', 'saving', 'waitingForUser'].map(iconName => {
            const imageElement = document.createElement('img');
            if (iconName === 'saving') {
                imageElement.src = `sprites/saving0.png`;
            } else {
                imageElement.src = `sprites/${iconName}.png`;
            }
            imageElement.iconName = iconName;
            document.body.appendChild(imageElement);
            imageElement.hidden = true;
            imageElement.addEventListener('pointerdown', e => {
                if (e.button === 0) {
                    this.onButtonPress();
                }
            });
            return imageElement;
        });
        this.icons.getByName = (name) => {
            return this.icons.find(icon => icon.iconName.toLowerCase() === name.toLowerCase());
        };

        this.spriteAnimationStartTime = Date.now();
        this.savingSrcs = [0, 1, 2, 3].map(index => `sprites/saving${index}.png`);
        this.animateIcons();

        this.setState(VideoManagerStates.EMPTY);
    }

    animateIcons() {
        const elapsedTime = Date.now() - this.spriteAnimationStartTime;
        const modulo = Math.floor((elapsedTime / 1000 * 2) % 4); // Change saving animation frame twice per second
        this.icons.getByName('saving').src = this.savingSrcs[modulo];
        this.icons.getByName('loading').style.transform = `rotate(${elapsedTime / 1000 * 2 * Math.PI / 4}rad)`; // One rotation per four seconds
        window.requestAnimationFrame(() => this.animateIcons());
    }

    addCallback(callbackType, callback) {
        this.callbacks[callbackType].push(callback);
        return callback;
    }

    removeCallback(callbackType, callback) {
        this.callbacks[callbackType].splice(this.callbacks[callbackType].findIndex(callback), 1);
    }

    setIconByName(iconName) {
        this.icons.forEach(icon => icon.hidden = true);
        this.icons.getByName(iconName).hidden = false;
    }

    setState(state) {
        if (state !== VideoManagerStates.EMPTY && state !== VideoManagerStates.WAITING_FOR_USER && !window.isDesktop()) { // Must go fullscreen to prevent loss of UI when looking away from tool
            this.spatialInterface.setFullScreenOn();
            document.body.classList.add('fullscreen');
        } else {
            this.spatialInterface.setFullScreenOff();
            document.body.classList.remove('fullscreen');
        }
        if (this.state === VideoManagerStates.LOADING && state !== VideoManagerStates.LOADING) {
            this.callbacks['LOAD'].forEach(callback => callback());
        }
        this.state = state;
        this.callbacks['STATE'].forEach(callback => callback(state));
        if (this.state === VideoManagerStates.EMPTY) {
            if (window.isDesktop()) {
                this.setIconByName('empty');
            } else {
                this.setIconByName('empty');
            }
        } else if (this.state === VideoManagerStates.WAITING_FOR_USER) {
            this.setIconByName('waitingForUser');
        } else if (this.state === VideoManagerStates.RECORDING) {
            this.setIconByName('recording');
        } else if (this.state === VideoManagerStates.SAVING) {
            this.setIconByName('saving');
        } else if (this.state === VideoManagerStates.LOADING) {
            this.setIconByName('loading');
        } else if (this.state === VideoManagerStates.PAUSED) {
            this.setIconByName('paused');
        } else if (this.state === VideoManagerStates.PLAYING) {
            this.setIconByName('playing');
        }
    }

    startRecording() {
        this.setState(VideoManagerStates.RECORDING);
    }

    stopRecording() {
        if (this.state !== VideoManagerStates.RECORDING) {
            return;
        }
        this.setState(VideoManagerStates.SAVING);
    }

    loadFromURLs(urls) {
        this.setState(VideoManagerStates.LOADING);
        this.videoPlayback = this.spatialInterface.createVideoPlayback(urls);
        this.videoPlayback.onStateChange(state => {
            this.setState(state);
        });
    }

    setDefaultURLs(urls) {
        if (this.state === VideoManagerStates.EMPTY) {
            this.defaultURLs = urls;
            this.setState(VideoManagerStates.WAITING_FOR_USER);
        } else {
            this.loadFromURLs(urls);
        }
    }

    setCurrentTime(currentTime) {
        this.videoPlayback.currentTime = currentTime;
    }

    play() {
        this.videoPlayback.play();
    }

    pause() {
        this.videoPlayback.pause();
    }

    onButtonPress() {
        if (this.state === VideoManagerStates.EMPTY) {
            if (!window.isDesktop()) {
                this.startRecording();
            } else {
                console.log('Spatial Video tool cannot record on desktop.');
            }
        } else if (this.state === VideoManagerStates.WAITING_FOR_USER) {
            this.loadFromURLs(this.defaultURLs);
        } else if (this.state === VideoManagerStates.RECORDING) {
            this.stopRecording();
        } else if (this.state === VideoManagerStates.PAUSED) {
            this.play();
            this.spatialInterface.writePublicData('storage', 'status', {
                state: VideoManagerStates.PLAYING,
                currentTime: this.videoPlayback.currentTime,
                id: this.id
            });
        } else if (this.state === VideoManagerStates.PLAYING) {
            this.pause();
            this.spatialInterface.writePublicData('storage', 'status', {
                state: VideoManagerStates.PAUSED,
                currentTime: this.videoPlayback.currentTime,
                id: this.id
            });
        } else {
            console.log(`Spatial Video button is not enabled during '${this.state}' state.`);
        }
    }

    /* ---------------- Helper Functions ---------------- */

    /**
     * Sets a matrix from the values in an array.
     * @param matrix - The matrix to set the values of.
     * @param array - The array to copy the values from.
     */
    setMatrixFromArray(matrix, array) {
        matrix.set(
            array[0], array[4], array[8], array[12],
            array[1], array[5], array[9], array[13],
            array[2], array[6], array[10], array[14],
            array[3], array[7], array[11], array[15]
        );
    }
}

export { VideoManager, VideoManagerStates };
