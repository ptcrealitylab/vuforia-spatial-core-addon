/** Class that draws to a 3D scene. */
class DrawingManager {
    /**
     * Creates a DrawingManager.
     * @param {THREE.Scene} scene - The scene to draw in.
     * @param {THREE.Camera} camera - The camera used for the scene.
     */
    constructor(scene, camera) {
        this.toolMap = {
            'LINE': new DrawingManager.Tool.Line(this)
        };
        this.cursorMap = {
            'PROJECTION': new DrawingManager.Cursor.SmoothProjection(),
            'OFFSET': new DrawingManager.Cursor.Offset(),
        };

        this.tool = this.toolMap['LINE'];
        this.cursor = this.cursorMap['PROJECTION'];

        this.scene = scene;
        this.camera = camera;
        this.drawingGroup = new THREE.Group();
        this.scene.add(this.drawingGroup);

        this.erasing = false;
        this.raycaster = new THREE.Raycaster();

        this.eventStack = [];
        this.pointerDown = false;

        this.tempOffsetMode = false;

        this.interactionsActive = true;

        this.callbacks = {
            'color': [],
            'cursor': [],
            'eraseMode': [],
            'size': [],
            'tool': [],
            'update': [],
            'visibility': []
        };
    }

    /**
     * Sets the visibility of the drawing.
     * @param visibility - The visibility of the drawing.
     */
    setVisibility(visibility) {
        this.drawingGroup.visible = visibility;
        this.triggerCallbacks('visibility', visibility);
    }

    /**
     * Adds a callback to the given listener.
     * @param name - The listener name.
     * @param cb - The callback.
     */
    addCallback(name, cb) {
        this.callbacks[name].push(cb);
    }

    /**
     * Triggers callbacks for the given listener.
     * @param name - The listener name.
     * @param value - The value passed to the callbacks.
     */
    triggerCallbacks(name, value) {
        this.callbacks[name].forEach(cb => cb(value));
    }

    /**
     * Serializes the drawing into a JSON format.
     * @returns {Object} - A serialized JSON object representing the drawing.
     */
    serializeDrawing() {
        const drawings = [];
        this.drawingGroup.children.forEach(drawing => {
            if (drawing.serialized) {
                drawings.push(drawing.serialized);
            }
        });
        return {drawings};
    }

    /**
     * Deserializes a serialized drawing and populates it into the scene, replacing the existing drawing.
     * @param {Object} obj - A serialized JSON object representing the drawing
     */
    deserializeDrawing(obj) {
        const newDrawings = obj.drawings.filter(newDrawing => !this.drawingGroup.children.some(drawing => newDrawing.drawingId === drawing.drawingId));

        // Remove drawings which are not present in the JSON
        this.drawingGroup.children.forEach(drawing => {
            if (drawing.serialized && !obj.drawings.some(newDrawing => newDrawing.drawingId === drawing.drawingId)) {
                this.drawingGroup.remove(drawing);
            }
        });

        // Add drawings that are not present in the scene
        newDrawings.forEach(newDrawing => {
            this.toolMap[newDrawing.tool].drawFromSerialized(this.drawingGroup, newDrawing);
        });
    }

    /**
     * Sets the drawing tool.
     * @param {DrawingManager.Tool} tool - The drawing tool.
     */
    setTool(tool) {
        this.setEraseMode(false);
        this.tool.endDraw(this.drawingGroup, this.cursor.getPosition());
        this.tool = tool;
        this.triggerCallbacks('tool', tool);
    }

    /**
     * Sets the cursor type.
     * @param {DrawingManager.Cursor} cursor - The cursor type.
     */
    setCursor(cursor) {
        this.setEraseMode(false);
        this.tool.endDraw(this.drawingGroup, this.cursor.getPosition());
        this.cursor = cursor;
        this.triggerCallbacks('cursor', cursor);
    }

    /**
     * Sets the drawing color.
     * @param {string} color - The color.
     */
    setColor(color) {
        this.setEraseMode(false);
        this.tool.endDraw(this.drawingGroup, this.cursor.getPosition());
        this.tool.setColor(color);
        this.triggerCallbacks('color', color);
    }

