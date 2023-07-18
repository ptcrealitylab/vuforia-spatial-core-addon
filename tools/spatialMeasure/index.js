/* global THREE, SpatialInterface, ThreejsInterface, document, EnvelopeContents */

const MINIMIZED_TOOL_WIDTH = 400;
const MINIMIZED_TOOL_HEIGHT = 400;
let appActive = false;
let firstTimeLoad = true;

let mainContainerObj, groundPlaneContainerObj;
let spatialInterface;
let threejsInterface;
let scene;
let translateControls;

if (!spatialInterface) {
    spatialInterface = new SpatialInterface();
    spatialInterface.useWebGlWorker();
}

spatialInterface.onSpatialInterfaceLoaded(() => {
    spatialInterface.setMoveDelay(500);
    spatialInterface.setAlwaysFaceCamera(true);
    
})

let delayedMain = null;
let rendererSize = {
    width: 100,
    height: 100
}

main = ({width, height}) => {
    delayedMain = true;
    rendererSize.width = width;
    rendererSize.height = height;
}

const launchButton = document.querySelector('#launchButton');
launchButton.addEventListener('pointerup', function () {
    envelope.open();
}, false);

const envelopeContainer = document.querySelector('#envelopeContainer');
const envelope = new Envelope(spatialInterface, [], envelopeContainer, launchButton, true, false);

envelope.onClose(() => {
    appActive = false;
    scene.visible = false;
    spatialInterface.setAlwaysFaceCamera(true);
    spatialInterface.changeFrameSize(MINIMIZED_TOOL_WIDTH, MINIMIZED_TOOL_HEIGHT);
    spatialInterface.unregisterTouchDecider();
})

envelope.onOpen(() => {
    appActive = true;
    if (scene) {
        scene.visible = true;
    }
    spatialInterface.setAlwaysFaceCamera(false);
    initEverything(firstTimeLoad);
    if (firstTimeLoad) firstTimeLoad = false;
    spatialInterface.getScreenDimensions((width, height) => {
        spatialInterface.changeFrameSize(width, height);
    })
})

envelope.onBlur(() => {
    envelopeContainer.style.display = 'none';
    spatialInterface.setMoveDelay(500);
})

envelope.onFocus(() => {
    envelopeContainer.style.display = '';
    spatialInterface.setMoveDelay(-1);
})

function initEverything(firstTimeLoad) {
    if (firstTimeLoad) {
        threejsInterface = new ThreejsInterface(spatialInterface);

        threejsInterface.addPendingLoad();

        threejsInterface.onSceneCreated(function onSceneCreated(threejsInterfaceScene) {
            scene = threejsInterfaceScene;

            mainContainerObj = new THREE.Object3D();
            mainContainerObj.matrixAutoUpdate = false;
            mainContainerObj.name = 'mainContainerObj';
            threejsInterfaceScene.add(mainContainerObj);

            groundPlaneContainerObj = new THREE.Object3D();
            groundPlaneContainerObj.matrixAutoUpdate = false;
            groundPlaneContainerObj.name = 'groundPlaneContainer';
            threejsInterfaceScene.add(groundPlaneContainerObj);

            let ambLight = new THREE.AmbientLight(0xaaaaaa);
            threejsInterfaceScene.add(ambLight);

            initScene();

            // todo Steve: userInterface functions not accessible. either come up with a solution with that or discuss to enable access
            // todo Steve: for now, the main thing is just to use the camera position to write the vertex sphere mesh shader
            // userInterfaceCamera = realityEditor.gui.threejsScene.getInternals().camera;
            // console.log(userInterfaceCamera);

            spatialInterface.onSpatialInterfaceLoaded(function () {

                spatialInterface.setVisibilityDistance(100);

                // whenever we receive new matrices from the editor, update the 3d scene
                spatialInterface.subscribeToMatrix();
                spatialInterface.addMatrixListener(matrixCallback);
                spatialInterface.addGroundPlaneMatrixListener(groundPlaneCallback);

                // todo Steve: temporarily disable moving the tool, to work on dragging gizmo handles
                // spatialInterface.setMoveDelay(500);
                // spatialInterface.setMoveDelay(-1);

                threejsInterface.touchDecider = function () {
                    return appActive;
                };
                spatialInterface.registerTouchDecider(threejsInterface.touchDecider);

                // threejsInterface.removePendingLoad();
            });
        });
    }

    threejsInterface.onRender(onRender);

    if (delayedMain && !threejsInterface.camera) {
        threejsInterface.main({width: rendererSize.width, height: rendererSize.height});
    }
}



