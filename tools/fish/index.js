/* global SpatialInterface, ThreejsInterface */

import * as THREE from './resources/js/three/three.module.js';
import { FBXLoader } from './jsm/loaders/FBXLoader.js';
import Boid from './Boid.js';

// Various threejs and gl proxy support variables
let mainContainerObj;
let groundPlaneContainerObj;
let fishTank;
let spatialInterface;

const boidCount = 2;

let isGroundPlaneFound = false;

if (!spatialInterface) {
    spatialInterface = new SpatialInterface();
    spatialInterface.useWebGlWorker();
}

let threejsInterface = new ThreejsInterface(spatialInterface, THREE);
threejsInterface.addPendingLoad();

threejsInterface.onSceneCreated(function onSceneCreated(scene) {
    // create a parent 3D object to contain all the three js objects
    // we can apply the marker transform to this object and all of its
    // children objects will be affected
    mainContainerObj = new THREE.Object3D();
    mainContainerObj.matrixAutoUpdate = false;
    mainContainerObj.name = 'mainContainerObj';
    scene.add(mainContainerObj);

    groundPlaneContainerObj = new THREE.Object3D();
    groundPlaneContainerObj.matrixAutoUpdate = false;
    groundPlaneContainerObj.name = 'groundPlaneContainerObj';
    scene.add(groundPlaneContainerObj);

    mainContainerObj.add(new THREE.Mesh(new THREE.BoxGeometry(200, 200, 200),
        new THREE.MeshBasicMaterial({color: 0xaa00aa})));

    groundPlaneContainerObj.add(new THREE.Mesh(new THREE.BoxGeometry(200, 200, 200),
        new THREE.MeshBasicMaterial({color: 0xaaaaaa})));

    // light the scene with a combination of ambient and directional white light
    var ambLight = new THREE.AmbientLight(0xaaaaaa);
    scene.add(ambLight);

    spatialInterface.onSpatialInterfaceLoaded(function() {
        spatialInterface.setVisibilityDistance(100);

        spatialInterface.addGroundPlaneMatrixListener(groundPlaneCallback);
        // whenever we receive new matrices from the editor, update the 3d scene
        spatialInterface.addMatrixListener(modelViewCallback);

        spatialInterface.setMoveDelay(300);

        let scale = 1 / 0.02;
        fishTank = new THREE.Group();
        fishTank.position.y = 20 * scale;
        fishTank.scale.set(scale, scale, scale);

        let floor = new THREE.Mesh(
            new THREE.PlaneGeometry(40, 40),
            new THREE.MeshBasicMaterial({
                wireframe: true,
                color: 0x0033aa
            }),
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -20;
        fishTank.add(floor);


        groundPlaneContainerObj.add(fishTank);

        createWorld(fishTank);
    });
});

function levelTank() {
    mainContainerObj.attach(fishTank);
    fishTank.position.set(0, 0, 0);
    groundPlaneContainerObj.attach(fishTank);
    fishTank.rotation.set(0, 0, 0);
}

function setMatrixFromArray(matrix, array) {
    matrix.set(array[0], array[4], array[8], array[12],
        array[1], array[5], array[9], array[13],
        array[2], array[6], array[10], array[14],
        array[3], array[7], array[11], array[15]
    );
}

function groundPlaneCallback(modelViewMatrix, _projectionMatrix) {
    setMatrixFromArray(groundPlaneContainerObj.matrix, modelViewMatrix);
    if (!isGroundPlaneFound) {
        isGroundPlaneFound = true;
    }
}

function modelViewCallback(modelViewMatrix, _projectionMatrix) {
    if (threejsInterface.isProjectionMatrixSet && isGroundPlaneFound) {
        setMatrixFromArray(mainContainerObj.matrix, modelViewMatrix);  // update model view matrix
    }
}

function createWorld(scene) {
    const loader = new FBXLoader();
    loader.load('./fbx/ClownFish.fbx', function(obj) {
        obj.traverse(c => {
            if (c.isMesh) {
                // c.castShadow = true;
            }
        });

        obj.scale.multiplyScalar(0.02);
        // scene.add(obj);
        let boids = [];
        for (let i = 0; i < boidCount; i++) {
            boids.push(new Boid(scene, boids, obj, Math.random(), 2 + Math.random(), Math.random()));
        }

        let prevNow = - 1;
        function animate() {
            let now = Date.now();
            if (prevNow < 0) {
                prevNow = now;
            }
            let dt = now - prevNow;
            prevNow = now;

            for (let boid of boids) {
                boid.update(dt);
            }
        }
        setInterval(animate, 100);

        threejsInterface.removePendingLoad();
    });
}