    /**
     * Sets the drawing size.
     * @param {number} size - The size.
     */
    setSize(size) {
        this.tool.endDraw(this.drawingGroup, this.cursor.getPosition());
        this.tool.setSize(size);
        this.triggerCallbacks('size', size);
    }

    /**
     * Enters or exits erase mode.
     * @param {boolean} value - Value to set the erase mode to.
     */
    setEraseMode(value) {
        this.erasing = value;
        this.tool.endDraw(this.drawingGroup, this.cursor.getPosition());
        this.triggerCallbacks('eraseMode', this.erasing);
    }

    /**
     * Erases lines drawn under the pointer.
     * @param {Object} pointerEvent - The triggering pointer event.
     */
    erase(pointerEvent) {
        const position = {
            x: (pointerEvent.pageX / window.innerWidth) * 2 - 1,
            y: - (pointerEvent.pageY / window.innerHeight) * 2 + 1,
        };

        this.raycaster.setFromCamera(new THREE.Vector2(position.x, position.y), this.camera);
        const serializedDrawings = [];
        this.drawingGroup.children.forEach(obj => {
            if (obj.serialized) {
                serializedDrawings.push(obj);
            }
        });
        const intersects = this.raycaster.intersectObjects(serializedDrawings);
        intersects.forEach(intersect => {
            if (intersect.object.serialized) {
                const undoEvent = {
                    type: 'draw',
                    data: intersect.object.serialized
                };
                intersect.object.parent.remove(intersect.object);
                this.pushEvent(undoEvent);
            }
        });
    }

    /**
     * Calls updateCallbacks with the current state of the drawing.
     */
    shareUpdates() {
        const serializedDrawings = this.serializeDrawing();
        this.triggerCallbacks('update', serializedDrawings);
    }

    /**
     * Adds an undoable event to the event stack.
     * @param {Object} event - The event to be performed if undo is pressed.
     */
    pushEvent(event) {
        this.eventStack.push(event);
        this.shareUpdates();
    }

    /**
     * Performs the most recent event in the event stack.
     */
    undoEvent() {
        const event = this.eventStack.pop();
        if (!event) {
            return;
        }
        if (event.type === 'erase') {
            const target = this.drawingGroup.children.find(child => event.data.drawingId === child.drawingId);
            if (!target) { // Object may have been erased by another user
                this.undoEvent(); // Skip this undo and undo the next event in the stack
                return;
            }
            target.parent.remove(target);
        } else if (event.type === 'draw') {
            this.toolMap[event.data.tool].drawFromSerialized(this.drawingGroup, event.data);
        }
        this.shareUpdates();
    }

    /**
     * Enables drawing interactions
     */
    enableInteractions() {
        this.interactionsActive = true;
    }

    /**
     * Disables drawing interactions
     */
    disableInteractions() {
        this.interactionsActive = false;
    }

    /**
     * Calls startDraw on the current tool with the position given by the current cursor.
     * @param {Object} pointerEvent - The triggering pointer event.
     */
    onPointerDown(pointerEvent) {
        if (!this.interactionsActive) {
            return;
        }
        this.pointerDown = true;
        if (this.cursor === this.cursorMap['PROJECTION'] && !this.erasing) {
            if (!pointerEvent.projectedZ) {
                this.setCursor(this.cursorMap['OFFSET']);
                this.tempOffsetMode = true;
            }
        }
        this.cursor.updatePosition(this.scene, this.camera, pointerEvent);
        if (this.erasing) {
            this.erase(pointerEvent);
        } else {
            this.tool.startDraw(this.drawingGroup, this.cursor.getPosition());
        }
    }

    /**
     * Calls moveDraw on the current tool with the position given by the current cursor.
     * @param {Object} pointerEvent - The triggering pointer event.
     */
    onPointerMove(pointerEvent) {
        if (!this.interactionsActive) {
            return;
        }
        this.cursor.updatePosition(this.scene, this.camera, pointerEvent);
        if (this.erasing && this.pointerDown) {
            this.erase(pointerEvent);
        } else {
            this.tool.moveDraw(this.drawingGroup, this.cursor.getPosition());
        }
    }

