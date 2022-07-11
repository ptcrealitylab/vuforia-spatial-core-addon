/* global SpatialInterface, ThreejsInterface */

import * as THREE from './three.module.js';
import { FBXLoader } from './jsm/loaders/FBXLoader.js';
// import * as THREE from './resources/js/three/three.module.js';
import Boid from './Boid.js';

const boidCount = 1; // 256;

let mainContainerObj;
let groundPlaneContainerObj;

let spatialInterface;
if (!spatialInterface) {
  spatialInterface = new SpatialInterface();
  spatialInterface.useWebGlWorker();
}

let threejsInterface = new ThreejsInterface(spatialInterface, THREE);
threejsInterface.addPendingLoad();

threejsInterface.onSceneCreated(function onSceneCreated(scene) {
    mainContainerObj = new THREE.Object3D();
    mainContainerObj.matrixAutoUpdate = false;
    mainContainerObj.name = 'mainContainerObj';
    scene.add(mainContainerObj);

    groundPlaneContainerObj = new THREE.Object3D();
    groundPlaneContainerObj.matrixAutoUpdate = false;
    groundPlaneContainerObj.name = 'groundPlaneContainerObj';
    scene.add(groundPlaneContainerObj);

    scene.add(new THREE.Mesh(new THREE.BoxGeometry(50, 50, 50),
                             new THREE.MeshBasicMaterial({color: 0xaa00aa})));

    let containerObj = new THREE.Group();
    containerObj.position.y = 200;
    containerObj.scale.set(10);
    groundPlaneContainerObj.add(containerObj);
    createWorld(containerObj);

    spatialInterface.onSpatialInterfaceLoaded(function() {
        spatialInterface.setVisibilityDistance(100);

        spatialInterface.addGroundPlaneMatrixListener(groundPlaneCallback);
        // whenever we receive new matrices from the editor, update the 3d scene
        spatialInterface.addMatrixListener(function() {
        });

        spatialInterface.setMoveDelay(300);
    });
});

function createWorld(scene) {
    // const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
    // hemiLight.position.set(0, 20, 0);
    // scene.add(hemiLight);

    // const dirLight = new THREE.DirectionalLight(0xffffff);
    // dirLight.position.set(3, 20, 20);
    // dirLight.castShadow = true;
    // dirLight.shadow.camera.top = 25;
    // dirLight.shadow.camera.bottom = -25;
    // dirLight.shadow.camera.left = -25;
    // dirLight.shadow.camera.right = 25;
    // dirLight.shadow.camera.near = 0.1;
    // dirLight.shadow.camera.far = 400;
    // scene.add(dirLight);

    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(400, 400),
        new THREE.MeshPhongMaterial({
            color: 0xffa400,
            depthWrite: true,
        }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -0;
    mesh.receiveShadow = true;
    scene.add(mesh);

    // const fear = new THREE.Mesh(
    //   new THREE.IcosahedronGeometry(5),
    //   new THREE.MeshPhongMaterial({
    //     color: 0x111111,
    //   }),
    // );
    // scene.add(fear);


    const loader = new FBXLoader();
    loader.load('./fbx/ClownFish.fbx', function(obj) {
        obj.traverse(c => {
            if (c.isMesh) {
                c.castShadow = true;
            }
        });

        obj.scale.multiplyScalar(0.2);

        let boids = [];
        for (let i = 0; i < boidCount; i++) {
            boids.push(new Boid(scene, boids, obj, Math.random(), 2 + Math.random(), Math.random()));
        }

        // let prevNow = - 1;
        // function animate(now) {
        //     if (prevNow < 0) {
        //         prevNow = now;
        //     }
        //     let dt = now - prevNow;
        //     prevNow = now;

        //     for (let boid of boids) {
        //         boid.update(dt);
        //     }
        //     window.requestAnimationFrame(animate);
        // }
        // window.requestAnimationFrame(animate);

        // threejsInterface.removePendingLoad();

    });
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
}
