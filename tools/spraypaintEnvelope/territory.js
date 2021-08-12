import * as THREE from 'https://unpkg.com/three@0.126.1/build/three.module.js';

window.territory = {};

(function(exports) {

    let spatialInterface, rendererWidth, rendererHeight;
    let camera, scene, renderer;
    let containerObj, groundPlaneContainerObj, mesh, cameraShadowGroup, defaultPin, shadowGroup, pathMesh;
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
    let defaultScale = 1;
    let isRadiusOccupied = false;
    let lastComputedScale = undefined;
    let lastComputedShape = undefined;
    let lastModelMatrix = undefined;
    
    const planeSize = 5000;
    let pointsInProgress = [];

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
        
        cameraShadowGroup = new THREE.Group();
        let cameraShadowMesh = new THREE.Mesh( new THREE.BoxGeometry( 100, 100, 100 ), new THREE.MeshBasicMaterial( {color: 0x00ffff} ) );
        cameraShadowGroup.add(cameraShadowMesh);
        groundPlaneContainerObj.add(cameraShadowGroup);

        shadowGroup = new THREE.Group();

        const gridSize = planeSize;
        const divisions = planeSize / 1000;
        const colorCenterLine = new THREE.Color(0, 1, 1);
        const colorGrid = new THREE.Color(0, 1, 1);
        let gridHelper = new THREE.GridHelper( gridSize, divisions, colorCenterLine, colorGrid );
        shadowGroup.add(gridHelper);
        
        let planeGeometry = new THREE.PlaneGeometry(planeSize, planeSize);
        let planeMaterial = new THREE.MeshBasicMaterial( {color: 0xff0000} ); //, transparent:true, opacity:0.5} );
        let planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
        planeMesh.rotation.x = -Math.PI / 2;
        planeMesh.visible = false;
        planeMesh.name = 'planeMesh';
        shadowGroup.add( planeMesh );

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
    
    function updateGroundplane(modelView, projection) {
        if (isProjectionMatrixSet && modelView && modelView.length === 16) {
            setMatrixFromArray(groundPlaneContainerObj.matrix, modelView);

            // let groundPlaneCoordinates = new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z);    // world coordinates
            // groundPlaneContainerObj.worldToLocal(groundPlaneCoordinates);   // convert to ground plane coordinates

            let meshCoordinates = new THREE.Vector3(mesh.position.x, mesh.position.y, mesh.position.z);    // world coordinates
            mesh.localToWorld(meshCoordinates);
            groundPlaneContainerObj.worldToLocal(meshCoordinates);   // convert to ground plane coordinates

            shadowGroup.position.set(meshCoordinates.x, 0, meshCoordinates.z);
            
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
    
    function getShapeCenter() {
        if (!isShapeDefined()) { return {x: 0, y: 0}; }
        
        let sumX = 0;
        let sumY = 0;
        let sumZ = 0;

        let shape = JSON.parse(lastComputedShape);
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
    
    function getShapeRadius() {
        let center = getShapeCenter();
        let shape = JSON.parse(lastComputedShape);
        let maxRadius = 0;
        shape.forEach(function(point) {
            let diff = { x: point.x - center.x, y: point.y - center.y, z: point.z - center.z };
            let thisRadius = Math.sqrt(diff.x * diff.x + diff.y * diff.y + diff.z * diff.z);
            if (thisRadius > maxRadius) { maxRadius = thisRadius; }
        });
        return maxRadius;
    }
    
    function onSceneRendered() {
        if (!isShapeDefined()) { return; }
        
        // calculate distance in world coordinates
        // let shadowGroupCoordinates = new THREE.Vector3(shadowGroup.position.x, shadowGroup.position.y, shadowGroup.position.z);    // world coordinates
        // shadowGroup.parent.localToWorld(shadowGroupCoordinates);

        let cameraCoordinates = new THREE.Vector3(cameraShadowGroup.position.x, cameraShadowGroup.position.y, cameraShadowGroup.position.z);    // world coordinates
        cameraShadowGroup.parent.localToWorld(cameraCoordinates);
        // shadowGroup.parent.worldToLocal(cameraCoordinates);   // convert to ground plane coordinates

        // console.log(getShapeCenter());

        // calculate using even-odd rule
        let hullPoints = JSON.parse(lastComputedShape).map(function(point) {
            let worldCoords = new THREE.Vector3(point.x, point.y, point.z);    // world coordinates
            shadowGroup.localToWorld(worldCoords);
            // return [point.x + shadowGroupCoordinates.x, point.z + shadowGroupCoordinates.z];
            return [worldCoords.x, worldCoords.z];
        });
        let isInside = checkPointConcave(cameraCoordinates.x, cameraCoordinates.z, hullPoints);
        // let isInside = checkPointConvex(cameraCoordinates.x, cameraCoordinates.z, hullPoints);
        // console.log('isInside', isInside);

        if (isInside) {
            mesh.rotation.z += 0.03; // make it spin
        }

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
        
        // let shapeCenter = getShapeCenter();
        // let shapeCenterCoordinates = new THREE.Vector3(shapeCenter.x, shapeCenter.y, shapeCenter.z);
        // pathMesh.parent.localToWorld(shapeCenterCoordinates);
        //
        // let distance = shapeCenterCoordinates.distanceTo(cameraCoordinates);
        // // console.log(distance);
        //
        // // let scaledRadius = (radius * lastComputedScale / defaultScale) || radius;
        // let scaledRadius = getShapeRadius();
        //
        // if (isRadiusOccupied && distance > scaledRadius) {
        //     isRadiusOccupied = false;
        //     callbacks.onOccupancyChanged.forEach(function(callback) {
        //         callback(false);
        //     });
        // } else if (!isRadiusOccupied && distance < scaledRadius) {
        //     isRadiusOccupied = true;
        //     callbacks.onOccupancyChanged.forEach(function(callback) {
        //         callback(true);
        //     });
        // }

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
        var intersects = raycaster.intersectObjects( scene.children, true );
        
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
    
    let shape = [];
    
    function loadShapeData(points) {
        console.log('load shape data', points);
        shape = JSON.parse(JSON.stringify(points));
        
        updatePathMesh(shape, 1.0);
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

        pathMesh = window.pathToMesh(scaledShapePath);
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

    function pointerDown(_screenX, _screenY) {
        console.log('pointerDown in territory')
        pointsInProgress = [];
    }

    function pointerMove(screenX, screenY) {
        console.log('pointerMove in territory')

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
            pointsInProgress.push({
                x: (planeIntersect.uv.x - 0.5) * planeSize, // times (dScale between draw time and now)
                y: 0,
                z: -1 * (planeIntersect.uv.y - 0.5) * planeSize
            });
            
            updatePathMesh(pointsInProgress, 1);
        }
    }

    function pointerUp(_screenX, _screenY) {
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

    function checkPointConvex(x, y, hull) {
        let isInAnyTriangle = false;
        let pt0 = hull[0];
        for (let i = 1; i < hull.length - 1; i++) {
            let pt1 = hull[i];
            let pt2 = hull[i+1];

            // check if x,y is within the triangle [pt0, pt1, pt2]
            if (isPointWithinTriangle(x, y, pt0[0], pt0[1], pt1[0], pt1[1], pt2[0], pt2[1])) {
                isInAnyTriangle = true;
            }
        }
        return isInAnyTriangle;
    }

    function isPointWithinTriangle(x, y, x1, y1, x2, y2, x3, y3) {
        /* Calculate area of triangle ABC */
        let A = triangleArea (x1, y1, x2, y2, x3, y3);

        /* Calculate area of triangle PBC */
        let A1 = triangleArea (x, y, x2, y2, x3, y3);

        /* Calculate area of triangle PAC */
        let A2 = triangleArea (x1, y1, x, y, x3, y3);

        /* Calculate area of triangle PAB */
        let A3 = triangleArea (x1, y1, x2, y2, x, y);

        /* Check if sum of A1, A2 and A3 is same as A */
        return (A === A1 + A2 + A3);
    }

    function triangleArea(x1, y1, x2, y2, x3, y3) {
        return Math.abs((x1*(y2-y3) + x2*(y3-y1)+ x3*(y1-y2))/2.0);
    }

    exports.init = init;
    exports.onLoaded = onLoaded;
    exports.onContentPressed = onContentPressed;
    exports.onOccupancyChanged = onOccupancyChanged;
    exports.loadShapeData = loadShapeData;

    exports.pointerDown = pointerDown;
    exports.pointerMove = pointerMove;
    exports.pointerUp = pointerUp;


})(window.territory);
