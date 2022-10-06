import RVLParser from './rvl/RVLParser.js';
import SceneNode from './sceneGraph/SceneNode.js';
import { VideoElementPlayer, VideoPolyfillPlayer } from './VideoPolyfillPlayer.js';

const POINT_CLOUD_VERTEX_SHADER = `
uniform sampler2D map;
uniform sampler2D mapDepth;
uniform float width;
uniform float height;
uniform float depthScale;
uniform float glPosScale;
uniform float pointSize;
const float pointSizeBase = 0.0;
varying vec2 vUv;
varying vec4 pos;
const float XtoZ = 1920.0 / 1448.24976; // width over focal length
const float YtoZ = 1080.0 / 1448.24976;
void main() {
  vUv = vec2(position.x / width, position.y / height);
  vec4 color = texture2D(mapDepth, vUv);
  float depth = 5000.0 * (color.r + color.g / 255.0 + color.b / (255.0 * 255.0));
  float z = depth - 0.05;
  pos = vec4(
    (position.x / width - 0.5) * z * XtoZ,
    (position.y / height - 0.5) * z * YtoZ,
    -z,
    1.0);
  gl_Position = projectionMatrix * modelViewMatrix * pos;
  // gl_PointSize = pointSizeBase + pointSize * depth * depthScale;
  gl_PointSize = pointSizeBase + pointSize * depth * depthScale + glPosScale / gl_Position.w;
}`;

const POINT_CLOUD_FRAGMENT_SHADER = `
// color texture
uniform sampler2D map;

// uv (0.0-1.0) texture coordinates
varying vec2 vUv;
// Position of this pixel relative to the camera in proper (millimeter) coordinates
varying vec4 pos;

void main() {
  // Depth in millimeters
  float depth = -pos.z;

  // Fade out beginning at 4.5 meters and be gone after 5.0
  float alphaDepth = clamp(2.0 * (5.0 - depth / 1000.0), 0.0, 1.0);

  // Normal vector of the depth mesh based on pos
  // Necessary to calculate manually since we're messing with gl_Position in the vertex shader
  vec3 normal = normalize(cross(dFdx(pos.xyz), dFdy(pos.xyz)));

  // pos.xyz is the ray looking out from the camera to this pixel
  // dot of pos.xyz and the normal is to what extent this pixel is flat
  // relative to the camera (alternatively, how much it's pointing at the
  // camera)
  // alphaDepth is thrown in here to incorporate the depth-based fade
  float alpha = abs(dot(normalize(pos.xyz), normal)) * alphaDepth;

  // Sample the proper color for this pixel from the color image
  vec4 color = texture2D(map, vUv);

  gl_FragColor = vec4(color.rgb, alpha);
  // gl_FragColor = vec4(color.rgb, 1.0);
}`;

const VideoManagerStates = {
    EMPTY: 'EMPTY', // No recording yet
    WAITING_FOR_USER: 'WAITING_FOR_USER', // URL has been set, but waiting until user starts the load manually
    RECORDING: 'RECORDING', // Currently recording
    SAVING: 'SAVING', // Saving the recording
    LOADING: 'LOADING', // Loading the recording
    PAUSED: 'PAUSED', // Video paused, initial state after loading
    PLAYING: 'PLAYING', // Playing video
};

