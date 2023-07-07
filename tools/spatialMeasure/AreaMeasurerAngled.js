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
        this.shape = null;
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
                // intersectWithAngledPlane(e);
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
    }

    updateVolume(e) {
        if (this.shape === null) return;
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
        let geometry = new THREE.ExtrudeGeometry(this.shape, {
            depth: this.volumeHeight,
        });
        geometry.center();
        this.volumeMesh = new THREE.Mesh(geometry, this.matGreenTransparent);
        this.volumeMesh.position.copy(this.finalPosition);
        this.volumeMesh.position.y -= this.volumeHeight / 2;
        this.volumeMesh.rotation.x = Math.PI / 2;
        this.mainContainerObj.add(this.volumeMesh);

        if (this.volumeWireframeMesh !== null) {
            this.volumeWireframeMesh.geometry.dispose();
            this.volumeWireframeMesh.material.dispose();
            this.volumeWireframeMesh.parent.remove(this.volumeWireframeMesh);
        }
        this.volumeWireframeMesh = new THREE.Mesh(geometry, this.matWireframe);
        this.volumeWireframeMesh.position.copy(this.finalPosition);
        this.volumeWireframeMesh.position.y -= this.volumeHeight / 2;
        this.volumeWireframeMesh.rotation.x = Math.PI / 2;
        this.mainContainerObj.add(this.volumeWireframeMesh);
    }

    drawPoint(e) {
        if (this.mode.volume) { // when drawing a volume
            
            this.mode.volume = false;
            
            this.shape = null;
            this.lastVolumeY = null;
            this.volumeHeight = 0;
            this.volumeMesh = null;
            this.volumeWireframeMesh = null;
            
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
                    points: [new THREE.Vector3(intersectedPosition.x, intersectedPosition.y, intersectedPosition.z)],
                    meshLine: new MeshLine(),
                    obj: null
                }
                
                this.vertexCount++;
            } else {
                // add the next vertex sphere, add to vertexArray
                // update the line
                // set this.lastPos object with corresponding vertexSphere
                // increase vertex count
                
                if (this.vertexCount >= MIN_VERTEX_COUNT) {
                    // let v1 = this.vertexArray[0].position.clone().applyMatrix4(this.mainContainerObj.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
                    // let v2 = this.vertexArray[1].position.clone().applyMatrix4(this.mainContainerObj.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
                    // let v3 = this.vertexArray[2].position.clone().applyMatrix4(this.mainContainerObj.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
                    let v1 = this.vertexArray[0].position.clone().applyMatrix4(camera.matrixWorldInverse);
                    let v2 = this.vertexArray[1].position.clone().applyMatrix4(camera.matrixWorldInverse);
                    let v3 = this.vertexArray[2].position.clone().applyMatrix4(camera.matrixWorldInverse);
                    let plane = new THREE.Plane().setFromCoplanarPoints(v1, v2, v3);
                    this.plane = plane;
                    let intersectedPlanePosition = intersectWithAngledPlane(e, plane);
                    if (intersectedPlanePosition !== null) {
                        intersectedPosition = intersectedPlanePosition;
                    }
                }
                
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
                this.updateLine(intersectedObjectPosition.x, intersectedObjectPosition.y, intersectedObjectPosition.z);
                
                // start building the shape, and add prepare vertex array for area & centroid calculation
                let x = 0, y = 0, z = 0; // calculate the shape mesh's x and z positions
                let beforeConvertedAreaVec2Arr = [];
                let areaVec2Arr = []; // calculate the shape area later
                let shape = new THREE.Shape();
                shape.moveTo(this.line.points[0].x, this.line.points[0].z);
                let xi = this.line.points[0].x;
                let zi = this.line.points[0].z;
                let xi1 = this.line.points[1].x;
                let zi1 = this.line.points[1].z;
                let product = xi * zi1 - xi1 * zi;
                x += (xi + xi1) * product;
                z += (zi + zi1) * product;
                
                let yi = this.line.points[0].y;
                let yi1 = this.line.points[1].y;
                y += (yi + yi1) * (xi * yi1 - xi1 * yi);
                // first convert to world coordinates, and add x and z components to a Vector2
                beforeConvertedAreaVec2Arr.push(new THREE.Vector2(xi, zi));
                let tempVec3 = this.line.points[0].clone();
                tempVec3.applyMatrix4(this.mainContainerObj.matrixWorld);
                areaVec2Arr.push(new THREE.Vector2(tempVec3.x, tempVec3.z));
                for (let i = 1; i < this.line.points.length - 1; i ++) {
                    shape.lineTo(this.line.points[i].x, this.line.points[i].z);
                    xi = this.line.points[i].x;
                    zi = this.line.points[i].z;
                    xi1 = this.line.points[i + 1].x;
                    zi1 = this.line.points[i + 1].z;
                    product = xi * zi1 - xi1 * zi;
                    x += (xi + xi1) * product;
                    z += (zi + zi1) * product;

                    let yi = this.line.points[0].y;
                    let yi1 = this.line.points[1].y;
                    y += (yi + yi1) * (xi * yi1 - xi1 * yi);

                    beforeConvertedAreaVec2Arr.push(new THREE.Vector2(xi, zi));
                    tempVec3.copy(this.line.points[i]);
                    tempVec3.applyMatrix4(this.mainContainerObj.matrixWorld);
                    areaVec2Arr.push(new THREE.Vector2(tempVec3.x, tempVec3.z));
                }
                let lastPoint = this.line.points[this.line.points.length - 1];
                beforeConvertedAreaVec2Arr.push(new THREE.Vector2(lastPoint.x, lastPoint.z));
                tempVec3.copy(this.line.points[this.line.points.length - 1]);
                tempVec3.applyMatrix4(this.mainContainerObj.matrixWorld);
                areaVec2Arr.push(new THREE.Vector2(tempVec3.x, tempVec3.z));
                
                // calculate the area
                console.log(areaVec2Arr);
                let area = THREE.ShapeUtils.area(areaVec2Arr);
                area = (Math.abs(area) / Math.pow(1000, 2)).toFixed(3);
                console.log(area * Math.pow(1000, 2));
                let beforeConvertedArea = THREE.ShapeUtils.area(beforeConvertedAreaVec2Arr);
                beforeConvertedArea = Math.abs(beforeConvertedArea);
                console.log(beforeConvertedArea);
                

                // instantiate the shape mesh, and place it at correct position
                let geometry = new THREE.ShapeGeometry(shape);
                geometry.center();
                let mesh = new THREE.Mesh(geometry, this.matGreenTransparent);
                // this.finalPosition = new THREE.Vector3(x / (6 * beforeConvertedArea), this.y, z / (6 * beforeConvertedArea));
                this.finalPosition = new THREE.Vector3(x / (6 * beforeConvertedArea), y / (6 * beforeConvertedArea), z / (6 * beforeConvertedArea));
                console.log(this.finalPosition.y);
                mesh.position.copy(this.finalPosition);
                // mesh.rotation.x = Math.PI / 2;
                // mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), this.plane.normal.clone());
                addArrowHelper(this.finalPosition, this.plane.normal.clone(), 1000, new THREE.Color(0xff0000));
                this.mainContainerObj.add(mesh);

                // add measurement area text
                let div1 = document.createElement('div');
                div1.classList.add('measurement-text');
                div1.style.background = 'rgb(0,255,255)';
                div1.innerHTML = `${area} m<sup>2</sup>`;
                let divObj = new CSS3DObject(div1);
                divObj.position.copy(this.finalPosition);
                divObj.rotation.x = -Math.PI / 2;
                this.mainContainerObj.add(divObj);

                this.firstPos = null;
                this.lastPos = null;
                this.lastPointTime = null;
                this.line = null;
                this.vertexCount = 0;
                this.vertexArray = [];
                this.y = null;
                this.intersectedObject = null;

                // todo Steve: handle the volume mode cleaner
                if (this.allowVolume) {
                    this.shape = shape;
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
        
        let intersectedPosition = intersectWithScenePosition(e); // todo Steve: prolly why this area does not completely match meshlines, is that intersectWithScenePosition() calculates the approximate positions, instead of real scene positions like in intersectWithSceneObjects. Maybe switch to that when not free-form drawing
        
        // if (this.intersectedObject !== null) {
        //     let offset = this.intersectedObject.position.clone().sub(intersectedPosition);
        //     console.log(offset.x, offset.y, offset.z);
        //     return;
        // }
        
        if (!isVector3Valid(intersectedPosition)) return;
        // update the mesh line to include more points

        if (this.lastPos === null) return;

        if (this.vertexCount >= MIN_VERTEX_COUNT) {
            // let v1 = this.vertexArray[0].position.clone().applyMatrix4(this.mainContainerObj.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
            // let v2 = this.vertexArray[1].position.clone().applyMatrix4(this.mainContainerObj.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
            // let v3 = this.vertexArray[2].position.clone().applyMatrix4(this.mainContainerObj.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
            let v1 = this.vertexArray[0].position.clone().applyMatrix4(camera.matrixWorldInverse);
            let v2 = this.vertexArray[1].position.clone().applyMatrix4(camera.matrixWorldInverse);
            let v3 = this.vertexArray[2].position.clone().applyMatrix4(camera.matrixWorldInverse);
            let plane = new THREE.Plane().setFromCoplanarPoints(v1, v2, v3);
            this.plane = plane;
            let intersectedPlanePosition = intersectWithAngledPlane(e, plane);
            if (intersectedPlanePosition !== null) {
                this.updateLine(intersectedPlanePosition.x, intersectedPlanePosition.y, intersectedPlanePosition.z);
                return;
            }
        }
        this.updateLine(intersectedPosition.x, intersectedPosition.y, intersectedPosition.z);
        // todo Steve: 1 bugs:
        //  1. due to limitations of THREE.Shape() in only accepting points at the same height, and the current setup doesn't allow drawing on arbituary height without intersecting the AreaTarget mesh,
        //  we have to refer to DrawingManager offset drawing mode, to support drawing in arbitrary height w/o intersecting with AreaTarget mesh
    }
    
    updateLine(x, y, z) { // called after the first point has been established. Updates lastPointTime, update all the info about the line, delete & re-add the line in the scene
        this.lastPointTime = Date.now();
        let intersectedPosition = new THREE.Vector3(x, y, z);
        if (this.mode.discrete) {
            if (this.justClicked) {
                this.justClicked = false;
            } else {
                this.line.points.pop();
            }
            this.line.points.push(intersectedPosition.clone());
            this.line.meshLine.setPoints(this.line.points);
        } else {
            if (intersectedPosition.clone().sub(this.lastPos.position).length < this.minimumUpdate.distance && Date.now() - this.lastPointTime < this.minimumUpdate.time) {
                return;
            }
            
            // todo Steve: after the curve head has been travelled for a distance, automatically draw a point
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