    /**
     * Calls endDraw on the current tool with the position given by the current cursor.
     * @param {Object} pointerEvent - The triggering pointer event.
     */
    onPointerUp(pointerEvent) {
        if (!this.interactionsActive) {
            return;
        }
        this.pointerDown = false;
        this.cursor.updatePosition(this.scene, this.camera, pointerEvent);
        if (this.erasing) {
            this.erase(pointerEvent);
        } else {
            this.tool.endDraw(this.drawingGroup, this.cursor.getPosition());
        }
        if (this.tempOffsetMode) {
            this.tempOffsetMode = false;
            this.setCursor(this.cursorMap['PROJECTION']);
        }
    }
}

/* ========== Classes ========== */
/** Class that defines behavior for drawing style within DrawingManager */
DrawingManager.Tool = class {
    /**
     * Creates a Tool.
     */
    constructor(drawingManager) {
        this.drawingManager = drawingManager;
        this.size = 20;
        this.color = '#FF009F';
        this.brushMaterial = generateBrushMaterial(this.color);
    }

    /**
     * Starts drawing with the tool.
     * @param {THREE.Object3D} parent - The parent object to draw in.
     * @param {THREE.Vector3} position - The position of the cursor.
     */
    startDraw(parent, position) {
    }

    /**
     * Updates drawing with the tool.
     * @param {THREE.Object3D} parent - The parent object to draw in.
     * @param {THREE.Vector3} position - The position of the cursor.
     */
    moveDraw(parent, position) {
    }

    /**
     * Finishes drawing with the tool. Can be called when tool is not currently drawing.
     * @param {THREE.Object3D} parent - The parent object to draw in.
     * @param {THREE.Vector3} position - The position of the cursor.
     */
    endDraw(parent, position) {
    }

    /**
     * Creates a drawing from a serialized version.
     * @param {THREE.Object3D} parent - The parent object to draw in.
     * @param {Object} drawing - The serialized object defining the object to be drawn.
     */
    drawFromSerialized(parent, drawing) {
    }

    /**
     * Sets the drawing size.
     * @param {number} size - The size.
     */
    setSize(size) {
        this.size = size;
    }

    /**
     * Sets the drawing color.
     * @param {string} color - The color.
     */
    setColor(color) {
        this.color = color;
    }
};

/** Class that defines behavior for drawing placement within DrawingManager */
DrawingManager.Cursor = class {
    /**
     * Creates a Cursor.
     */
    constructor() {
        this.position = new THREE.Vector3(0, 0, 0);
    }

    /**
     * Updates the cursor position.
     * @param {THREE.Scene} scene - The scene to calculate the position in.
     * @param {THREE.Camera} camera - The camera used for calculating the cursor position.
     * @param {Object} pointerEvent - The triggering pointer event.
     */
    updatePosition(scene, camera, pointerEvent) {
    }

    /**
     * Gets the current cursor position.
     * @returns {THREE.Vector3} - The position of the cursor in the scene.
     */
    getPosition() {
    }
};

/**
 * Generates a material for drawing given a color.
 * @param {string} color - The color of the material.
 * @return {THREE.MeshBasicMaterial} - The generated brush material.
 */
function generateBrushMaterial(color) {
    return new THREE.MeshToonMaterial({color});
}

/**
 * Generates a brush shape for extrusion when drawing.
 * @param {number} radius - The radius of the brush shape.
 * @returns {THREE.Shape} - The generated brush shape.
 */
function generateBrushShape(radius) {
    const circlePoints = [];
    const circleResolution = 8; // 8 points

    for (let i = 0; i < circleResolution; i++) {
        circlePoints.push(new THREE.Vector2(radius * Math.sin(2 * Math.PI * i / circleResolution), radius * Math.cos(2 * Math.PI * i / circleResolution)));
    }

    return new THREE.Shape(circlePoints);
}

