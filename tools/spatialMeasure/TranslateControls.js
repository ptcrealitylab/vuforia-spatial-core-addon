let _raycaster_handle = new THREE.Raycaster(); // raycaster for the TranslateControls handles
let _raycaster_object = new THREE.Raycaster(); // raycaster for the scene objects

const gizmoMaterial = new THREE.MeshBasicMaterial({
    depthTest: false,
    depthWrite: false,
    transparent: true,
    fog: false,
    toneMapped: false,
});

const matRed = gizmoMaterial.clone();
matRed.color.setHex( 0xff0000 );

const matGreen = gizmoMaterial.clone();
matGreen.color.setHex( 0x00ff00 );

const matBlue = gizmoMaterial.clone();
matBlue.color.setHex( 0x0000ff );

const matYellow = gizmoMaterial.clone();
matYellow.color.setHex( 0xffff00 );

const matRedTransparent = matRed.clone();
matRedTransparent.opacity = 0.15;

const matGreenTransparent = matGreen.clone();
matGreenTransparent.opacity = 0.15;

const matBlueTransparent = matBlue.clone();
matBlueTransparent.opacity = 0.15;

const matCyan = gizmoMaterial.clone();
matCyan.color.setHex( 0x00ffff );

const matTransparent = gizmoMaterial.clone();
matTransparent.opacity = 0.25;

const cylinderHeight = 300;
const centerSphereRadius = 25;
const cylinderGeometry = new THREE.CylinderGeometry(5, 5, cylinderHeight, 6);
const arrowGeometry = new THREE.CylinderGeometry(0, 20, 60, 12);
const pickerCylinderGeometry = new THREE.CylinderGeometry(50, 5, cylinderHeight, 12);
// const planeGeometry = new THREE.PlaneGeometry(6000, 3000);
const planeGeometry = new THREE.BoxGeometry(6000, 3000, 10);

const _gizmo_helper = {
    origin: { 
        mesh: new THREE.Mesh(new THREE.SphereGeometry(centerSphereRadius, 32, 16), matCyan), 
        position: [ 0, 0, 0 ], 
        rotation: [ 0, 0, 0 ]
    },
    X: {
        handle: {
            mesh: new THREE.Mesh(cylinderGeometry, matRed), 
            position: [cylinderHeight / 2 + centerSphereRadius / 2, 0, 0],
            rotation: [0, 0, -Math.PI / 2]
        },
        arrow: {
            mesh: new THREE.Mesh(arrowGeometry, matRed), 
            position: [cylinderHeight + centerSphereRadius / 2, 0, 0], 
            rotation: [0, 0, -Math.PI / 2]
        }
    },
    'Y': {
        handle: {
            mesh: new THREE.Mesh(cylinderGeometry, matGreen),
            position: [0, cylinderHeight / 2 + centerSphereRadius / 2, 0],
            rotation: [0, 0, 0]
        },
        arrow: {
            mesh: new THREE.Mesh(arrowGeometry, matGreen), 
            position: [0, cylinderHeight + centerSphereRadius / 2, 0], 
            rotation: [0, 0, 0]
        }
},
    'Z': {
        handle: {
            mesh: new THREE.Mesh(cylinderGeometry, matBlue),
            position: [0, 0, cylinderHeight / 2 + centerSphereRadius / 2],
            rotation: [Math.PI / 2, 0, 0]
        },
        arrow: {
            mesh: new THREE.Mesh(arrowGeometry, matBlue),
            position: [0, 0, cylinderHeight + centerSphereRadius / 2],
            rotation: [Math.PI / 2, 0, 0]
        }
    }
};

const _gizmo_picker = {
    'X': {
        mesh: new THREE.Mesh(pickerCylinderGeometry, matTransparent),
        position: [cylinderHeight / 2 + centerSphereRadius / 2, 0, 0],
        rotation: [0, 0, -Math.PI / 2]
    },
    'Y': {
        mesh: new THREE.Mesh(pickerCylinderGeometry, matTransparent),
        position: [0, cylinderHeight / 2 + centerSphereRadius / 2, 0],
        rotation: [0, 0, 0]
    },
    'Z': {
        mesh: new THREE.Mesh(pickerCylinderGeometry, matTransparent),
        position: [0, 0, cylinderHeight / 2 + centerSphereRadius / 2],
        rotation: [Math.PI / 2, 0, 0]
    },
};

