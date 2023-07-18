const MIN_VERTEX_COUNT = 3;
const CURVE_POINT_DIVISION = 500;

class AreaMeasurer {
    constructor(mainContainerObj) {
        this.mainContainerObj = mainContainerObj;

        this.isActive = false;
        
        this.minimumUpdate = {
            distance: 5,
            time: 300
        };
        this.maximumUpdate = {
            distance: 500
        };
        
        this.allowVolume = false;
        this.firstVolumeY = null;
        this.volumeHeight = 0;
        this.volumeMesh = null;
        this.volumeWireframeMesh = null;
        
        this.mode = { // default is discrete mode, define the area with straight line polygon
            discrete: true,
            continuous: false,
            volume: false,
        };
        
        this.justClicked = false;

        this.firstPos = null;
        this.lastPos = null;
        this.lastPointTime = null;
        this.line = null;
        this.vertexCount = 0;
        this.vertexArray = [];
        this.vertexPositionArray = [];
        this.y = null;
        this.intersectedObject = null;
        
        this.finalPosition = null;
        
        this.setupEventListeners();

        this.matGreenTransparent = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.4,
        });
        this.matWireframe = new THREE.MeshBasicMaterial({
            wireframe: true
        });
    }

    activate() {
        this.isActive = true;
    }

    deactivate() {
        this.isActive = false;
    }
    
    enterDiscreteMode() {
        this.mode.discrete = true;
        this.mode.continuous = false;
        this.mode.volume = false;
    }

    enterContinuousMode() {
        this.mode.discrete = false;
        this.mode.continuous = true;
        this.mode.volume = false;
    }

    setupEventListeners() {
        document.addEventListener('pointerdown', function(e) {
            if (!this.isActive) return;
            if (e.button === 0) {
                this.drawPoint(e);
                this.justClicked = true;
            }
        }.bind(this));

        document.addEventListener('pointermove', function(e) {
            if (!this.isActive) return;
            if (this.mode.volume) {
                this.updateVolume(e)
            } else {
                this.updateArea(e);
            }
        }.bind(this));
        
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Backspace') {
                console.log('backspace pressed');
            }
        }.bind(this));
        
        setInterval(() => {
            if (this.line !== null) {
                console.log(this.line.points.length);
            }
        }, 10);
    }

    updateVolume(e) {
        if (this.firstVolumeY === null) {
            this.firstVolumeY = e.clientY;
            return;
        } else {
            this.volumeHeight = 10 * (e.clientY - this.firstVolumeY);
        }

        if (this.volumeMesh !== null) {
            this.volumeMesh.geometry.dispose();
            this.volumeMesh.material.dispose();
            this.volumeMesh.parent.remove(this.volumeMesh);
        }
        
        let volumePointArrayBase = [...this.vertexPositionArray];
        let volumePointArrayTop = [];
        let length = volumePointArrayBase.length;
        let v4 = this.vertexArray[0].position.clone().applyMatrix4(camera.matrixWorldInverse);
        let v5 = this.vertexArray[1].position.clone().applyMatrix4(camera.matrixWorldInverse);
        let v6 = this.vertexArray[2].position.clone().applyMatrix4(camera.matrixWorldInverse);
        let plane2 = new THREE.Plane().setFromCoplanarPoints(v4, v5, v6);
        // todo Steve: after passing userInterface three js scene camera into the data flow, add a function to check where is the camera compared to the plane
        //  If the plane normal direction is on the opposite side of the camera, flip the normal direction to aligns with the camera's side.
        //  b/c based on different ways of clicking points to form the plane, the plane's normal can have opposite directions
        let heightVector = plane2.normal.clone().multiplyScalar(this.volumeHeight);
        for (let i = 0; i < length; i += 3) {
            volumePointArrayTop.push(volumePointArrayBase[i] + heightVector.x);
            volumePointArrayTop.push(volumePointArrayBase[i + 1] + heightVector.y);
            volumePointArrayTop.push(volumePointArrayBase[i + 2] + heightVector.z);
        }
        // console.log(volumePointArrayBase, volumePointArrayTop)

        let geometry = new THREE.BufferGeometry();
        let positionAttribute = new THREE.BufferAttribute(new Float32Array([...volumePointArrayBase, ...volumePointArrayTop]), 3);
        geometry.setAttribute('position', positionAttribute);
        let triangles = Earcut.triangulate([...volumePointArrayBase, ...volumePointArrayTop], [], 3);
        // let indexAttribute = new THREE.Uint16BufferAttribute(triangles, 1);
        // geometry.setIndex(indexAttribute);
        // todo Steve: calculate the index numbers for all the faces
        console.log(volumePointArrayBase.length / 3);
        let trianglesBase = Earcut.triangulate(volumePointArrayBase, [], 3);
        let trianglesTop = [...trianglesBase];
        trianglesTop = trianglesTop.map(index => index + length / 3);
        console.log(trianglesBase, trianglesTop);
        let trianglesMiddle = [];
        for (let i = 0; i < trianglesBase.length; i++) {
            if (i === trianglesBase.length - 1) {
                trianglesMiddle.push(trianglesBase[i], trianglesBase[0], trianglesTop[0]);
                trianglesMiddle.push(trianglesTop[0], trianglesTop[i], trianglesBase[i]);
                continue;
            }
            trianglesMiddle.push(trianglesBase[i], trianglesBase[i + 1], trianglesTop[i + 1]);
            trianglesMiddle.push(trianglesTop[i + 1], trianglesTop[i], trianglesBase[i]);
        }
        console.log(trianglesMiddle);
        let indices = [...trianglesBase, ...trianglesTop, ...trianglesMiddle];
        geometry.setIndex(indices);
        
        this.volumeMesh = new THREE.Mesh(geometry, this.matGreenTransparent);
        this.mainContainerObj.add(this.volumeMesh);

        if (this.volumeWireframeMesh !== null) {
            this.volumeWireframeMesh.geometry.dispose();
            this.volumeWireframeMesh.material.dispose();
            this.volumeWireframeMesh.parent.remove(this.volumeWireframeMesh);
        }
        this.volumeWireframeMesh = new THREE.Mesh(geometry, this.matWireframe);
        this.mainContainerObj.add(this.volumeWireframeMesh);
    }

    drawPoint(e) {
        if (this.mode.volume) { // when drawing a volume
            
            this.mode.volume = false;
            
            this.lastVolumeY = null;
            this.volumeHeight = 0;
            this.volumeMesh = null;
            this.volumeWireframeMesh = null;
            this.vertexArray = [];
            this.vertexPositionArray = [];
            
            return;
        }
        
        if (this.intersectedObject === null) { // when drawing NOT volume but area, and there is NOT an intersected vertex
            let isCalledFromUpdateLine = e.isVector3;
            let intersectedPosition = null;
            if (isCalledFromUpdateLine) { // account for calling this.drawPoint(e) within this.updateLine(e) function to automatically add vertex points after a distance
                intersectedPosition = e.clone();
            } else {
                intersectedPosition = intersectWithScenePosition(e);
            }
            if (!isVector3Valid(intersectedPosition)) return;
            
            if (this.lastPos === null) {
                // this.y = intersectedPosition.y;
                
                // add the first vertex sphere, add to vertexArray
                // initialize the line
                // set this.lastPos object with corresponding vertexSphere
                // increase vertex count
                let sphere = addTestSphere(intersectedPosition.x, intersectedPosition.y, intersectedPosition.z, 0xffff00);
                this.vertexArray = [];
                this.vertexArray.push(sphere);
                // todo Steve: add to global vertexSphereArray support
                this.lastPos = {
                    position: new THREE.Vector3(intersectedPosition.x, intersectedPosition.y, intersectedPosition.z),
                    mesh: sphere,
                }

                this.firstPos = {
                    position: new THREE.Vector3(intersectedPosition.x, intersectedPosition.y, intersectedPosition.z),
                    mesh: sphere,
                }
                
                this.line = {
                    // points: [new THREE.Vector3(intersectedPosition.x, intersectedPosition.y, intersectedPosition.z)],
                    points: [],
                    meshLine: new MeshLine(),
                    obj: null
                }
                
                this.vertexCount++;
            } else {
                // add the next vertex sphere, add to vertexArray
                // update the line
                // set this.lastPos object with corresponding vertexSphere
                // increase vertex count
                
                
                let sphere = addTestSphere(intersectedPosition.x, intersectedPosition.y, intersectedPosition.z, 0xffff00);
                this.vertexArray.push(sphere);

                this.lastPos = {
                    position: new THREE.Vector3(intersectedPosition.x, intersectedPosition.y, intersectedPosition.z),
                    mesh: sphere,
                }

                if (!isCalledFromUpdateLine) { // to avoid infinite loop of calling this.updateLine() and this.drawPoint() back & forth
                    this.updateLine(intersectedPosition.x, intersectedPosition.y, intersectedPosition.z);
                }

                this.vertexCount++;
            }
        } else { // when drawing area, and there is an intersected vertex
            if (this.vertexCount < MIN_VERTEX_COUNT) {
                console.error('%c From drawPoint: Not enough vertices to form a region. Add more vertices.', 'color: red');
                return;
            } else {
                let intersectedObjectPosition = this.intersectedObject.position;
                // todo Steve: update this.lastPos here, in order to avoid dead loop calling between this.updateLine() and this.drawPoint()
                //  and then check if isCalledFromUpdateLine. If false, then run this.updateLine(), otherwise continue to the next section
                // update the mesh line
                // initialize the three.shape corresponding mesh
                // set this.lastPos, this.line, this.vertexCount, this.vertexArray, and this.y back to null / 0
                
                // this.updateLine(intersectedObjectPosition.x, this.y, intersectedObjectPosition.z);
                // todo Steve: don't run below function to prevent dead loop calling drawPoint() and updateLine() back and forth
                // this.updateLine(intersectedObjectPosition.x, intersectedObjectPosition.y, intersectedObjectPosition.z);
                
                let geometry = new THREE.BufferGeometry();
                this.vertexPositionArray = [];
                // this.line.points.splice(1, 1);
                // todo Steve: somehow there's one extra point added to the points array... Get rid of it!
                console.log(`%c ${this.line.points.length}`, 'color: red');
                for (let i = 0; i < this.line.points.length; i++) {
                    this.vertexPositionArray.push(this.line.points[i].x);
                    this.vertexPositionArray.push(this.line.points[i].y);
                    this.vertexPositionArray.push(this.line.points[i].z);
                }
                let positionAttribute = new THREE.BufferAttribute(new Float32Array(this.vertexPositionArray), 3);
                geometry.setAttribute('position', positionAttribute);
                let triangles = Earcut.triangulate(this.vertexPositionArray, [], 3);
                let indexAttribute = new THREE.Uint16BufferAttribute(triangles, 1);
                geometry.setIndex(indexAttribute);
                
                let mesh = new THREE.Mesh(geometry, this.matGreenTransparent);
                this.mainContainerObj.add(mesh);

                // add measurement area text
                let div1 = document.createElement('div');
                div1.classList.add('measurement-text');
                div1.style.background = 'rgb(0,255,255)';
                div1.innerHTML = `area m<sup>2</sup>`;
                let divObj = new CSS3DObject(div1);
                // divObj.position.copy(this.finalPosition);
                divObj.rotation.x = -Math.PI / 2;
                this.mainContainerObj.add(divObj);

                this.firstPos = null;
                this.lastPos = null;
                this.lastPointTime = null;
                this.line = null;
                this.vertexCount = 0;
                // this.vertexArray = [];
                this.y = null;
                this.intersectedObject = null;

                // todo Steve: handle the volume mode cleaner
                if (this.allowVolume) {
                    this.mode.volume = true;
                } else {
                    this.mode.volume = false;
                }
            }
        }
    }

    updateArea(e) {
        this.intersectedObject = intersectWithSceneObjects(e, this.vertexArray);
        
        if (this.intersectedObject !== null) {
            if (this.vertexCount < MIN_VERTEX_COUNT) {
                console.log('%c From updateLine: Not enough vertices to form a region. Add more vertices.', 'color: red');
            } else {
                // add a circle besides the cursor, to indicate that can form a closed loop
                console.log('%c should draw a circle next to the cursor to indicate closed loop', 'color: blue');
            }
            return;
        }
        
        let intersectedPosition = intersectWithScenePosition(e);
        
        // if (this.intersectedObject !== null) {
        //     let offset = this.intersectedObject.position.clone().sub(intersectedPosition);
        //     console.log(offset.x, offset.y, offset.z);
        //     return;
        // }
        
        if (!isVector3Valid(intersectedPosition)) return;
        // update the mesh line to include more points

        if (this.lastPos === null) return;

        if (this.vertexCount >= MIN_VERTEX_COUNT) {
            let v1 = this.vertexArray[0].position.clone().applyMatrix4(this.mainContainerObj.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
            let v2 = this.vertexArray[1].position.clone().applyMatrix4(this.mainContainerObj.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
            let v3 = this.vertexArray[2].position.clone().applyMatrix4(this.mainContainerObj.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
            let plane = new THREE.Plane().setFromCoplanarPoints(v1, v2, v3);
            this.plane = plane;
            let intersectedPlanePosition = intersectWithAngledPlane(e, plane);
            if (intersectedPlanePosition !== null) {
                this.updateLine(intersectedPlanePosition.x, intersectedPlanePosition.y, intersectedPlanePosition.z);
                return;
            }
        }
        this.updateLine(intersectedPosition.x, intersectedPosition.y, intersectedPosition.z);
    }
    
    updateLine(x, y, z) { // called after the first point has been established. Updates lastPointTime, update all the info about the line, delete & re-add the line in the scene
        this.lastPointTime = Date.now();
        let intersectedPosition = new THREE.Vector3(x, y, z);
        // todo Steve: the logic below has a bug: it accidentally creates an extra this.line.point after initially creating a point in the space, and as soon as mouse cursor leaves the point, it creates this extra point
        //  need to adjust it to prevent this extra point from being added
        if (this.mode.discrete) {
            if (this.justClicked) {
                this.justClicked = false;
            } else {
                this.line.points.pop();
            }
            // if (this.line.points.length === 1) return;
            this.line.points.push(intersectedPosition.clone()); // todo Steve: when drawing on a curved surface, after securing a plane, NEED to re-position (projection mapping) all the meshline points drawn before securing this plane ON THIS PLANE !!!
            this.line.meshLine.setPoints(this.line.points);
        } else {
            if (intersectedPosition.clone().sub(this.lastPos.position).length < this.minimumUpdate.distance && Date.now() - this.lastPointTime < this.minimumUpdate.time) {
                return;
            }
            
            // after the curve head has been travelled for a distance, automatically draw a point
            if (intersectedPosition.clone().sub(this.lastPos.position).length() > this.maximumUpdate.distance) {
                this.drawPoint(new THREE.Vector3(x, y, z));
            }
            
            this.line.points.push(intersectedPosition.clone()); // todo Steve: note that this way, when we change a vertex, we must somehow find a mapping between vertex index and the line points, and then update the line
            const curve = new THREE.CatmullRomCurve3(this.line.points);
            // this.line.points = curve.getPoints(CURVE_POINT_DIVISION);
            // this.line.meshLine.setPoints(this.line.points);
            this.line.meshLine.setPoints(curve.getPoints(CURVE_POINT_DIVISION));
        }
        if (this.line.obj !== null) {
            this.line.obj.geometry.dispose();
            this.line.obj.material.dispose();
            this.line.obj.parent.remove(this.line.obj);
        }
        this.line.obj = new THREE.Mesh(this.line.meshLine, meshLineMaterial);
        this.mainContainerObj.add(this.line.obj);
    }
}