function setMatrixFromArray(matrix, array) {
    matrix.set( array[0], array[4], array[8], array[12],
        array[1], array[5], array[9], array[13],
        array[2], array[6], array[10], array[14],
        array[3], array[7], array[11], array[15]
    );
}

function matrixCallback(modelViewMatrix, _projectionMatrix) {
    if (threejsInterface.isProjectionMatrixSet) {
        setMatrixFromArray(mainContainerObj.matrix, modelViewMatrix);
    }
}

function groundPlaneCallback(modelViewMatrix, _projectionMatrix) {
    setMatrixFromArray(groundPlaneContainerObj.matrix, modelViewMatrix);
}

function onRender() {
    cssRenderer.render(scene, camera);
    
    if (ray !== undefined) {
        userInterfaceCamDir = ray.direction.clone().applyMatrix4(camera.matrixWorld).applyMatrix4(mainContainerObj.matrixWorld.clone().invert()).normalize();
        // todo Steve: to fix the weird facing issue, need to account for different positions of the vertices in the scene, relative to the camera, and feed the relative direction to the camDir vector, not just the camera direction relative to the scene (0, 0, 0)
        //  and maybe this fixes the issue so that in threejsInterface, the camera FOV doesn't have to change to exactly match the iPhone FOV 41.226......
        vertexSphereArray.forEach(sphere => {
            sphere.material.uniforms['camDir'].value = userInterfaceCamDir;
            sphere.material.needsUpdate = true;
        });

        // todo Steve: need to pass camera position from user-interface or remote-operator to here, using subscribeToCameraMatrix or smth
        //  maybe take inspiration from object.js setAlwaysFaceCamera / user-interface getOrientedCursorRelativeToWorldObject() (see the explanations before this function). See how that's implemented to get the icon / cursor always face the camera. Maybe ask Ben for help
        //  should also pass AreaTarget mesh to here, in order to get the exact correct raycast intersection
        //let camPos = ray.origin.clone().add(ray.direction.clone().multiplyScalar(distance)).applyMatrix4(camera.matrixWorld).applyMatrix4(mainContainerObj.matrixWorld.clone().invert());
        //addTestSphere(camPos.x, camPos.y, camPos.z);
    }
    
    // try to get the main camera matrix and do some fun stuff with it
    spatialInterface.getMainCameraMatrix().then((result) => {
        console.log(result.worldMatrix);
        // let wm = result.worldMatrix.clone();
        //
        // const rotation = new THREE.Euler().setFromRotationMatrix(wm);
        // const forwardVector = new THREE.Vector3(0, 0, -1);
        // forwardVector.applyEuler(rotation);
        // forwardVector.applyMatrix4(mainContainerObj.matrixWorld.clone().invert());
        // forwardVector.normalize();
        //
        // addArrowHelper(new THREE.Vector3(), forwardVector, 2000, 0x00ffff);
    })
}

function prettyPrintMatrix(m) {
    for (let i = 0; i < m.length; i += 4) {
        for (let j = i; j < i + 4; j++) {
            
        }
    }
}

let camera;
let cssRenderer;
let mouse = new THREE.Vector2();
let raycaster = new THREE.Raycaster();
let ray;
let userInterfaceCamDir = new THREE.Vector3();