const _gizmo_planes = {
    'X': {
        mesh: new THREE.Mesh(planeGeometry, matRedTransparent),
        position: [0, 0, 0],
        rotation: [0, 0, 0]
    },
    // todo Steve: this y plane needs to always face the user's camera, in order to always pick up user input
    'Y': {
        mesh: new THREE.Mesh(planeGeometry, matGreenTransparent),
        position: [0, 0, 0],
        rotation: [0, 0, Math.PI / 2]
    },
    'Z': {
        mesh: new THREE.Mesh(planeGeometry, matBlueTransparent),
        position: [0, 0, 0],
        rotation: [0, Math.PI / 2, 0]
    },
}

class TranslateControls extends THREE.Object3D {
    constructor(camera, mainContainerObj, shouldIntersectObjects) {
        super();
        
        this.camera = camera;
        this.mainContainerObj = mainContainerObj;
        this.shouldIntersectObjects = shouldIntersectObjects;
        
        // 3 handles
        this.buildGizmos = this.buildGizmos.bind(this);
        this.buildGizmos();
        
        this.isActive = false;
        this.mouse = new THREE.Vector2();
        this.axis = null;
        this.target = null; // the target object to translate
        this.isDragging = false;
        
        this.points = {
            dragLast: null,
            dragCurrent: null,
        };
        this.offset = null;
        this.offsetSpeed = 2;
        
        this.setupEventListeners();
    }
    
    buildGizmos() {
        let origin = new THREE.Object3D();
        
        let originMesh = _gizmo_helper.origin.mesh;
        originMesh.position.fromArray(_gizmo_helper.origin.position);
        originMesh.rotation.fromArray(_gizmo_helper.origin.rotation);
        originMesh.name = 'gizmo_helper_origin';
        origin.add(originMesh);
        
        // handle X
        let handle_x = _gizmo_helper.X.handle.mesh;
        handle_x.position.fromArray(_gizmo_helper.X.handle.position);
        handle_x.rotation.fromArray(_gizmo_helper.X.handle.rotation);
        origin.add(handle_x);
        let arrow_x = _gizmo_helper.X.arrow.mesh;
        arrow_x.position.fromArray(_gizmo_helper.X.arrow.position);
        arrow_x.rotation.fromArray(_gizmo_helper.X.arrow.rotation);
        handle_x.attach(arrow_x);

        // handle Y
        let handle_y = _gizmo_helper.Y.handle.mesh;
        handle_y.position.fromArray(_gizmo_helper.Y.handle.position);
        handle_y.rotation.fromArray(_gizmo_helper.Y.handle.rotation);
        origin.add(handle_y);
        let arrow_y = _gizmo_helper.Y.arrow.mesh;
        arrow_y.position.fromArray(_gizmo_helper.Y.arrow.position);
        arrow_y.rotation.fromArray(_gizmo_helper.Y.arrow.rotation);
        handle_y.attach(arrow_y);

        // handle Z
        let handle_z = _gizmo_helper.Z.handle.mesh;
        handle_z.position.fromArray(_gizmo_helper.Z.handle.position);
        handle_z.rotation.fromArray(_gizmo_helper.Z.handle.rotation);
        origin.add(handle_z);
        let arrow_z = _gizmo_helper.Z.arrow.mesh;
        arrow_z.position.fromArray(_gizmo_helper.Z.arrow.position);
        arrow_z.rotation.fromArray(_gizmo_helper.Z.arrow.rotation);
        handle_z.attach(arrow_z);
        
        // picker container
        let picker = new THREE.Object3D();
        origin.add(picker);
        
        // picker X
        let picker_x = _gizmo_picker.X.mesh;
        picker_x.position.fromArray(_gizmo_picker.X.position);
        picker_x.rotation.fromArray(_gizmo_picker.X.rotation);
        picker_x.name = 'picker_x';
        picker.add(picker_x);
        
        // picker Y
        let picker_y = _gizmo_picker.Y.mesh;
        picker_y.position.fromArray(_gizmo_picker.Y.position);
        picker_y.rotation.fromArray(_gizmo_picker.Y.rotation);
        picker_y.name = 'picker_y';
        picker.add(picker_y);

        // picker Z
        let picker_z = _gizmo_picker.Z.mesh;
        picker_z.position.fromArray(_gizmo_picker.Z.position);
        picker_z.rotation.fromArray(_gizmo_picker.Z.rotation);
        picker_z.name = 'picker_z';
        picker.add(picker_z);
        
        picker_x.visible = false;
        picker_y.visible = false;
        picker_z.visible = false;
        
        // intersection plane container
        let planes = new THREE.Object3D();
        origin.add(planes);
        
        // intersection plane for x axis
        let plane_x = _gizmo_planes.X.mesh;
        plane_x.position.fromArray(_gizmo_planes.X.position);
        plane_x.rotation.fromArray(_gizmo_planes.X.rotation);
        plane_x.name = 'plane_x';
        planes.add(plane_x);

        // intersection plane for y axis
        let plane_y = _gizmo_planes.Y.mesh;
        plane_y.position.fromArray(_gizmo_planes.Y.position);
        plane_y.rotation.fromArray(_gizmo_planes.Y.rotation);
        plane_y.name = 'plane_y';
        planes.add(plane_y);
        
        // intersection plane for z axis
        let plane_z = _gizmo_planes.Z.mesh;
        plane_z.position.fromArray(_gizmo_planes.Z.position);
        plane_z.rotation.fromArray(_gizmo_planes.Z.rotation);
        plane_z.name = 'plane_z';
        planes.add(plane_z);

        plane_x.visible = false;
        plane_y.visible = false;
        plane_z.visible = false;

        this.mainContainerObj.add(origin);
        origin.visible = false;
        
        Object.defineProperties(this, {
            origin: {
                value: origin
            },
            originMesh: {
                value: originMesh
            },
            handle_x: {
                value: handle_x
            },
            handle_y: {
                value: handle_y
            },
            handle_z: {
                value: handle_z
            },
            picker: {
                value: picker
            },
            picker_x: {
                value: picker_x
            },
            picker_y: {
                value: picker_y
            },
            picker_z: {
                value: picker_z
            },
            planes: {
                value: planes
            },
            plane_x: {
                value: plane_x
            },
            plane_y: {
                value: plane_y
            },
            plane_z: {
                value: plane_z
            },
        });
    }
    
