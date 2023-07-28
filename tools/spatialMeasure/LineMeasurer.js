class LineMeasurer {
    constructor(mainContainerObj) {
        this.mainContainerObj = mainContainerObj;
        
        this.uuid = null;
        this.bigParentObj = null;

        this.isActive = false;

        this.startPos = null;
        this.endPos = null;
        this.line = null;
        this.measurementText = null;
        this.setupEventListeners();
    }

    activate() {
        this.isActive = true;
    }

    deactivate() {
        this.isActive = false;
    }

    setupEventListeners() {
        document.addEventListener('pointerdown', function(e) {
            if (!this.isActive) return;
            if (e.button === 0) {
                this.drawPoint(e);
            }
        }.bind(this));

        document.addEventListener('pointermove', function(e) {
            if (!this.isActive) return;
            this.updateLine(e);
        }.bind(this));
    }

    drawPoint(e) {
        let intersectedPosition = intersectWithScenePosition(e);
        if (!isVector3Valid(intersectedPosition)) return;

        if (this.startPos === null) { // add the vertex sphere for the first point
            // console.log('%c measure line set start pos', 'color: green');
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
            measurementObjs[`${this.uuid}`].vertices.push(sphere);
            vertexSphereArray.push(sphere);
            sphere.name = `vertex_sphere_${vertexSphereArray.length - 1}`; // todo Steve: not robust enough, b/c cannot handle when deleting lines / vertex spheres case
            this.startPos = {
                position: new THREE.Vector3(intersectedPosition.x, intersectedPosition.y, intersectedPosition.z),
                mesh: sphere,
                index: vertexSphereArray.length - 1,
            };

            this.line = {
                points: [intersectedPosition.x, intersectedPosition.y, intersectedPosition.z],
                meshLine: new MeshLine(),
                obj: null,
                indices: null // used to update the meshline with translating vertex mesh with editing tool
            };

        } else if (this.endPos === null) { // add the vertex sphere for the second point
            // console.log('%c measure line set end pos', 'color: green');
            let sphere = makeVertexSphere(intersectedPosition.x, intersectedPosition.y, intersectedPosition.z, 0xffff00);
            this.bigParentObj.add(sphere);
            measurementObjs[`${this.uuid}`].vertices.push(sphere);
            vertexSphereArray.push(sphere);
            sphere.name = `vertex_sphere_${vertexSphereArray.length - 1}`;
            this.endPos = {
                position: new THREE.Vector3(intersectedPosition.x, intersectedPosition.y, intersectedPosition.z),
                mesh: sphere,
                index: vertexSphereArray.length - 1,
            }

            this.line.points = [this.startPos.position.x, this.startPos.position.y, this.startPos.position.z, this.endPos.position.x, this.endPos.position.y, this.endPos.position.z];
            this.line.meshLine.setPoints(this.line.points);
            if (this.line.obj !== null) {
                this.line.obj.geometry.dispose();
                this.line.obj.material.dispose();
                this.line.obj.parent.remove(this.line.obj);
                this.line.obj = null;
            }
            this.line.obj = new THREE.Mesh(this.line.meshLine, meshLineCyan);
            this.bigParentObj.add(this.line.obj);
            measurementObjs[`${this.uuid}`].line = this.line.obj;
            this.line.indices = [this.startPos.index, this.endPos.index];
            lineArray.push(this.line);

            // reset everything
            this.startPos = null;
            this.endPos = null;
            this.line = null;
            this.measurementText = null;
        }
    }

    updateLine(e) {
        // console.log('%c measure line cursor moving', 'color: red');
        if (this.startPos === null && this.endPos === null) return;

        if (this.startPos !== null && this.endPos === null) { // constantly update & display the line
            let intersectedPosition = intersectWithScenePosition(e);
            if (!isVector3Valid(intersectedPosition)) return;

            this.line.points = [this.startPos.position.x, this.startPos.position.y, this.startPos.position.z, intersectedPosition.x, intersectedPosition.y, intersectedPosition.z];
            this.line.meshLine.setPoints(this.line.points);
            if (this.line.obj !== null) {
                this.line.obj.geometry.dispose();
                this.line.obj.material.dispose();
                this.line.obj.parent.remove(this.line.obj);
                this.line.obj = null;
            }
            this.line.obj = new THREE.Mesh(this.line.meshLine, meshLineCyan);
            this.bigParentObj.add(this.line.obj);
            measurementObjs[`${this.uuid}`].line = this.line.obj;

            let startWorldPos = this.startPos.position.clone().applyMatrix4(this.mainContainerObj.matrixWorld);
            let endWorldPos = intersectedPosition.clone().applyMatrix4(this.mainContainerObj.matrixWorld);
            const distance = (startWorldPos.clone().sub(endWorldPos).length() / 1000).toFixed(3);

            // add measurement text
            if (this.measurementText === null) {
                let div1 = document.createElement('div');
                div1.classList.add('measurement-text');
                div1.style.background = 'rgb(0,0,0)';
                div1.innerHTML = `${distance} m`;
                let divObj = new THREE.CSS2DObject(div1);
                //divObj.scale.set(1, -1, 1);
                let midPos = this.startPos.position.clone().add(intersectedPosition.clone()).divideScalar(2);
                divObj.position.copy(midPos);
                this.bigParentObj.add(divObj);
                measurementObjs[`${this.uuid}`].text = divObj;
                this.measurementText = {
                    obj: divObj,
                    // indices: [this.startPos.index, ]
                };
            } else {
                this.measurementText.obj.element.innerHTML = `${distance} m`;
                let midPos = this.startPos.position.clone().add(intersectedPosition.clone()).divideScalar(2);
                this.measurementText.obj.position.copy(midPos);
            }
        }
    }
}