DrawingManager.Tool.Line = class extends DrawingManager.Tool {
    /**
     * Creates a Line Tool.
     */
    constructor(drawingManager) {
        super(drawingManager);

        this.currentLine = null;
        this.brushShape = generateBrushShape(this.size);

        this.lastPointTime = 0;
        this.minimumUpdate = {
            distance: 5,
            time: 1000
        };
    }

    /**
     * Starts drawing with the tool.
     * @param {THREE.Object3D} parent - The parent object to draw in.
     * @param {THREE.Vector3} position - The position of the cursor.
     */
    startDraw(parent, position) {
        this.currentLine = {
            points: [position.clone()],
            curve: new THREE.CurvePath(),
            obj: null,
        };

        this.lastPointTime = Date.now();
    }

    /**
     * Updates drawing with the tool.
     * @param {THREE.Object3D} parent - The parent object to draw in.
     * @param {THREE.Vector3} position - The position of the cursor.
     */
    moveDraw(parent, position) {
        if (!this.currentLine) {
            return;
        }
        const lastPosition = this.currentLine.points[this.currentLine.points.length - 1];
        const newPosition = position.clone();

        if (newPosition.clone().sub(lastPosition).length() < this.minimumUpdate.length && Date.now() - this.lastPointTime < this.minimumUpdate.time) {
            return; // Return if the cursor hasn't moved far enough and enough time hasn't passed, simplifies path when cursor doesn't move much for a bit
        }
        this.lastPointTime = Date.now();

        this.currentLine.points.push(newPosition);
        this.currentLine.curve = new THREE.CatmullRomCurve3(this.currentLine.points);
        if (this.currentLine.obj) {
            this.currentLine.obj.geometry.dispose();
            this.currentLine.obj.material.dispose();
            this.currentLine.obj.parent.remove(this.currentLine.obj);
            this.currentLine.obj = null;
        }
        const extrudeSettings = {
            extrudePath: this.currentLine.curve,
            steps: this.currentLine.points.length - 1
        };
        const geometry = new THREE.ExtrudeGeometry(this.brushShape, extrudeSettings);
        this.currentLine.obj = new THREE.Mesh(geometry, this.brushMaterial);
        parent.add(this.currentLine.obj);
    }

    /**
     * Finishes drawing with the tool. Can be called when tool is not currently drawing.
     * @param {THREE.Object3D} parent - The parent object to draw in.
     * @param {THREE.Vector3} position - The position of the cursor.
     */
    endDraw(parent, position) {
        if (this.currentLine && this.currentLine.obj) {
            this.currentLine.obj.drawingId = `${Math.round(Math.random() * 100000000)}`;

            const undoEvent = {
                type: 'erase',
                data: {
                    drawingId: this.currentLine.obj.drawingId
                }
            };

            this.currentLine.obj.serialized = {
                tool: 'LINE',
                points: this.currentLine.points,
                size: this.size,
                color: this.color,
                drawingId: this.currentLine.obj.drawingId
            };
            this.currentLine = null;
            this.lastPointTime = 0;
            this.drawingManager.pushEvent(undoEvent);
        } else {
            this.currentLine = null;
            this.lastPointTime = 0;
        }
    }

    /**
     * Creates a drawing from a serialized version.
     * @param {THREE.Object3D} parent - The parent object to draw in.
     * @param {Object} drawing - The serialized object defining the object to be drawn.
     */
    drawFromSerialized(parent, drawing) {
        const brushShape = generateBrushShape(drawing.size);
        const brushMaterial = generateBrushMaterial(drawing.color);

        const threePoints = drawing.points.map(point => new THREE.Vector3(point.x, point.y, point.z));
        const curve = new THREE.CatmullRomCurve3(threePoints);
        const extrudeSettings = {
            extrudePath: curve,
            steps: threePoints.length - 1
        };
        const geometry = new THREE.ExtrudeGeometry(brushShape, extrudeSettings);
        const mesh = new THREE.Mesh(geometry, brushMaterial);
        mesh.drawingId = drawing.drawingId;
        mesh.serialized = drawing;
        parent.add(mesh);
    }

    /**
     * Sets the drawing size.
     * @param {number} size - The size.
     */
    setSize(size) {
        super.setSize(size);
        this.brushShape = generateBrushShape(size);
    }

    /**
     * Sets the drawing color.
     * @param {string} color - The color.
     */
    setColor(color) {
        super.setColor(color);
        this.brushMaterial = generateBrushMaterial(color);
    }
};