    setupEventListeners() {
        document.addEventListener('pointerdown', function(e) {
            if (e.button === 0) {
                this.onPointerDown(e);
            }
        }.bind(this));
        
        document.addEventListener('pointerup', function(e) {
            if (e.button === 0) {
                this.onPointerUp();
            }
        }.bind(this));
        
        document.addEventListener('pointermove', function(e) {
            if (!this.isDragging) {
                this.onPointerHover(e);
            } else {
                this.onPointerMove(e);
            }
        }.bind(this));
    }
    
    activate() {
        this.isActive = true;
    }
    
    deactivate() {
        this.isActive = false;
        if (this.origin !== null) {
            this.origin.visible = false;
        }
    }
    
    resetHandleColors() {
        this.handle_x.material.color.setHex(0xff0000);
        this.handle_y.material.color.setHex(0x00ff00);
        this.handle_z.material.color.setHex(0x0000ff);
        this.originMesh.material.color.setHex(0x0000ff);
    }

    onPointerDown(e) {
        if (!this.isActive) return;
        // todo Steve: pick target object with _raycaster_object
        this.intersectWithSceneObject(e);
        if (this.axis === null) return;
        this.isDragging = true;
        this.intersectRayWithPlane(e, this.axis);
        console.log(this.axis);
    }
    
    intersectWithSceneObject(e) {
        if (!this.camera) {
            return;
        }

        this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

        _raycaster_object.setFromCamera(this.mouse, this.camera);

        const intersects = _raycaster_object.intersectObjects(this.shouldIntersectObjects, true);

        if (intersects.length === 0) {
            if (this.axis === null) this.origin.visible = false;
            return;
        }
        this.target = intersects[0].object;
        this.origin.position.copy(this.target.position);
        this.origin.visible = true;
    }

    onPointerUp() {
        if (this.axis === null) return;
        this.isDragging = false;
        this.axis = null;
    }

    onPointerMove(e) {
        this.intersectRayWithPlane(e, this.axis);
        this.moveControls(this.axis, this.offset);
    }

    moveControls(xyz, offset) {
        let vector = new THREE.Vector3();
        switch (xyz) {
            case 'x':
                vector.x = 1;
                break;
            case 'y':
                vector.y = 1;
                break;
            case 'z':
                vector.z = 1;
                break;
            default:
                console.error('input "xyz" is not x, nor y, nor z.');
                return;
        }
        this.origin.position.add(offset.clone().multiply(vector));
        if (this.target !== null) {
            this.target.position.add(offset.clone().multiply(vector));
            
            // change line if vertex mesh changes
            let targetName = this.target.name;
            let keyword = 'vertex_sphere_';
            if (targetName.includes(keyword)) {
                let index = parseInt(targetName.substring(keyword.length));
                lineArray.forEach(line => {
                    if (line.indices.includes(index)) {
                        let firstVertexPos = vertexSphereArray[line.indices[0]].position;
                        let secondVertexPos = vertexSphereArray[line.indices[1]].position;
                        line.points = [firstVertexPos.x, firstVertexPos.y, firstVertexPos.z, secondVertexPos.x, secondVertexPos.y, secondVertexPos.z];
                        line.meshLine.setPoints(line.points);
                        
                        line.obj.geometry.dispose();
                        line.obj.material.dispose();
                        line.obj.parent.remove(line.obj);
                        line.obj = null;
                        line.obj = new THREE.Mesh(line.meshLine, meshLineMaterial);
                        this.mainContainerObj.add(line.obj);
                    }
                })
            }
        }
    }
    
