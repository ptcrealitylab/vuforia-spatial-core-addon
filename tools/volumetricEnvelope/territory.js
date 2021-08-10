import * as THREE from 'https://unpkg.com/three@0.126.1/build/three.module.js';

window.territory = {};

(function(exports) {

    let spatialInterface, rendererWidth, rendererHeight;
    let camera, scene, renderer;
    let containerObj, groundPlaneContainerObj, mesh, shadowMesh, defaultPin, shadowGroup, pathMesh;
    let pendingLoads = {
        crate: true,
    };
    let raycaster = new THREE.Raycaster();
    let mouse = new THREE.Vector2();
    let isProjectionMatrixSet = false;
    let callbacks = {
        onLoaded: [],
        onContentPressed: [],
        onOccupancyChanged: []
    };
    
    const radius = 1000;
    let defaultScale = 0.25;
    let isRadiusOccupied = false;
    let lastComputedScale = undefined;
    let lastModelMatrix = undefined;

    function init(spatialInterface_, rendererWidth_, rendererHeight_, parentElement_) {
        console.log('init renderer');

        spatialInterface = spatialInterface_;
        rendererWidth = rendererWidth_;
        rendererHeight = rendererHeight_;
        
        renderer = new THREE.WebGLRenderer( { alpha: true } );
        renderer.setPixelRatio( window.devicePixelRatio );
        renderer.setSize( rendererWidth, rendererHeight );
        parentElement_.appendChild( renderer.domElement );
        renderer.domElement.style.position = 'absolute';
        renderer.domElement.style.left = '0';
        renderer.domElement.style.top = '0';

        camera = new THREE.PerspectiveCamera(70, rendererWidth, rendererHeight, 1, 1000);
        scene = new THREE.Scene();
        containerObj = new THREE.Object3D();
        containerObj.matrixAutoUpdate = false;
        scene.add(containerObj);

        let texture = new THREE.TextureLoader().load('textures/crate.gif', function() {
            pendingLoads.crate = false;
        });
        let geometry = new THREE.BoxBufferGeometry(500, 500, 500);
        let material = new THREE.MeshBasicMaterial({map: texture});
        mesh = new THREE.Mesh(geometry, material);
        mesh.position.setZ(50);
        containerObj.add(mesh);

        groundPlaneContainerObj = new THREE.Object3D();
        groundPlaneContainerObj.matrixAutoUpdate = false;
        scene.add(groundPlaneContainerObj);
        groundPlaneContainerObj.name = 'groundPlaneContainerObj';

        shadowGroup = new THREE.Group();

        let geometrycube = new THREE.BoxGeometry( 10, 10, 10 );
        let materialcube = new THREE.MeshBasicMaterial( {color: 0xffffff} );
        defaultPin = new THREE.Mesh( geometrycube, materialcube );  // white
        shadowGroup.add( defaultPin );
        defaultPin.position.set(0, 0, 0);
        let material1 = new THREE.MeshBasicMaterial( {color: 0xff0000} );
        let material2 = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
        let material3 = new THREE.MeshBasicMaterial( {color: 0x0000ff} );
        let cube_z = new THREE.Mesh( geometrycube, material2 ); // green
        let cube_y = new THREE.Mesh( geometrycube, material3 ); // blue
        let cube_x = new THREE.Mesh( geometrycube, material1 );  // red
        shadowGroup.add( cube_x );
        shadowGroup.add( cube_z );
        shadowGroup.add( cube_y );
        cube_x.position.set(50, 0, 0);
        cube_y.position.set(0, 50, 0);
        cube_z.position.set(0, 0, 50);
        cube_y.name = 'cube_y';
        cube_z.name = 'cube_z';
        cube_x.name = 'cube_x';
        groundPlaneContainerObj.add(shadowGroup);

        // let path = [];
        // let numPoints = 10;
        // for (let theta = 0; theta < 2 * Math.PI; theta += (2*Math.PI) / numPoints) {
        //     path.push( {x: radius * Math.cos(theta), y: 0, z: radius * Math.sin(theta)} );
        // }
        // path.push({x: radius * Math.cos(0), y: 0, z: radius * Math.sin(0)}); // end where you started
        // pathMesh = window.pathToMesh(path);
        // shadowGroup.add(pathMesh);
        
        // updatePathMesh(1);

        // spatialInterface.addMatrixListener(renderScene);
        spatialInterface.addGroundPlaneMatrixListener(updateGroundplane);
        spatialInterface.addModelAndViewListener(updateWithModelAndView);
        spatialInterface.registerTouchDecider(touchDecider);
        spatialInterface.setFullScreenOn();
    }
    
    function updatePathMesh(scale) {
        if (typeof lastComputedScale !== 'undefined' && scale === lastComputedScale) {
            return;
        }
        if (pathMesh) {
            shadowGroup.remove(pathMesh);
        }
        let path = [];
        let numPoints = 10;
        let scaledRadius = radius * (scale / defaultScale);
        for (let theta = 0; theta < 2 * Math.PI; theta += (2*Math.PI) / numPoints) {
            path.push( {x: scaledRadius * Math.cos(theta), y: 0, z: scaledRadius * Math.sin(theta)} );
        }
        path.push({x: scaledRadius * Math.cos(0), y: 0, z: scaledRadius * Math.sin(0)}); // end where you started
        pathMesh = window.pathToMesh(path);
        shadowGroup.add(pathMesh);
    }
    
    function updateGroundplane(modelView, projection) {
        if (isProjectionMatrixSet && modelView && modelView.length === 16) {
            setMatrixFromArray(groundPlaneContainerObj.matrix, modelView);

            // let groundPlaneCoordinates = new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z);    // world coordinates
            // groundPlaneContainerObj.worldToLocal(groundPlaneCoordinates);   // convert to ground plane coordinates

            let meshCoordinates = new THREE.Vector3(mesh.position.x, mesh.position.y, mesh.position.z);    // world coordinates
            mesh.localToWorld(meshCoordinates);
            groundPlaneContainerObj.worldToLocal(meshCoordinates);   // convert to ground plane coordinates

            shadowGroup.position.set(meshCoordinates.x, 0, meshCoordinates.z);
        }
    }
    
    function updateWithModelAndView(model, view, projection) {
        lastModelMatrix = model;
        let modelView = [];
        multiplyMatrix(model, view, modelView);
        renderScene(modelView, projection);
    }
    
    function renderScene(modelView, projection) {
        if (!isProjectionMatrixSet && projection && projection.length === 16) {
            setMatrixFromArray(camera.projectionMatrix, projection);
            camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
            isProjectionMatrixSet = true;
        }

        // 10. Every frame, set the position of the containerObj to the modelViewMatrix
        if (isProjectionMatrixSet && modelView && modelView.length === 16) {
            setMatrixFromArray(containerObj.matrix, modelView);
            mesh.rotation.z += 0.01; // make it spin
            if (lastModelMatrix) {
                updatePathMesh(lastModelMatrix[0]);
            }
            renderer.render(scene, camera);
            onSceneRendered();
        }
    }
    
    function onSceneRendered() {
        // calculate distance in world coordinates
        let meshCoordinates = new THREE.Vector3(mesh.position.x, mesh.position.y, mesh.position.z);    // world coordinates
        mesh.parent.localToWorld(meshCoordinates);
        let cameraCoordinates = new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z);    // world coordinates
        camera.localToWorld(cameraCoordinates);

        let distance = meshCoordinates.distanceTo(cameraCoordinates);
        // console.log(distance);

        let scaledRadius = (radius * lastComputedScale / defaultScale) || radius;
        
        if (isRadiusOccupied && distance > scaledRadius) {
            isRadiusOccupied = false;
            callbacks.onOccupancyChanged.forEach(function(callback) {
                callback(false);
            });
        } else if (!isRadiusOccupied && distance < scaledRadius) {
            isRadiusOccupied = true;
            callbacks.onOccupancyChanged.forEach(function(callback) {
                callback(true);
            });
        }

        // if less than radius, change occupied
    }

    function touchDecider(eventData) {
        // 1. sets the mouse position with a coordinate system where the center
        //    of the screen is the origin
        mouse.x = ( eventData.x / window.innerWidth ) * 2 - 1;
        mouse.y = - ( eventData.y / window.innerHeight ) * 2 + 1;

        // 2. set the picking ray from the camera position and mouse coordinates
        raycaster.setFromCamera( mouse, camera );

        // 3. compute intersections
        var intersects = raycaster.intersectObjects( containerObj.children, true );
        
        if (intersects.length > 0) {
            callbacks.onContentPressed.forEach(function(callback) {
                callback();
            });
        }

        return intersects.length > 0;
    }

    // 11. This is just a helper function to set a three.js matrix using an array
    function setMatrixFromArray(matrix, array) {
        matrix.set( array[0], array[4], array[8], array[12],
            array[1], array[5], array[9], array[13],
            array[2], array[6], array[10], array[14],
            array[3], array[7], array[11], array[15]);
    }

    function onLoaded(callback) {
        callbacks.onLoaded.push(callback);
    }

    function onContentPressed(callback) {
        callbacks.onContentPressed.push(callback);
    }
    
    function onOccupancyChanged(callback) {
        callbacks.onOccupancyChanged.push(callback);
    }

    exports.init = init;
    exports.onLoaded = onLoaded;
    exports.onContentPressed = onContentPressed;
    exports.onOccupancyChanged = onOccupancyChanged;

})(window.territory);