DrawingManager.Cursor.Offset = class extends DrawingManager.Cursor {
    /**
     * Creates an Offset Cursor.
     */
    constructor() {
        super();
        this.offset = 500; // TODO: Add ability for user to set this by tapping in the scene, like focusing camera lens
        this.position = new THREE.Vector3(0, 0, 0);
        this.raycaster = new THREE.Raycaster();
    }

    /**
     * Updates the cursor position.
     * @param {THREE.Scene} scene - The scene to calculate the position in.
     * @param {THREE.Camera} camera - The camera used for calculating the cursor position.
     * @param {Object} pointerEvent - The triggering pointer event.
     */
    updatePosition(scene, camera, pointerEvent) {
        const position = {
            x: (pointerEvent.pageX / window.innerWidth) * 2 - 1,
            y: - (pointerEvent.pageY / window.innerHeight) * 2 + 1,
        };

        this.raycaster.setFromCamera(position, camera);

        const ray = this.raycaster.ray;

        this.position = ray.origin.clone().add(ray.direction.clone().multiplyScalar(this.offset)).applyMatrix4(camera.matrixWorld).applyMatrix4(scene.matrixWorld.clone().invert());
    }

    /**
     * Gets the current cursor position.
     * @returns {THREE.Vector3} - The position of the cursor in the scene.
     */
    getPosition() {
        return this.position;
    }
};

DrawingManager.Cursor.Projection = class extends DrawingManager.Cursor {
    /**
     * Creates a Projection Cursor.
     */
    constructor() {
        super();
        this.position = new THREE.Vector3(0, 0, 0);
        this.raycaster = new THREE.Raycaster();
    }

    /**
     * Updates the cursor position.
     * @param {THREE.Scene} scene - The scene to calculate the position in.
     * @param {THREE.Camera} camera - The camera used for calculating the cursor position.
     * @param {Object} pointerEvent - The triggering pointer event.
     */
    updatePosition(scene, camera, pointerEvent) {
        const offset = pointerEvent.projectedZ;
        if (!offset) {
            return;
        }
        const position = {
            x: (pointerEvent.pageX / window.innerWidth) * 2 - 1,
            y: - (pointerEvent.pageY / window.innerHeight) * 2 + 1,
        };

        this.raycaster.setFromCamera(position, camera);

        const ray = this.raycaster.ray;

        this.position = ray.origin.clone().add(ray.direction.clone().multiplyScalar(offset)).applyMatrix4(camera.matrixWorld).applyMatrix4(scene.matrixWorld.clone().invert());
    }

    /**
     * Gets the current cursor position.
     * @returns {THREE.Vector3} - The position of the cursor in the scene.
     */
    getPosition() {
        return this.position;
    }
};