let lineMeasurer;
let vertexSphereArray = [];
let lineArray = [];
let lineLabelArray = [];

let areaMeasurer;

function initScene() {
    camera = threejsInterface.camera;

    cssRenderer = new CSS3DRenderer();
    cssRenderer.setSize(window.innerWidth, window.innerHeight);
    const css3dCanvas = cssRenderer.domElement;
    css3dCanvas.id = 'spatial-measure-css-3d-renderer';
    // set the position style and pointer events none to complete the setup
    css3dCanvas.style.position = 'absolute';
    css3dCanvas.style.pointerEvents = 'none';
    css3dCanvas.style.top = '0';
    css3dCanvas.style.left = '0';
    document.body.appendChild(css3dCanvas);
    
    
    translateControls = new TranslateControls(camera, mainContainerObj, vertexSphereArray);
    lineMeasurer = new LineMeasurer(mainContainerObj);
    areaMeasurer = new AreaMeasurer(mainContainerObj);
    setupEventListeners();
    
    addAxisHelper(new THREE.Vector3(), 1000);
    // addAxisHelper(new THREE.Vector3(), 1000, true);
}

function intersectWithAngledPlane(e, plane) {
    mouse.x = (e.x / window.innerWidth) * 2 - 1;
    mouse.y = -(e.y / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    ray = raycaster.ray;
    
    let distance = ray.distanceToPlane(plane);
        
    if (distance !== null) {
        return ray.origin.clone().add(ray.direction.clone().multiplyScalar(distance)).applyMatrix4(camera.matrixWorld).applyMatrix4(mainContainerObj.matrixWorld.clone().invert());
    } else {
        return null;
    }
    
    // let worldIntersectPos = ray.origin.clone().add(ray.direction.clone().multiplyScalar(-100)).applyMatrix4(camera.matrixWorld).applyMatrix4(mainContainerObj.matrixWorld.clone().invert());
    // let camDir = ray.direction.clone().applyMatrix4(camera.matrixWorld).applyMatrix4(mainContainerObj.matrixWorld.clone().invert()).normalize().negate();
    // addArrowHelper(worldIntersectPos, camDir, 20000, new THREE.Color(0x00ff00)); // todo Steve: somehow all the arrows pass through the origin (0, 0, 0), I think it has smth to do with how the camera is always at the scene origin. Further find out why
    
    // todo Steve: as for now, the most plausible solution (hacky) is to spawn a plane at the 3-points-center location, with its local z axis pointing towards the normal direction calculated by the 3 points
    //  and then use intersectPlane() to get the world position of the intersection, for all the drawPoint()'s after the initial 3 points in the space
    //  or additionally, check out DrawingManager to see how it secures the first 3 points, and then projects all other lines on that surface
    //  specifically, the code below:
    
    // if (this.planePoints.length === 3) { // If plane has been defined
    //     const plane = new THREE.Plane().setFromCoplanarPoints(...this.planePoints.map(p => p.position.clone().applyMatrix4(scene.matrixWorld).applyMatrix4(camera.matrixWorldInverse)));
    //     if (screenRay.distanceToPlane(plane) !== null) {
    //         const planeProjectedPosition = this.screenProject(pointerEvent, screenRay.distanceToPlane(plane) - this.bumpTowardsCamera, camera, scene);
}

// take in a mouse event
// return mainContainerObj local position of the mouse intersection
function intersectWithScenePosition(e) {
    mouse.x = (e.x / window.innerWidth) * 2 - 1; // todo Steve: find out the differences between e.x, e.clientX, and e.pageX
    mouse.y = -(e.y / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    
    ray = raycaster.ray;
    let distance = e.projectedZ;

    return ray.origin.clone().add(ray.direction.clone().multiplyScalar(distance)).applyMatrix4(camera.matrixWorld).applyMatrix4(mainContainerObj.matrixWorld.clone().invert());
    // console.log(intersectedPosition);
    // if (modes.isAddingVertex) {
    //     let sphere = addTestSphere(intersectedPosition.x, intersectedPosition.y, intersectedPosition.z, 0xffff00);
    //     vertexSphereArray.push(sphere);
    // }
}

// take in a mouse event, and an optional array of intersect-able objects
// return the object that mouse intersected with
function intersectWithSceneObjects(e, objects = mainContainerObj) {
    mouse.x = (e.x / window.innerWidth) * 2 - 1;
    mouse.y = -(e.y / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(objects, true);

    if (intersects.length === 0) return null;
    
    return intersects[0].object;
}

function isVector3Valid(v) {
    return isNumberValid(v.x) && isNumberValid(v.y) && isNumberValid(v.z);
}

function isNumberValid(number) {
    return !(isNaN(number) || number === undefined || number === null);
}

// todo Steve: temporarily generate a single global meshline material outside of MeasureLine. But will change it to generate different colors later
const meshLineMaterial = new MeshLineMaterial({
    color: new THREE.Color( 0x00ffff ),
    lineWidth: 10
});

function addTestSphere(x, y, z, color, addToTop = false) {
    let geo = new THREE.SphereGeometry(50, 32, 16);
    let mat = new THREE.ShaderMaterial({
        vertexShader: vertexMesh_vertexShader,
        fragmentShader: vertexMesh_fragmentShader,
        uniforms: {
            camDir: {value: userInterfaceCamDir}
        }
    });
    let sphere = new THREE.Mesh(geo, mat);
    sphere.position.set(x, y, z);

    if (addToTop) {
        scene.add(sphere);
    } else {
        mainContainerObj.add(sphere);
    }
    return sphere;
}

function addArrowHelper(origin, direction, length, color, addToTop = false) {
    let arrow = new THREE.ArrowHelper(direction.clone().normalize(), origin.clone(), length, color);
    if (addToTop) {
        scene.add(arrow);
    } else {
        mainContainerObj.add(arrow);
    }
    return arrow;
}

function addAxisHelper(position, size, addToTop = false) {
    let axis = new THREE.AxesHelper(size);
    axis.position.copy(position);
    if (addToTop) {
        scene.add(axis);
    } else {
        mainContainerObj.add(axis);
    }
    return axis;
}

function addTestCube(x, y, z, color, addToTop = false) {
    let geo = new THREE.BoxGeometry(200, 400, 200);
    let mat = new THREE.MeshStandardMaterial({
        transparent: true,
        color: color,
        opacity: 0.8,
    });
    let cube = new THREE.Mesh(geo, mat);
    cube.position.set(x, y, z);

    if (addToTop) {
        scene.add(cube);
    } else {
        mainContainerObj.add(cube);
    }
    return cube;
}

function customTouchDecider(e) {
    if (!this.camera) {
        return false;
    }
    //1. sets the mouse position with a coordinate system where the center
    //   of the screen is the origin
    this.mouse.x = (e.x / window.innerWidth) * 2 - 1;
    this.mouse.y = -(e.y / window.innerHeight) * 2 + 1;

    //2. set the picking ray from the camera position and mouse coordinates
    this.raycaster.setFromCamera(this.mouse, this.camera);

    //3. compute intersections
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    
    
    
    return intersects.length > 0;
}

const childNodes = document.getElementById('button-container').children;
const buttons = Array.from(childNodes);

// default mode is measuring length of a line
let modes = {
    isEditing: false,
    isAddingVertex: false,
    isMeasuringLength: false,
    isMeasuringArea: true,
    isMeasuringVolume: false,
}

function setupEventListeners() {
    window.addEventListener('resize', () => {
        cssRenderer.setSize(window.innerWidth, window.innerHeight);
    })
    
    buttons.forEach((button) => {
            button.addEventListener('pointerup', e => {
                e.stopPropagation();
            })
        }
    )

    buttons.forEach((button) => {
            button.addEventListener('pointerdown', e => {
                e.stopPropagation();
                resetButtonsToInactive();
                resetModesToFalse();
            })
        }
    )
    
    document.addEventListener('pointerdown', (e) => {
        if (e.button === 0) {
            if (translateControls.isActive) return;
            intersectWithScenePosition(e);
        }
    })

    let editModeButton = document.getElementById('edit-mode-button');
    if (modes.isEditing) {
        translateControls.activate();
        editModeButton.classList.add('button-active');
        
        lineMeasurer.deactivate();
        areaMeasurer.deactivate();
    }
    
    editModeButton.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        if (!translateControls) return;
        if (translateControls.isActive) {
            translateControls.deactivate();
            editModeButton.classList.remove('button-active');
            
            lineMeasurer.deactivate();
            areaMeasurer.deactivate();
        } else {
            translateControls.activate();
            editModeButton.classList.add('button-active');

            lineMeasurer.deactivate();
            areaMeasurer.deactivate();
        }
    });
    
    let measureLengthButton = document.getElementById('measure-length-button');
    if (modes.isMeasuringLength) {
        lineMeasurer.activate();
        measureLengthButton.classList.add('button-active');

        areaMeasurer.deactivate();
        translateControls.deactivate();
    }
    
    measureLengthButton.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        if (lineMeasurer.isActive) {
            lineMeasurer.deactivate();
            measureLengthButton.classList.remove('button-active');

            areaMeasurer.deactivate();
            translateControls.deactivate();
        } else {
            lineMeasurer.activate();
            measureLengthButton.classList.add('button-active');

            areaMeasurer.deactivate();
            translateControls.deactivate();
        }
    })
    
    let measureAreaButton = document.getElementById('measure-area-button');
    if (modes.isMeasuringArea) {
        areaMeasurer.activate();
        areaMeasurer.allowVolume = false;
        measureAreaButton.classList.add('button-active');

        lineMeasurer.deactivate();
        translateControls.deactivate();
    }

    measureAreaButton.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        if (areaMeasurer.isActive) {
            areaMeasurer.deactivate();
            areaMeasurer.allowVolume = false;
            measureAreaButton.classList.remove('button-active');

            lineMeasurer.deactivate();
            translateControls.deactivate();
        } else {
            areaMeasurer.activate();
            areaMeasurer.allowVolume = false;
            measureAreaButton.classList.add('button-active');

            lineMeasurer.deactivate();
            translateControls.deactivate();
        }
    })
    
    let discreteAreaButton = document.getElementById('discrete-area-button');
    discreteAreaButton.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        areaMeasurer.enterDiscreteMode();
    })
    discreteAreaButton.addEventListener('pointerup', (e) => {
        e.stopPropagation();
    })

    let continuousAreaButton = document.getElementById('continuous-area-button');
    continuousAreaButton.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        areaMeasurer.enterContinuousMode();
    })
    continuousAreaButton.addEventListener('pointerup', (e) => {
        e.stopPropagation();
    })

    let measureVolumeButton = document.getElementById('measure-volume-button');
    if (modes.isMeasuringVolume) {
        areaMeasurer.activate();
        areaMeasurer.allowVolume = true;
        measureVolumeButton.classList.add('button-active');

        lineMeasurer.deactivate();
        translateControls.deactivate();
    }

    measureVolumeButton.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        if (areaMeasurer.allowVolume) {
            areaMeasurer.allowVolume = false;
            measureVolumeButton.classList.remove('button-active');

            lineMeasurer.deactivate();
            translateControls.deactivate();
        } else {
            areaMeasurer.allowVolume = true;
            measureVolumeButton.classList.add('button-active');

            lineMeasurer.deactivate();
            translateControls.deactivate();
        }
    })
}

function resetButtonsToInactive() {
    buttons.forEach(button => {
        button.classList.remove('button-active');
    });
}

function resetModesToFalse() {
    for (let isActive in Object.values(modes)) {
        isActive = false;
    }
}