// eslint-disable-next-line no-unused-vars
class VideoManager {
    constructor(scene, mainContainerObj, groundPlaneContainerObj, camera) {
        this.callbacks = {
            'STATE': [],
            'RENDER': []
        };

        this.scene = scene;
        this.camera = camera;
        this.floorOffset = 1.5 * 1000; // TODO: Rough placeholder until we get better info from app to prevent video being underground
        this.mainContainerObj = mainContainerObj;
        this.groundPlaneContainerObj = groundPlaneContainerObj;
        this.phoneParent = new THREE.Group();
        this.phone = new THREE.Group();
        this.phone.matrixAutoUpdate = false; // Phone matrix will be set via pose data
        this.phone.frustumCulled = false;
        this.groundPlaneContainerObj.add(this.phoneParent);
        this.phoneParent.add(this.phone);
        this.phoneParent.rotateX(Math.PI / 2);
        this.phoneParent.position.y = this.floorOffset;
        this.button = new THREE.Mesh(new THREE.SphereGeometry(100, 16, 8), new THREE.MeshBasicMaterial({color: 0x000000, visible: false}));
        this.mainContainerObj.add(this.button);

        this.spriteMaterials = ['empty', 'loading', 'paused', 'playing', 'recording', 'waitingForUser']
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
            loadingMaterial.rotation = (Date.now() - spriteAnimationStartTime) / 1000 * 2 * Math.PI / -4; // One rotation per four seconds
        });
        this.buttonSprite = new THREE.Sprite(this.spriteMaterials.getByName('empty'));
        this.button.add(this.buttonSprite);
        this.buttonSprite.scale.set(200, 200, 1);

        this.state = VideoManagerStates.EMPTY;
        this.lastRenderTime = -1; // Last rendered frame time (using video time)
        this.videoLength = 0;

        this.canvas = {
            color: this.createCanvasElement('colorCanvas', 960, 540),
            depth: this.createCanvasElement('depthCanvas', 256, 144)
        };
        this.canvas.depth.imageData = this.canvas.depth.getContext('2d').createImageData(256, 144);

        this.video = {
            color: this.createVideoElement()
        };
        this.video.color.onloadedmetadata = evt => this.onVideoMetadata(evt);
        // this.video.color.videoElement.oncanplay = () => {
        //     setInterval(() => {
        //         createImageBitmap(this.video.color.videoElement).then(image => {
        //             if (this.textures && this.textures.color) {
        //                 this.textures.color.image = image;
        //                 this.textures.color.needsUpdate = true;
        //             }
        //         });
        //     }, 100);
        // };

        this.decoder = new TextDecoder();

        this.raycaster = new THREE.Raycaster();
        this.raycastPointer = new THREE.Vector2();

        this.debugBox = new THREE.Mesh(new THREE.BoxGeometry(40, 40, 40), new THREE.MeshNormalMaterial());
        this.phone.add(this.debugBox);
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
        this.video.color.setSrc(urls.color);

        return fetch(urls.rvl).then(res => res.arrayBuffer()).then(buf => {
            this.rvl = new RVLParser(buf);
            if (this.videoLength !== 0) {
                this.play();
            }
        });
    }
    setDefaultURLs(urls) {
        if (this.state === VideoManagerStates.EMPTY) {
            this.defaultURLs = urls;
            this.setState(VideoManagerStates.WAITING_FOR_USER);
        } else {
            this.loadFromURLs(urls).then(() => {});
        }
    }
    setCurrentTime(currentTime) {
        if (currentTime > this.videoLength && this.videoLength > 0) {
            this.video.color.currentTime = currentTime % this.videoLength;
        } else {
            this.video.color.currentTime = currentTime;
        }
    }
    setFloorOffset(floorOffset) {
        this.floorOffset = -floorOffset;
        this.phoneParent.position.y = this.floorOffset;
    }
    play() {
        this.setState(VideoManagerStates.PLAYING);
        this.video.color.play();
    }
    pause() {
        this.setState(VideoManagerStates.PAUSED);
        this.video.color.pause();
        // TODO: ensure currentTime and state gets synchronized with other players when pause happens
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
            this.loadFromURLs(this.defaultURLs).then(() => {});
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
        this.callbacks['RENDER'].forEach(callback => callback());
        if (this.state !== VideoManagerStates.PAUSED && this.state !== VideoManagerStates.PLAYING) {
            return;
        }
        if (this.lastRenderTime === this.video.color.currentTime && this.state === VideoManagerStates.PAUSED) {
            return; // Do not re-render identical frames
        }
        this.lastRenderTime = this.video.color.currentTime;

        // const colorCtx = this.canvas.color.getContext('2d');
        // colorCtx.scale(-1, -1);
        // this.video.color.drawToContext(colorCtx, -960, -540, 960, 540);
        // colorCtx.scale(-1, -1);

        const rvlFrame = this.rvl.getFrameFromDeltaTimeSeconds(this.video.color.currentTime);
        this.rvl.drawFrame(rvlFrame, this.canvas.depth.getContext('2d'), this.canvas.depth.imageData);

        const rvlPayload = this.decoder.decode(rvlFrame.payload);
        this.applyMatricesMessage(rvlPayload);

        this.loadPointCloud();
    }

    /* ---------------- Helper Functions ---------------- */

    applyMatricesMessage(matricesMsg) {
        const matrices = JSON.parse(matricesMsg);
        const rootNode = new SceneNode('ROOT');
        rootNode.updateWorldMatrix();

        let cameraNode = new SceneNode('camera');
        cameraNode.setLocalMatrix(matrices.camera);
        cameraNode.updateWorldMatrix();

        let gpNode = new SceneNode('gp');
        gpNode.needsRotateX = true;
        let gpRxNode = new SceneNode('gprotateX');
        gpRxNode.addTag('rotateX');
        gpRxNode.setParent(gpNode);

        const c = Math.cos(-Math.PI / 2);
        const s = Math.sin(-Math.PI / 2);
        let rxMat = [
            1, 0, 0, 0,
            0, c, -s, 0,
            0, s, c, 0,
            0, 0, 0, 1
        ];
        gpRxNode.setLocalMatrix(rxMat);

        gpNode.setLocalMatrix(matrices.groundplane);
        gpNode.updateWorldMatrix();

        let sceneNode = new SceneNode('scene');
        sceneNode.setParent(rootNode);

        let initialVehicleMatrix = [
            -1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, -1, 0,
            0, 0, 0, 1,
        ];

        sceneNode.setPositionRelativeTo(cameraNode, initialVehicleMatrix);
        sceneNode.updateWorldMatrix();

        let cameraMat = sceneNode.getMatrixRelativeTo(gpRxNode);
        this.setMatrixFromArray(this.phone.matrix, new Float32Array(cameraMat));
    }

    /**
     * Takes in the stored Base64 pose data and parses it back into a matrix.
     * @param poseBase64 - The stored Base64 pose data.
     * @return {Float32Array|null} - The original pose data.
     */
    getPoseMatrixFromData(poseBase64) {
        if (!poseBase64) { return null; }

        let byteCharacters = window.atob(poseBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Float32Array(byteArray.buffer);
    }

    /**
     * Creates a canvas element for use with getting video frames into THREE.js
     * @param id - The #id of the canvas element.
     * @param width - The width of the canvas element.
     * @param height - The height of the canvas element.
     * @return {HTMLCanvasElement} - The created canvas element.
     */
    createCanvasElement(id, width, height) {
        let canvas = document.createElement('canvas');
        canvas.id = id;
        canvas.width = width;
        canvas.height = height;
        canvas.style.backgroundColor = '#FFFFFF';
        canvas.style.display = 'none';
        return canvas;
    }

    /**
     * Creates a video element for use with getting video frames into THREE.js
     * @return {VideoElementPlayer} - A player for the created video element.
     */
    createVideoElement() {
        return new VideoElementPlayer();
        // const video = document.createElement('video');
        // video.id = id;
        // video.width = 256;
        // video.loop = true;
        // video.muted = true;
        // video.playsInline = true;
        // video.crossOrigin = 'Anonymous';
        // video.style.display = 'none';
        //
        // let source = document.createElement('source');
        // video.appendChild(source);
        //
        // video.setSrc = src => {
        //     source.src = src;
        //     source.type = 'video/mp4';
        //     video.load();
        // };
        //
        // return video;
    }

    /**
     * Updates the VideoManager with the newly loaded video metadata.
     * @param evt - The onloadedmetadata event.
     */
    onVideoMetadata(evt) {
        this.videoLength = this.videoLength === 0 ? evt.target.duration : Math.min(this.videoLength, evt.target.duration);
        if (this.rvl) {
            this.play();
        }
    }

    /**
     * Loads the given color and depth images into the point cloud rendering.
     */
    loadPointCloud() {
        if (!this.pointCloud) {
            const width = 640;
            const height = 360;

            const geometry = new THREE.PlaneGeometry(width, height, width / 5, height / 5);
            geometry.translate(width / 2, height / 2, 0);
            const material = this.createPointCloudMaterial();
            const mesh = new THREE.Mesh(geometry, material);
            mesh.scale.set(-1, 1, -1);
            mesh.frustumCulled = false;
            this.pointCloud = mesh;
            this.phone.add(this.pointCloud);
        } else {
            this.updatePointCloudMaterial();
        }
    }

    /**
     * Creates the material used by the point cloud.
     * @return {*}
     */
    createPointCloudMaterial() {
        const width = 640;
        const height = 360;

        this.textures = {
            color: new THREE.VideoTexture(this.video.color.videoElement),
            depth: new THREE.CanvasTexture(this.canvas.depth)
        };

        // this.textures.color.center = new THREE.Vector2(0.5, 0.5);
        // this.textures.color.rotation = Math.PI;
        // this.textures.color.flipY = false;

        [this.textures.depth].forEach(texture => {
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.generateMipmaps = false;
        });

        this.textures.depth.isVideoTexture = true;
        this.textures.depth.update = function() {
        };

        this.pointCloudMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: {value: window.performance.now()},
                map: {value: this.textures.color},
                mapDepth: {value: this.textures.depth},
                width: {value: width},
                height: {value: height},
                depthScale: {value: 0.15 / 256}, // roughly 1 / 1920
                glPosScale: {value: 20000}, // 0.15 / 256}, // roughly 1 / 1920
                pointSize: { value: 2 * 0.666 },
            },
            vertexShader: POINT_CLOUD_VERTEX_SHADER,
            fragmentShader: POINT_CLOUD_FRAGMENT_SHADER,
            depthTest: true,
            transparent: true
        });

        return this.pointCloudMaterial;
    }

    /**
     * Updates the material used by the point cloud to use the latest frames' textures.
     */
    updatePointCloudMaterial() {
        // this.textures.color.needsUpdate = true;
        this.textures.depth.needsUpdate = true;
        this.pointCloudMaterial.uniforms.time = window.performance.now();
    }

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