DrawingManager.Cursor.SmoothProjection = class extends DrawingManager.Cursor {
    /**
     * Creates a Smooth Projection Cursor, preventing the cursor from jumping into the distance.
     */
    constructor() {
        super();
        this.position = new THREE.Vector3(0, 0, 0);
        this.raycaster = new THREE.Raycaster();
        this.jumpDistanceLimit = 500; // Distance diff considered to be too big, must be smoothed
        this.lastOffset = 0; // Distance at which to draw when going over holes, updated when hitting surface
        this.bumpTowardsCamera = 15; // Distance by which to shift the cursor towards the camera to prevent z-fighting with surfaces
        this.activeCursor = false; // Successful pointerdown over geometry
        this.planePoints = [];
        this.logDebug = false;
    }

    debug(msg) {
        if (this.logDebug) {
            console.log(msg);
        }
    }

    addPlanePoint(position, scene) {
        if (this.planePoints.length < 3) {
            const planePoint = new THREE.Object3D();
            scene.add(planePoint);
            planePoint.position.copy(position);
            this.planePoints.push(planePoint);
        } else {
            const planePoint = this.planePoints.shift();
            planePoint.position.copy(position);
            this.planePoints.push(planePoint);
        }
    }

    /**
     * Updates the cursor position.
     * @param {THREE.Scene} scene - The scene to calculate the position in.
     * @param {THREE.Camera} camera - The camera used for calculating the cursor position.
     * @param {Object} pointerEvent - The triggering pointer event.
     */
    updatePosition(scene, camera, pointerEvent) {
        const projectedZ = pointerEvent.projectedZ;
        if (pointerEvent.type === 'pointerdown') {
            this.activeCursor = !!projectedZ;
            this.planePoints.forEach(planePoint => planePoint.parent.remove(planePoint));
            this.planePoints = [];
        }
        if (pointerEvent.type === 'pointerup') {
            this.activeCursor = false;
        }
        if (!this.activeCursor) {
            return;
        }

        const position = {
            x: (pointerEvent.pageX / window.innerWidth) * 2 - 1,
            y: - (pointerEvent.pageY / window.innerHeight) * 2 + 1,
        };
        this.raycaster.setFromCamera(position, camera);
        const ray = this.raycaster.ray;

        const lastOffsetPosition = ray.origin.clone().add(ray.direction.clone().multiplyScalar(this.lastOffset - this.bumpTowardsCamera)).applyMatrix4(camera.matrixWorld).applyMatrix4(scene.matrixWorld.clone().invert());
        if (projectedZ) {
            const meshProjectedPosition = ray.origin.clone().add(ray.direction.clone().multiplyScalar(projectedZ - this.bumpTowardsCamera)).applyMatrix4(camera.matrixWorld).applyMatrix4(scene.matrixWorld.clone().invert());
            if (this.planePoints.length === 3) { // If plane has been defined
                const plane = new THREE.Plane().setFromCoplanarPoints(...this.planePoints.map(p => p.position.clone().applyMatrix4(scene.matrixWorld).applyMatrix4(camera.matrixWorldInverse)));
                if (ray.distanceToPlane(plane) !== null) {
                    const planeProjectedPosition = ray.origin.clone().add(ray.direction.clone().multiplyScalar(ray.distanceToPlane(plane) - this.bumpTowardsCamera)).applyMatrix4(camera.matrixWorld).applyMatrix4(scene.matrixWorld.clone().invert());
                    if (Math.abs(projectedZ - this.lastOffset) > this.jumpDistanceLimit) {
                        this.lastOffset = ray.distanceToPlane(plane); // Set hole offset with successful draw distance
                        this.debug('plane projection, jump too big');
                        this.position = planeProjectedPosition;
                    } else {
                        this.lastOffset = projectedZ; // Set hole offset with successful draw distance
                        this.debug('mesh projection, default');
                        this.addPlanePoint(meshProjectedPosition, scene);
                        this.position = meshProjectedPosition;
                    }
                } else {
                    this.lastOffset = projectedZ; // Set hole offset with successful draw distance
                    this.debug('mesh projection, failed to intersect plane');
                    this.addPlanePoint(meshProjectedPosition, scene);
                    this.position = meshProjectedPosition;
                }
            } else { // If plane has not yet been defined
                if (pointerEvent.type === 'pointerdown' || Math.abs(this.lastOffset - projectedZ) < this.jumpDistanceLimit) {
                    this.lastOffset = projectedZ; // Set hole offset with successful draw distance
                    this.debug('mesh projection, plane undefined');
                    this.addPlanePoint(meshProjectedPosition, scene);
                    this.position = meshProjectedPosition;
                } else { // If hole into other geometry
                    this.debug('hole projection, jump too big');
                    this.position = lastOffsetPosition;
                }
            }
        } else { // If hole into empty space
            if (this.planePoints.length === 3) { // If plane has been defined
                const plane = new THREE.Plane().setFromCoplanarPoints(...this.planePoints.map(p => p.position.clone().applyMatrix4(scene.matrixWorld).applyMatrix4(camera.matrixWorldInverse)));
                if (ray.distanceToPlane(plane) !== null) {
                    const planeProjectedPosition = ray.origin.clone().add(ray.direction.clone().multiplyScalar(ray.distanceToPlane(plane) - this.bumpTowardsCamera)).applyMatrix4(camera.matrixWorld).applyMatrix4(scene.matrixWorld.clone().invert());
                    this.lastOffset = ray.distanceToPlane(plane); // Set hole offset with successful draw distance
                    this.debug('plane projection, no mesh, default');
                    this.position = planeProjectedPosition;
                } else {
                    this.debug('hole projection, no mesh, failed to intersect plane');
                    this.position = lastOffsetPosition;
                }
            } else {
                this.debug('hole projection, no mesh, plane undefined');
                this.position = lastOffsetPosition;
            }
        }
    }

    /**
     * Gets the current cursor position.
     * @returns {THREE.Vector3} - The position of the cursor in the scene.
     */
    getPosition() {
        return this.position;
    }
};
