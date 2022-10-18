const VideoManagerStates = {
    EMPTY: 'EMPTY', // No recording yet
    WAITING_FOR_USER: 'WAITING_FOR_USER', // URL has been set, but waiting until user starts the load manually
    RECORDING: 'RECORDING', // Currently recording
    SAVING: 'SAVING', // Saving the recording
    LOADING: 'LOADING', // Loading the recording
    PAUSED: 'PAUSED', // Video paused
    PLAYING: 'PLAYING', // Playing video
    MOBILE_LOADED: 'MOBILE_LOADED' // Mobile device cannot playback
};

// eslint-disable-next-line no-unused-vars
class VideoManager {
    constructor(scene, mainContainerObj, camera, spatialInterface) {
        this.callbacks = {
            'STATE': [],
            'RENDER': []
        };

        this.scene = scene;
        this.mainContainerObj = mainContainerObj;
        this.camera = camera;
        this.spatialInterface = spatialInterface;

        this.button = new THREE.Mesh(new THREE.SphereGeometry(100, 16, 8), new THREE.MeshBasicMaterial({color: 0x000000, visible: false}));
        this.mainContainerObj.add(this.button);
        this.spriteMaterials = ['empty', 'loading', 'paused', 'playing', 'recording', 'waitingForUser', 'mobile']
            .map(spriteName => {
                const material = new THREE.SpriteMaterial({map: new THREE.TextureLoader().load(`sprites/${spriteName}.png`)});
                material.name = spriteName;
                return material;
            });
        this.spriteMaterials.getByName = spriteName => this.spriteMaterials.find(material => material.name.toLowerCase() === spriteName.toLowerCase());
        const savingMaterial = new THREE.SpriteMaterial();
        savingMaterial.name = 'saving';
        this.spriteMaterials.push(savingMaterial);
        const spriteAnimationStartTime = Date.now();
        const savingSpriteTextures = [0, 1, 2, 3].map(index => new THREE.TextureLoader().load(`sprites/saving${index}.png`));
        const loadingMaterial = this.spriteMaterials.getByName('loading');
        this.addCallback('RENDER', () => {
            const elapsedTime = Date.now() - spriteAnimationStartTime;
            const modulo = Math.floor((elapsedTime / 1000 * 2) % 4); // Change saving animation frame twice per second
            savingMaterial.map = savingSpriteTextures[modulo];
            loadingMaterial.rotation = elapsedTime / 1000 * 2 * Math.PI / -4; // One rotation per four seconds
        });
        this.buttonSprite = new THREE.Sprite(this.spriteMaterials.getByName('empty'));
        this.button.add(this.buttonSprite);
        this.buttonSprite.scale.set(200, 200, 1);

        this.state = VideoManagerStates.EMPTY;

        this.raycaster = new THREE.Raycaster();
        this.raycastPointer = new THREE.Vector2();
    }

    addCallback(callbackType, callback) {
        this.callbacks[callbackType].push(callback);
        return callback;
    }

    removeCallback(callbackType, callback) {
        this.callbacks[callbackType].splice(this.callbacks[callbackType].findIndex(callback), 1);
    }

    setState(state) {
        this.state = state;
        this.callbacks['STATE'].forEach(callback => callback(state));
        if (this.state === VideoManagerStates.EMPTY) {
            this.buttonSprite.material = this.spriteMaterials.getByName('empty');
        } else if (this.state === VideoManagerStates.WAITING_FOR_USER) {
            this.buttonSprite.material = this.spriteMaterials.getByName('paused'); // TODO: make clearer
        } else if (this.state === VideoManagerStates.RECORDING) {
            this.buttonSprite.material = this.spriteMaterials.getByName('recording');
        } else if (this.state === VideoManagerStates.SAVING) {
            this.buttonSprite.material = this.spriteMaterials.getByName('saving');
        } else if (this.state === VideoManagerStates.LOADING) {
            this.buttonSprite.material = this.spriteMaterials.getByName('loading');
        } else if (this.state === VideoManagerStates.PAUSED) {
            this.buttonSprite.material = this.spriteMaterials.getByName('paused');
        } else if (this.state === VideoManagerStates.PLAYING) {
            this.buttonSprite.material = this.spriteMaterials.getByName('playing');
        } else if (this.state === VideoManagerStates.MOBILE_LOADED) {
            this.buttonSprite.material = this.spriteMaterials.getByName('mobile');
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

    onPointerDown(e) {
        this.raycastPointer.x = (e.pageX / window.innerWidth) * 2 - 1;
        this.raycastPointer.y = -(e.pageY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.raycastPointer, this.camera);
        if (this.raycaster.intersectObject(this.button).length > 0) {
            this.onButtonPress();
        }
    }

    onButtonPress() {
        if (this.state === VideoManagerStates.EMPTY) {
            this.startRecording();
        } else if (this.state === VideoManagerStates.WAITING_FOR_USER) {
            this.loadFromURLs(this.defaultURLs);
        } else if (this.state === VideoManagerStates.RECORDING) {
            this.stopRecording();
        } else if (this.state === VideoManagerStates.PAUSED) {
            this.play();
        } else if (this.state === VideoManagerStates.PLAYING) {
            this.pause();
        } else {
            console.log(`Spatial Video button is not enabled during '${this.state}' state.`);
        }
    }

    render() {
        this.callbacks['RENDER'].forEach(cb => cb());
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
