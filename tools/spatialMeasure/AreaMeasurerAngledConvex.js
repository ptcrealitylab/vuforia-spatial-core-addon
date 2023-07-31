const MIN_VERTEX_COUNT = 3;
const CURVE_POINT_DIVISION = 500;

class AreaMeasurer {
    constructor(mainContainerObj) {
        this.mainContainerObj = mainContainerObj;
        
        this.uuid = null;
        this.bigParentObj = null;

        this.isActive = false;
        
        this.minimumUpdate = {
            distance: 3,
            time: 300
        };
        this.maximumUpdate = {
            distance: 300
        };
        
        this.plane = null;
        this.area = null;
        this.allowVolume = false;
        this.firstVolumeY = null;
        this.volumeHeight = 0;
        this.volumeMesh = null;
        this.volumeWireframeMesh = null;
        this.volumeText = null;
        
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
        this.vertexArray = []; // add vertex spheres to this array, to raycast on the spheres when closing the loop, also used in the volume mode to construct the plane for extrusion
        this.vertexPositionArray = []; // array of position,x, position.y, position.z to build custom BufferGeometry from
        this.y = null;
        this.intersectedObject = null;
        
        this.setupEventListeners();

        this.matGreenTransparent = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.4,
        });
        this.matGreyTransparent = new THREE.MeshBasicMaterial({
            color: 0x222222,
            transparent: true,
            opacity: 0.4,
        });
        this.matLineCyan = new THREE.LineMaterial({
            color: 0xffffff,
            linewidth: 0.003
        });
        this.matLineGrey = new THREE.LineMaterial({
            color: 0xffffff,
            linewidth: 0.001
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
            if (!appActive || !this.isActive) return;
            if (!isdesktop) {
                this.justClicked = true;
                this.drawPoint(fakeE);
            } else if (e.button === 0) {
                this.justClicked = true;
                this.drawPoint(e);
            }
        }.bind(this));

        document.addEventListener('pointermove', function(e) {
            if (!appActive || !this.isActive) return;
            if (!isdesktop) return;
            if (this.mode.volume) {
                this.updateVolume(e)
            } else {
                this.updateArea(e);
            }
        }.bind(this));
        
        setInterval(() => {
            if (this.line !== null) {
                // console.log(this.line.points.length);
            }
        }, 10);
    }
    
    triggerPointerMove(e) {
        if (!appActive || !this.isActive) return;
        if (this.mode.volume) {
            this.updateVolume(e)
        } else {
            this.updateArea(e);
        }
    }

    updateVolume(e) {
        // todo Steve: rewrite this logic to make volume extrusion exactly align with the cursor position
        //  do a intersectWithScenePosition(e), and subtract pos.y with volumeBase.y to get the volumeHeight ???
        //  what about extrusion direction other than +y direction ???
        //  maybe it's just better to take Ben's advice to have a slider in the bottom to control the extrusion amount
        
        // method 1: cannot work on phone, since spatial cursor always at screen center
        // if (this.firstVolumeY === null) {
        //     this.firstVolumeY = e.clientY;
        //     return;
        // } else {
        //     this.volumeHeight = 10 * (e.clientY - this.firstVolumeY);
        // }
        // 
        // method 2: not general enough, b/c doesn't work on volume base plane not directly facing +y
        // if (this.firstVolumeY === null) {
        //     this.firstVolumeY = intersectWithScenePosition(e).y;
        //     return;
        // } else {
        //     this.volumeHeight = intersectWithScenePosition(e).y - this.firstVolumeY;
        // }

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
        let plane2 = new THREE.Plane().setFromCoplanarPoints(v4, v5, v6); // mainContainerObj coords plane, used to draw volume
        let normalDir = plane2.normal.clone();
        if (normalDir.clone().dot(new THREE.Vector3(0, 1, 0)) < 0) normalDir.negate(); // if plane normal towards -y, then flip it

        // method 3: has some limitations, b/c there might be nothing around the volume in the scene for mouse to intersect with
        // if (this.firstVolumeY === null) {
        //     this.firstVolumeY = intersectWithScenePosition(e);
        //     return;
        // } else {
        //     this.volumeHeight = intersectWithScenePosition(e).clone().sub(this.firstVolumeY).dot(normalDir);
        // }
        // method 4: well it works, but maybe not so intuitive on the iPhone / iPad. Maybe a combination of method 1, 3 & 4 would work
        if (this.firstVolumeY === null) {
            this.firstVolumeY = intersectWithAngledPlane(e, this.plane);
        } else {
            this.volumeHeight = intersectWithAngledPlane(e, this.plane).clone().sub(this.firstVolumeY).length();
        }
        
        let heightVector = normalDir.multiplyScalar(this.volumeHeight);
        for (let i = 0; i < length; i += 3) {
            volumePointArrayTop.push(volumePointArrayBase[i] + heightVector.x);
            volumePointArrayTop.push(volumePointArrayBase[i + 1] + heightVector.y);
            volumePointArrayTop.push(volumePointArrayBase[i + 2] + heightVector.z);
        }
        // console.log(volumePointArrayBase, volumePointArrayTop)

        let geometry = new THREE.BufferGeometry();
        let positionAttribute = new THREE.BufferAttribute(new Float32Array([...volumePointArrayBase, ...volumePointArrayTop]), 3);
        geometry.setAttribute('position', positionAttribute);
        // let triangles = Earcut.triangulate([...volumePointArrayBase, ...volumePointArrayTop], [], 3);
        // let indexAttribute = new THREE.Uint16BufferAttribute(triangles, 1);
        // geometry.setIndex(indexAttribute);
        // todo Steve: calculate the index numbers for all the faces
        // console.log(volumePointArrayBase.length / 3);
        let trianglesBase = Earcut.triangulate(volumePointArrayBase, [], 3);
        let trianglesTop = [...trianglesBase];
        trianglesTop = trianglesTop.map(index => index + length / 3);
        // console.log(trianglesBase, trianglesTop);
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
        // console.log(trianglesMiddle);
        let indices = [...trianglesBase, ...trianglesTop, ...trianglesMiddle];
        geometry.setIndex(indices);
        
        this.volumeMesh = new THREE.Mesh(geometry, this.matGreenTransparent);
        this.bigParentObj.add(this.volumeMesh);
        measurementObjs[`${this.uuid}`].volume = this.volumeMesh;

        if (this.volumeWireframeMesh !== null) {
            this.volumeWireframeMesh.geometry.dispose();
            this.volumeWireframeMesh.material.dispose();
            this.volumeWireframeMesh.parent.remove(this.volumeWireframeMesh);
        }
        // this.volumeWireframeMesh = new THREE.Mesh(geometry, this.matWireframe);
        
        // let edges = new THREE.EdgesGeometry(geometry, 70);
        // console.log(edges);
        // console.log(edges.attributes.position.array);
        let lineSegmentBase = [], lineSegmentTop = [], lineSegmentMid = [];
        for (let i = 0; i < volumePointArrayBase.length; i += 3) {
            if (i === volumePointArrayBase.length - 3) {
                lineSegmentBase.push(volumePointArrayBase[i], volumePointArrayBase[i + 1], volumePointArrayBase[i + 2], volumePointArrayBase[0], volumePointArrayBase[1], volumePointArrayBase[2]);
                lineSegmentTop.push(volumePointArrayTop[i], volumePointArrayTop[i + 1], volumePointArrayTop[i + 2], volumePointArrayTop[0], volumePointArrayTop[1], volumePointArrayTop[2]);
            } else {
                lineSegmentBase.push(volumePointArrayBase[i], volumePointArrayBase[i + 1], volumePointArrayBase[i + 2], volumePointArrayBase[i + 3], volumePointArrayBase[i + 4], volumePointArrayBase[i + 5]);
                lineSegmentTop.push(volumePointArrayTop[i], volumePointArrayTop[i + 1], volumePointArrayTop[i + 2], volumePointArrayTop[i + 3], volumePointArrayTop[i + 4], volumePointArrayTop[i + 5]);
            }
            lineSegmentMid.push(volumePointArrayBase[i], volumePointArrayBase[i + 1], volumePointArrayBase[i + 2], volumePointArrayTop[i], volumePointArrayTop[i + 1], volumePointArrayTop[i + 2]);
        }
        let geoLine = new THREE.LineSegmentsGeometry();
        geoLine.setPositions([...lineSegmentBase, ...lineSegmentMid, ...lineSegmentTop]);
        // geoLine.fromEdgesGeometry(edges);
        this.volumeWireframeMesh = new THREE.LineSegments2(geoLine, this.matLineCyan);
        this.bigParentObj.add(this.volumeWireframeMesh);
        measurementObjs[`${this.uuid}`].volumeWireframe = this.volumeWireframeMesh;

        // add measure volume text
        // let fakeHeight = Math.abs(this.volumeHeight / 1000);
        // let realHeight = fakeHeight * this.mainContainerObj.matrixWorld.determinant();
        // let realHeight = Math.abs(this.volumeHeight * this.mainContainerObj.matrixWorld.determinant() / 1000);
        // let realHeight = (heightVector.applyMatrix4(this.mainContainerObj.matrixWorld).length() / 1000).toFixed(3);
        let topPos = new THREE.Vector3(volumePointArrayBase[0], volumePointArrayBase[1], volumePointArrayBase[2]).applyMatrix4(this.mainContainerObj.matrixWorld);
        let bottomPos = new THREE.Vector3(volumePointArrayTop[0], volumePointArrayTop[1], volumePointArrayTop[2]).applyMatrix4(this.mainContainerObj.matrixWorld);
        let realHeight = (topPos.clone().sub(bottomPos).length() / 1000).toFixed(3);
        let volume = (this.area * realHeight).toFixed(3);
        let centroid = this.computeCentroid(geometry);
        if (this.volumeText !== null) {
            this.volumeText.element.innerHTML = `${volume} m<sup>3</sup>`;
            this.volumeText.position.copy(centroid);
            return;
        }
        let div = document.createElement('div');
        div.classList.add('measurement-text');
        div.style.background = 'rgb(0,0,0)';
        div.innerHTML = `${volume} m<sup>3</sup>`;
        this.volumeText = new THREE.CSS2DObject(div);
        this.volumeText.position.copy(centroid);
        // this.volumeText.scale.set(1, -1, 1);
        // this.volumeText.rotation.x = -Math.PI / 2;
        this.bigParentObj.add(this.volumeText);
        measurementObjs[`${this.uuid}`].text = this.volumeText;
    }

    drawPoint(e) {
        if (this.mode.volume) { // after drawing a volume
            this.onAfterVolume();
            return;
        }
        
        if (this.intersectedObject === null) { // when drawing NOT volume but area, and there is NOT an intersected vertex
            let isCalledFromUpdateLine = e.isVector3;
            let intersectedPosition = null;
            if (isCalledFromUpdateLine) { // account for calling this.drawPoint(e) within this.updateLine(e) function to automatically add vertex points after a distance
                intersectedPosition = e.clone();
            } else if (this.plane !== null) {
                intersectedPosition = intersectWithAngledPlane(e, this.plane);
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
                this.bigParentObj = new THREE.Group();
                this.uuid = this.bigParentObj.uuid;
                measurementObjs[`${this.uuid}`] = {
                    parent: this.bigParentObj,
                    vertices: [],
                    line: null,
                    area: null,
                    volume: null,
                    volumeWireframe: null,
                    text: null
                };
                history.push(`${this.uuid}`);
                this.mainContainerObj.add(this.bigParentObj);
                let sphere = makeVertexSphere(intersectedPosition.x, intersectedPosition.y, intersectedPosition.z, 0xffff00);
                this.bigParentObj.add(sphere); // add vertex sphere as a child of the bigParentObj group, so that later undo / erase can delete everything (children) of this bigParentObj
                measurementObjs[`${this.uuid}`].vertices.push(sphere); // add vertex sphere to the .vertices array of the global index.js object, to serve future book-keeping purposes
                this.vertexArray = [];
                this.vertexArray.push(sphere); // add vertex sphere to this.vertexArray array, to later detect if hit vertex sphere to close the loop
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
                
                
                let sphere = makeVertexSphere(intersectedPosition.x, intersectedPosition.y, intersectedPosition.z, 0xffff00);
                this.bigParentObj.add(sphere);
                measurementObjs[`${this.uuid}`].vertices.push(sphere);
                this.vertexArray.push(sphere);

                this.lastPos = {
                    position: new THREE.Vector3(intersectedPosition.x, intersectedPosition.y, intersectedPosition.z),
                    mesh: sphere,
                }
                
                this.line.points.pop();
                this.line.points.push(new THREE.Vector3(intersectedPosition.x, intersectedPosition.y, intersectedPosition.z));

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
                this.line.points.pop();
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
                //  This is fixed now.
                // console.log(`%c ${this.line.points.length}`, 'color: red');
                let tempEarcutArray = []; // todo Steve: populate this array with all the x, y, z's of this.line.points, but w.r.t matrix coords instead of groundPlaneCoords, for the Earcut algorithm to work... This is a work-around and will need to change in the future
                for (let i = 0; i < this.line.points.length; i++) {
                    this.vertexPositionArray.push(this.line.points[i].x);
                    this.vertexPositionArray.push(this.line.points[i].y);
                    this.vertexPositionArray.push(this.line.points[i].z);
                    
                    let tempLinePoint = this.line.points[i].clone().applyMatrix4(this.mainContainerObj.matrixWorld).applyMatrix4(realMatrixContainerObj.matrixWorld.clone().invert());
                    tempEarcutArray.push(tempLinePoint.x);
                    tempEarcutArray.push(tempLinePoint.y);
                    tempEarcutArray.push(tempLinePoint.z);
                }
                let positionAttribute = new THREE.BufferAttribute(new Float32Array(this.vertexPositionArray), 3);
                geometry.setAttribute('position', positionAttribute);
                // let triangles = Earcut.triangulate(this.vertexPositionArray, [], 3);
                let triangles = Earcut.triangulate(tempEarcutArray, [], 3);
                let indexAttribute = new THREE.Uint16BufferAttribute(triangles, 1);
                geometry.setIndex(indexAttribute);
                
                this.area = this.computeArea();
                let centroid = this.computeCentroid(geometry);

                // add measurement area text
                if (!this.allowVolume) {
                    let mesh = new THREE.Mesh(geometry, this.matGreenTransparent);
                    this.bigParentObj.add(mesh);
                    measurementObjs[`${this.uuid}`].area = mesh;
                    
                    let div1 = document.createElement('div');
                    div1.classList.add('measurement-text');
                    div1.style.background = 'rgb(0,0,0)';
                    div1.innerHTML = `${this.area} m<sup>2</sup>`;
                    let divObj = new THREE.CSS2DObject(div1);
                    divObj.position.copy(centroid);
                    // divObj.scale.set(1, -1, 1);
                    // divObj.rotation.x = -Math.PI / 2;
                    this.bigParentObj.add(divObj);
                    measurementObjs[`${this.uuid}`].text = divObj;
                }

                this.onAfterArea();
            }
        }
    }

    updateArea(e) {
        this.intersectedObject = intersectWithSceneObjects(e, this.vertexArray);
        
        if (this.intersectedObject !== null) {
            if (this.vertexCount < MIN_VERTEX_COUNT) {
                // console.log('%c From updateLine: Not enough vertices to form a region. Add more vertices.', 'color: red');
            } else {
                // add a circle besides the cursor, to indicate that can form a closed loop
                // console.log('%c should draw a circle next to the cursor to indicate closed loop', 'color: blue');
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
            let plane = new THREE.Plane().setFromCoplanarPoints(v1, v2, v3); // camera coords plane, used to intersect with camera
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
        this.line.obj = new THREE.Mesh(this.line.meshLine, meshLineCyan);
        this.bigParentObj.add(this.line.obj);
        measurementObjs[`${this.uuid}`].line = this.line.obj;
    }
    
    computeArea() {
        let area = 0;
        let tempArr = [];
        for (let i = 0; i < this.line.points.length; i++) {
            tempArr.push(this.line.points[i].clone().applyMatrix4(this.mainContainerObj.matrixWorld));
        }
        for (let i = 0; i < tempArr.length; i++) {
            let v1, v2;
            if (i === tempArr.length - 1) {
                v1 = tempArr[i];
                v2 = tempArr[0];
            } else {
                v1 = tempArr[i];
                v2 = tempArr[i + 1];
            }
            area += v1.clone().sub(tempArr[0]).cross(v2.clone().sub(tempArr[0])).length();
        }
        area *= 0.5;
        area = (area / 1000000).toFixed(3);
        return area;
    }
    
    computeCentroid(geometry) {
        geometry.computeBoundingBox();
        return new THREE.Vector3().addVectors(geometry.boundingBox.min, geometry.boundingBox.max).divideScalar(2);
    }
    
    onAfterArea() {
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
            this.plane = null;
        }
    }
    
    onAfterVolume() {
        this.mode.volume = false;

        this.plane = null;
        
        this.firstVolumeY = null;
        this.volumeHeight = 0;
        this.volumeMesh = null;
        this.volumeWireframeMesh = null;
        this.vertexArray = [];
        this.vertexPositionArray = [];
        this.volumeText = null;
    }

    reset() {
        this.uuid = null;
        this.bigParentObj = null;

        this.plane = null;
        this.area = null;
        this.firstVolumeY = null;
        this.volumeHeight = 0;
        this.volumeMesh = null;
        this.volumeWireframeMesh = null;
        this.volumeText = null;
        
        this.mode.volume = false;

        this.justClicked = false;

        this.firstPos = null;
        this.lastPos = null;
        this.lastPointTime = null;
        this.line = null;
        this.vertexCount = 0;
        this.vertexArray = []; // add vertex spheres to this array, to raycast on the spheres when closing the loop, also used in the volume mode to construct the plane for extrusion
        this.vertexPositionArray = []; // array of position,x, position.y, position.z to build custom BufferGeometry from
        this.y = null;
        this.intersectedObject = null;
    }
}