    // input: e --- mouse event; xyz --- x / y / z plane
    // output: world position of the intersected point with the x / y / z plane
    intersectRayWithPlane(e, xyz) {
        if (!this.camera) {
            return;
        }

        this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

        _raycaster_handle.setFromCamera(this.mouse, this.camera);

        let plane = null; // the plane to intersect
        switch (xyz) {
            case 'x':
                plane = this.plane_x;
                break;
            case 'y':
                plane = this.plane_y;
                break;
            case 'z':
                plane = this.plane_z;
                break;
            default:
                console.error('input "xyz" is not x, nor y, nor z.');
                return;
        }
        const intersects = _raycaster_handle.intersectObject(plane, false);

        if (intersects.length === 0) {
            console.error('why is it not intersecting with the plane?');
            return;
        }
        let point = intersects[0].point.applyMatrix4(this.mainContainerObj.matrixWorld.clone().invert());
        if (this.points.dragLast === null) { // when click on a handle for the first time, record the world intersection position in dragLast
            this.points.dragLast = point.clone();
            this.points.dragCurrent = point.clone();
            this.offset = new THREE.Vector3();
        } else { // otherwise, calculate the offset value, in order to move the whole TranslateControls handles and the target object
            this.points.dragCurrent = point.clone();
            this.offset = this.points.dragCurrent.clone().sub(this.points.dragLast).multiplyScalar(1);
            // console.log(this.offset.x, this.offset.y, this.offset.z);
            this.points.dragLast = this.points.dragCurrent.clone();
        }
    }

    onPointerHover(e) {
        if (!this.origin.visible) return;
        // essentially the same code as in threejsInterface.touchDecider
        if (!this.camera) {
            return;
        }

        this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

        pickerIntersect: {
            // step 1: first, try raycasting on TranslateControls handles, to see if there is any intersect on those
            _raycaster_handle.setFromCamera(this.mouse, this.camera);

            const intersects = _raycaster_handle.intersectObjects([...this.picker.children, this.originMesh], true);
            
            if (intersects.length === 0) {
                this.resetHandleColors();
                this.axis = null;
                break pickerIntersect;
            }
            
            switch (intersects[0].object.name) {
                case 'picker_x':
                    this.axis = 'x';
                    this.handle_x.material.color.setHex(0xffff00);
                    break;
                case 'picker_y':
                    this.axis = 'y';
                    this.handle_y.material.color.setHex(0xffff00);
                    break;
                case 'picker_z':
                    this.axis = 'z';
                    this.handle_z.material.color.setHex(0xffff00);
                    break;
                case 'gizmo_helper_origin':
                    this.originMesh.material.color.setHex(0xffff00);
                    break;
                default:
                    this.axis = null;
                    break pickerIntersect;
            }
        }

        // todo Steve: hover on a vertex sphere, highlight that sphere. Nah should prolly do it with _raycaster_object
        {
            // step 2: if _raycaster_handle doesn't return anything, then try raycasting on mainContainerObj's children, to see if intersects with any scene objects
            // _raycaster_object.setFromCamera(this.mouse, this.camera);

            // const intersects = _raycaster_object.intersectObjects(this.mainContainerObj.children, true);

            // console.log(intersects[0].object);

            // // world coords
            // let position = intersects[0].point;
            // // convert to mainContainerObj coords, got a slightly different value than "ray.origin.clone().add(ray.direction.clone().multiplyScalar(distance)).applyMatrix4(camera.matrixWorld).applyMatrix4(mainContainerObj.matrixWorld.clone().invert());"
            // // find out why. But can be disabled right now, since here we just want to know which object the raycaster hits (if it hits any)
            // // b/c we leave the raycast position handling in the index.js intersectWithSceneObjects(e) function
            // let position2 = position.clone().applyMatrix4(this.mainContainerObj.matrixWorld.clone().invert());
            // console.log(position2);
        }
    }
}
