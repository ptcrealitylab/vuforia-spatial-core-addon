import * as THREE from 'https://unpkg.com/three@0.126.1/build/three.module.js';
// import { SceneUtils } from 'https://unpkg.com/three@0.126.1/examples/jsm/utils/SceneUtils.js';

window.territory = {};

(function(exports) {

    let spatialInterface, rendererWidth, rendererHeight, includeCylinder;
    let camera, scene, renderer;
    let containerObj, groundPlaneContainerObj, mesh, cameraShadowGroup, defaultPin, shadowGroup, pathMesh, cylinderMesh, gridHelper;

    let raycaster = new THREE.Raycaster();
    let mouse = new THREE.Vector2();
    let isProjectionMatrixSet = false;
    let callbacks = {
        onLoaded: [],
        onContentPressed: [],
        onOccupancyChanged: [],
        onIsEditingChanged: []
    };

    // const radius = 1000;
    // let defaultScale = 1;
    let isRadiusOccupied = false;
    let lastComputedScale = undefined;
    let lastComputedShape = undefined;
    let lastModelMatrix = undefined;
    
    const planeSize = 5000;
    let pointsInProgress = [];

    let isEditingMode = false;
    let isDrawingPointerDown = false;

    let pathDestinationY = 0;
    let floorDestinationOpacity = 0.3;
    let topDestinationBrightness = 0;
    let prevPointerPosition = null;
    let cylinderDestinationOpacity = 0;
    
    const meshColor = 0xfed003;
    
    let lineGeometry;
    let linePoints = [];
    let lineObject;

    function init(spatialInterface_, rendererWidth_, rendererHeight_, parentElement_, includeCylinder_) {
        console.log('init renderer');

        spatialInterface = spatialInterface_;
        rendererWidth = rendererWidth_;
        rendererHeight = rendererHeight_;
        includeCylinder = includeCylinder_;
        
        renderer = new THREE.WebGLRenderer( { alpha: true } );
        renderer.setPixelRatio( window.devicePixelRatio );
        renderer.setSize( rendererWidth, rendererHeight );
        renderer.domElement.id = 'threejsCanvas';
        parentElement_.appendChild( renderer.domElement );
        renderer.domElement.style.position = 'absolute';
        renderer.domElement.style.left = '0';
        renderer.domElement.style.top = '0';

        camera = new THREE.PerspectiveCamera(70, rendererWidth, rendererHeight, 1, 1000);
        scene = new THREE.Scene();
        containerObj = new THREE.Object3D();
        containerObj.matrixAutoUpdate = false;
        scene.add(containerObj);

        // let geometry = new THREE.BoxBufferGeometry(250, 250, 250);
        let geometry = new THREE.BoxBufferGeometry(200, 200, 200);
        // let material = new THREE.MeshBasicMaterial({color: 0x00ffff, transparent: true, opacity: 0.7});
        // let material = new THREE.MeshPhongMaterial( { color: 0x00ffff, flatShading: true, vertexColors: THREE.VertexColors, shininess: 0 } );

        // let material = new THREE.MeshStandardMaterial({color: 0x00ffff}); //, transparent: true, opacity: 1.0});
        let material = new THREE.MeshStandardMaterial({color: 0xffffff}); //, transparent: true, opacity: 1.0});

        // var materials = [
        //     new THREE.MeshPhongMaterial( { color: 0xffffff, flatShading: true, vertexColors: THREE.VertexColors, shininess: 0 } ),
        //     new THREE.MeshBasicMaterial( { color: 0x000000, flatShading: true, wireframe: true, transparent: true } )
        // ];
        // mesh = SceneUtils.createMultiMaterialObject( geometry, materials );
        //
        mesh = new THREE.Mesh(geometry, material);
        // mesh.rotation.z = Math.PI / 4;
        // mesh.rotation.x = Math.PI / 4;
        mesh.name = 'handleMesh';
        containerObj.add(mesh);

        groundPlaneContainerObj = new THREE.Object3D();
        groundPlaneContainerObj.matrixAutoUpdate = false;
        scene.add(groundPlaneContainerObj);
        groundPlaneContainerObj.name = 'groundPlaneContainerObj';
        
        cameraShadowGroup = new THREE.Group();
        const SHOW_CAMERA_SHADOW = false;
        if (SHOW_CAMERA_SHADOW) {
            let cameraShadowMesh = new THREE.Mesh( new THREE.BoxGeometry( 100, 100, 100 ), new THREE.MeshBasicMaterial( {color: 0x00ffff} ) );
            cameraShadowGroup.add(cameraShadowMesh);
        }
        groundPlaneContainerObj.add(cameraShadowGroup);

        shadowGroup = new THREE.Group();

        const gridSize = planeSize;
        const divisions = planeSize / 500;
        const colorCenterLine = new THREE.Color(1, 1, 1);
        const colorGrid = new THREE.Color(1, 1, 1);
        gridHelper = new THREE.GridHelper( gridSize, divisions, colorCenterLine, colorGrid );
        gridHelper.visible = false; // because defaults to not being in editing mode
        shadowGroup.add(gridHelper);
        
        let planeGeometry = new THREE.PlaneGeometry(planeSize, planeSize);
        let planeMaterial = new THREE.MeshBasicMaterial( {color: 0xff0000} ); //, transparent:true, opacity:0.5} );
        let planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
        planeMesh.rotation.x = -Math.PI / 2;
        planeMesh.visible = false;
        planeMesh.name = 'planeMesh';
        shadowGroup.add( planeMesh );

        let geometrycube = new THREE.BoxGeometry( 30, 10, 30 );
        let materialcube = new THREE.MeshBasicMaterial( {color: 0xffffff} );
        defaultPin = new THREE.Mesh( geometrycube, materialcube );  // white
        shadowGroup.add( defaultPin );
        defaultPin.position.set(0, 0, 0);
        // let material1 = new THREE.MeshBasicMaterial( {color: 0xff0000} );
        // let material2 = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
        // let material3 = new THREE.MeshBasicMaterial( {color: 0x0000ff} );
        // let cube_z = new THREE.Mesh( geometrycube, material2 ); // green
        // let cube_y = new THREE.Mesh( geometrycube, material3 ); // blue
        // let cube_x = new THREE.Mesh( geometrycube, material1 );  // red
        // shadowGroup.add( cube_x );
        // shadowGroup.add( cube_z );
        // shadowGroup.add( cube_y );
        // cube_x.position.set(50, 0, 0);
        // cube_y.position.set(0, 50, 0);
        // cube_z.position.set(0, 0, 50);
        // cube_y.name = 'cube_y';
        // cube_z.name = 'cube_z';
        // cube_x.name = 'cube_x';
        groundPlaneContainerObj.add(shadowGroup);

        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0xffffff
        });

        linePoints = [];
        linePoints.push( new THREE.Vector3( 0, 0, 0 ) );
        linePoints.push( new THREE.Vector3( 0, 1000, 0 ) );

        lineGeometry = new THREE.BufferGeometry().setFromPoints( linePoints );

        lineObject = new THREE.Line( lineGeometry, lineMaterial );
        shadowGroup.add( lineObject );

        // let path = [];
        // let numPoints = 10;
        // for (let theta = 0; theta < 2 * Math.PI; theta += (2*Math.PI) / numPoints) {
        //     path.push( {x: radius * Math.cos(theta), y: 0, z: radius * Math.sin(theta)} );
        // }
        // path.push({x: radius * Math.cos(0), y: 0, z: radius * Math.sin(0)}); // end where you started
        // pathMesh = window.pathToMesh(path);
        // shadowGroup.add(pathMesh);
        
        // updatePathMesh(1);

        // light the scene with a combination of ambient and directional white light
        var ambLight = new THREE.AmbientLight(0xaaaaaa);
        groundPlaneContainerObj.add(ambLight);
        var dirLight1 = new THREE.DirectionalLight(0xaaaaaa, 0.8);
        dirLight1.position.set(0, 5000, 0);
        groundPlaneContainerObj.add(dirLight1);
        var dirLight2 = new THREE.DirectionalLight(0xaaaaaa, 0.5);
        dirLight2.position.set(-100, -100, -100);
        groundPlaneContainerObj.add(dirLight2);

        // spatialInterface.addMatrixListener(renderScene);
        spatialInterface.addGroundPlaneMatrixListener(updateGroundplane);
        spatialInterface.addModelAndViewListener(updateWithModelAndView);
        spatialInterface.registerTouchDecider(touchDecider);
        spatialInterface.setFullScreenOn();
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

            // update line to match height of mesh
            linePoints[1] = new THREE.Vector3( 0, meshCoordinates.y, 0 );
            lineObject.geometry.setFromPoints(linePoints);

            // lineGeometry = new THREE.BufferGeometry().setFromPoints( points );
            // const line = new THREE.Line( lineGeometry, lineMaterial );
            // shadowGroup.add( line );

            let cameraCoordinates = new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z);
            cameraShadowGroup.parent.worldToLocal(cameraCoordinates);

            cameraShadowGroup.position.set(cameraCoordinates.x, 0, cameraCoordinates.z);
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
            // if (lastModelMatrix) {
            //     updatePathMesh(lastModelMatrix[0]);
            // }
            renderer.render(scene, camera);
            onSceneRendered();
        }
    }
    
    function isShapeDefined() {
        return lastComputedShape && JSON.parse(lastComputedShape).length > 2 && pointsInProgress.length === 0;
    }

    function getShapeCenter(shape) {
        let sumX = 0;
        let sumY = 0;
        let sumZ = 0;

        shape.forEach(function(point) {
            sumX += point.x;
            sumY += point.y;
            sumZ += point.z;
        });
        sumX *= 1.0 / shape.length;
        sumY *= 1.0 / shape.length;
        sumZ *= 1.0 / shape.length;

        return {
            x: sumX,
            y: sumY,
            z: sumZ
        };
    }
    
    function onSceneRendered() {
        if (isEditingMode && isDrawingPointerDown && prevPointerPosition) {
            pointerMove(prevPointerPosition.x, prevPointerPosition.y);
        }
        
        if (!isShapeDefined()) { return; }
        
        let cameraCoordinates = new THREE.Vector3(cameraShadowGroup.position.x, cameraShadowGroup.position.y, cameraShadowGroup.position.z);    // world coordinates
        cameraShadowGroup.parent.localToWorld(cameraCoordinates);

        // calculate using even-odd rule
        let hullPoints = JSON.parse(lastComputedShape).map(function(point) {
            let worldCoords = new THREE.Vector3(point.x, point.y, point.z);    // world coordinates
            shadowGroup.localToWorld(worldCoords);
            return [worldCoords.x, worldCoords.z];
        });
        let isInside = checkPointConcave(cameraCoordinates.x, cameraCoordinates.z, hullPoints);

        // if (isInside) {
        //     mesh.rotation.z += 0.03; // make it spin
        // }

        // calculate when the person walks into or out of the shape (only when not in editing mode)
        if (!isEditingMode) {
            if (isRadiusOccupied && !isInside) {
                isRadiusOccupied = false;
                callbacks.onOccupancyChanged.forEach(function(callback) {
                    callback(false);
                });
            } else if (!isRadiusOccupied && isInside) {
                isRadiusOccupied = true;
                callbacks.onOccupancyChanged.forEach(function(callback) {
                    callback(true);
                });
            }
        }
        
        // animate y position of path
        if (isEditingMode) {
            pathDestinationY = 0;
            floorDestinationOpacity = 0.3;
            topDestinationBrightness = 0;
            cylinderDestinationOpacity = 0;
        } else {
            pathDestinationY = 600;
            floorDestinationOpacity = 0;
            topDestinationBrightness = 0.5;
            cylinderDestinationOpacity = 0.4;
        }
        if (pathMesh) {
            let pathMeshY = pathMesh.position.y;
            pathMesh.position.y += (pathDestinationY - pathMeshY) * 0.2;
            
            let floorMesh = pathMesh.getObjectByName('pathFloorMesh');
            let opacity = floorMesh.material.opacity;
            floorMesh.material.opacity += (floorDestinationOpacity - opacity) * 0.2;

            let topMesh = pathMesh.getObjectByName('pathTopMesh');
            let color = {};
            topMesh.material.color.getHSL(color);
            let brightness = color.l;
            brightness += (topDestinationBrightness - brightness) * 0.2;
            topMesh.material.color.setHSL(49/360, 0.99, brightness);
        }
        
        if (includeCylinder) {
            renderCylinderIfNeeded();
        }
    }
    
    function renderCylinderIfNeeded() {
        if (cylinderMesh) {
            // console.log('todo');
            // cylinderMesh.rotation.y += 0.01;

            cylinderMesh.traverse(function(child) {
                if (child && child.material) {
                    let opacity = child.material.opacity;
                    opacity += (cylinderDestinationOpacity - opacity) * 0.05;
                    child.material.opacity = opacity;
                }
            });

        } else if (!isEditingMode) {
            // create a cylinder mesh slightly smaller than the pathMesh but taller
            let shapeData = JSON.parse(lastComputedShape);

            let center = getShapeCenter(shapeData);

            let adjustedShapeData = [];

            shapeData.forEach(function(point) {
                let dx = point.x - center.x;
                let dz = point.z - center.z;
                let r2 = Math.max(Math.sqrt(dx * dx + dz * dz) * 0.5, Math.sqrt(dx * dx + dz * dz) - 200);
                let theta = Math.atan2(dz, dx);

                adjustedShapeData.push({
                    x: center.x + (r2 * Math.cos(theta)),
                    y: point.y,
                    z: center.z + (r2 * Math.sin(theta))
                });
            });

            cylinderMesh = window.pathToMesh(adjustedShapeData, 20, 1500, undefined, 0.1);
            // cylinderMesh.renderOrder = 1;
            shadowGroup.add(cylinderMesh);
        }
    }

    function touchDecider(eventData) {
        // 1. sets the mouse position with a coordinate system where the center
        //    of the screen is the origin
        mouse.x = ( eventData.x / window.innerWidth ) * 2 - 1;
        mouse.y = - ( eventData.y / window.innerHeight ) * 2 + 1;

        // 2. set the picking ray from the camera position and mouse coordinates
        raycaster.setFromCamera( mouse, camera );

        // 3. compute intersections
        var intersects = raycaster.intersectObjects( scene.children, true );
        
        if (intersects.length > 0) {
            callbacks.onContentPressed.forEach(function(callback) {
                callback(intersects);
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
    
    function onIsEditingChanged(callback) {
        callbacks.onIsEditingChanged.push(callback);
    }
    
    function loadShapeData(points) {
        console.log('load shape data', points);
        updatePathMesh(JSON.parse(JSON.stringify(points)), 1.0);
    }

    function updatePathMesh(shape, scale) {
        if (typeof lastComputedShape !== 'undefined' && JSON.stringify(shape) === lastComputedShape) {
            if (typeof lastComputedScale !== 'undefined' && scale.toFixed(3) === lastComputedScale.toFixed(3)) {
                return; // if neither shape or scale has changed, don't recompute the scaled shape path
            }
        }
        if (pathMesh) { 
            shadowGroup.remove(pathMesh);
        }
        let scaledShapePath = shape; // TODO: scale everything up relative to the origin

        pathMesh = window.pathToMesh(scaledShapePath, 50, 50, meshColor, undefined);
        shadowGroup.add(pathMesh);

        lastComputedScale = scale;
        lastComputedShape = JSON.stringify(shape);
    }
    
    function getRaycastIntersects(clientX, clientY) {
        mouse.x = ( clientX / window.innerWidth ) * 2 - 1;
        mouse.y = - ( clientY / window.innerHeight ) * 2 + 1;

        //2. set the picking ray from the camera position and mouse coordinates
        raycaster.setFromCamera( mouse, camera );

        //3. compute intersections
        return raycaster.intersectObjects( scene.children, true );
    }

    function pointerDown(screenX, screenY) {
        if (!isEditingMode) { return; }

        const intersects = getRaycastIntersects(screenX, screenY);
        if (intersects.length > 0) {
            let validNames = ['planeMesh', 'pathTopMesh', 'pathWallMesh', 'pathFloorMesh'];
            if (validNames.includes(intersects[0].object.name)) {
                console.log('pointerDown in territory')
                pointsInProgress = [];
                isDrawingPointerDown = true;
                prevPointerPosition = { x: screenX, y: screenY };
            }
        }
    }
    
    let lastAddedPoint = null;

    function pointerMove(screenX, screenY) {
        if (!isEditingMode) { return; }
        if (!isDrawingPointerDown) { return; }

        // console.log('pointerMove in territory')

        // calculate objects intersecting the picking ray
        const intersects = getRaycastIntersects(screenX, screenY);

        let planeIntersect = null;
        intersects.forEach(function(intersect) {
            if (planeIntersect) { return; }
            // if (intersect.object.geometry.type === 'PlaneGeometry') {
            if (intersect.object.name === 'planeMesh') {
                planeIntersect = intersect;
            }
        });

        if (planeIntersect) {
            let newPoint = {
                x: (planeIntersect.uv.x - 0.5) * planeSize, // times (dScale between draw time and now)
                y: 0,
                z: -1 * (planeIntersect.uv.y - 0.5) * planeSize
            };
            
            if (lastAddedPoint) {
                let dx = (newPoint.x - lastAddedPoint.x);
                let dz = (newPoint.z - lastAddedPoint.z);
                let distance = Math.sqrt(dx * dx + dz * dz);
                if (distance > 5) { // filter out too-close points
                    pointsInProgress.push(newPoint);
                    lastAddedPoint = JSON.parse(JSON.stringify(newPoint));
                    updatePathMesh(pointsInProgress, 1);
                }
            } else {
                pointsInProgress.push(newPoint);
                lastAddedPoint = JSON.parse(JSON.stringify(newPoint));
                updatePathMesh(pointsInProgress, 1);
            }
        }

        prevPointerPosition = { x: screenX, y: screenY };
    }

    function pointerUp(_screenX, _screenY) {
        if (!isEditingMode) { return; }
        if (!isDrawingPointerDown) { return; }

        console.log('pointerUp in territory')
        
        let hullPoints = [];
        pointsInProgress.forEach(function(point) {
            hullPoints.push([point.x, point.z]);
        });

        const concavity = Infinity; // Infinite concavity = convex hull (what we want!)
        let rawHullPath = hull(hullPoints, concavity);
        
        let validHullPath = rawHullPath.map(function(hullPoint) {
            return {
                x: hullPoint[0],
                y: 0,
                z: hullPoint[1]
            };
        });

        updatePathMesh(validHullPath, 1);

        window.storage.write('shape', validHullPath);
        pointsInProgress = [];
        isDrawingPointerDown = false;
        prevPointerPosition = null;
        lastAddedPoint = null;
        if (isEditingMode) {
            toggleEditingMode();
        }
    }

    /**
     * Uses the even-odd rule (https://en.wikipedia.org/wiki/Even–odd_rule) to check if a point is inside the shape.
     * Casts a ray horizontally to the right from this point and counts the number of segment intersections
     * @param {number} x
     * @param {number} y
     * @param {Array.<Array.<number>>} hull - list of points that form the hull [[x1, y1], [x2, y2], ...]
     * @returns {boolean}
     */
    function checkPointConcave(x, y, hull) {
        let evenOddCounter = 0;
        for (let i = 0; i < hull.length; i++) {
            let x1 = hull[i][0];
            let y1 = hull[i][1];
            let x2, y2;
            if (i+1 < hull.length) {
                x2 = hull[i+1][0];
                y2 = hull[i+1][1];
            } else {
                x2 = hull[0][0]; // edge case for last segment
                y2 = hull[0][1];
            }

            if (x1 < x && x2 < x) {
                continue;
            }

            if (y1 < y && y2 > y || y1 > y && y2 < y) {
                evenOddCounter += 1; // intersection between horizontal ray and segment
            }
        }

        return evenOddCounter % 2 === 1;
    }
    
    function setEditingMode(newMode) {
        if (newMode !== isEditingMode) {
            toggleEditingMode();
        }
    }
    
    function tryRemovingCylinder() {
        if (cylinderMesh && cylinderMesh.parent) {
            try {
                let objsToRemove = [];
                cylinderMesh.traverse(function(child) {
                    if (child.material) {
                        child.material.dispose();
                    }
                    if (child.geometry) {
                        child.geometry.dispose();
                    }
                    objsToRemove.push(child);
                });

                objsToRemove.forEach(function(obj) {
                    obj.parent.remove(obj);
                });
                renderer.renderLists.dispose();
            } catch (e) {
                console.warn('error removing cylinder mesh', e);
            }

            if (cylinderMesh.parent) {
                cylinderMesh.parent.remove(cylinderMesh);
            } else {
                scene.remove(cylinderMesh);
            }
            cylinderMesh = null;
        }
    }

    function toggleEditingMode() {
        isEditingMode = !isEditingMode;
        if (isEditingMode) {
            gridHelper.visible = true;
            if (includeCylinder) {
                tryRemovingCylinder();
            }
        } else {
            gridHelper.visible = false;
        }
        callbacks.onIsEditingChanged.forEach(function(callback) {
            callback(isEditingMode);
        });
    }

    exports.init = init;
    exports.onLoaded = onLoaded;
    exports.onContentPressed = onContentPressed;
    exports.onOccupancyChanged = onOccupancyChanged;
    exports.onIsEditingChanged = onIsEditingChanged;
    exports.loadShapeData = loadShapeData;

    exports.pointerDown = pointerDown;
    exports.pointerMove = pointerMove;
    exports.pointerUp = pointerUp;

    exports.toggleEditingMode = toggleEditingMode;
    exports.setEditingMode = setEditingMode;

})(window.territory);
