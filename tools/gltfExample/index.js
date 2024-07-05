import MemoryEntity from "/objectDefaultFiles/scene/MemoryEntity.js";
import GltfLoaderComponentNode from "/objectDefaultFiles/scene/GltfLoaderComponentNode.js";
import Tool3D from "/objectDefaultFiles/scene/Tool3D.js";
import SimpleAnimationComponentNode from "/objectDefaultFiles/scene/SimpleAnimationComponentNode.js";
import ToolNode from "/objectDefaultFiles/scene/ToolNode.js";

class GLTFExampleNode extends ToolNode {
    static TYPE = `${ToolNode.TYPE}.gltfExample`;

    #amplitude;
    #frequency;

    constructor(frequency, amplitude) {
        super(new MemoryEntity(), GLTFExampleNode.TYPE);
        this.#frequency = frequency;
        this.#amplitude = amplitude;
    }

    createBuoyEntity(key, state) {
        const entityNode = super.createEntity(key, state);
        entityNode.setComponent("1", new GltfLoaderComponentNode(), false);
        const animator = new SimpleAnimationComponentNode();
        animator.setAnimation((timestamp) => {
            return {x: 0, y: this.#amplitude * Math.sin(2.0 * Math.PI * this.#frequency * timestamp), z: 0};
        });
        entityNode.setComponent("2", animator, false);
        return entityNode
    }

    createEntity(key, state) {
        if (key === "buoy") {
            console.log("create buoy from network");
            return createBuoyEntity(key, state);        
        }
        return super.createEntity(key, state);
    }

    createComponent(order, state) {
        return super.createComponent(order, state);
    }
}

/**
 * @typedef {import("/objectDefaultFiles/scene/ToolNode.js").default} ToolNode
 */

class GLTFExample {
    /** @type {import('../../../../libraries/objectDefaultFiles/object.js').SpatialInterface} */
    #spatialInterface;

    /** @type {import('../../../../liberaries/objectDefaultFiles/envelope.js').Envelope} */
    #envelope;

    /** @type {EntityNode|null} */
    #gltfObject;

    /** @type {Base3DTool} */
    #baseTool;

    #frequency;
    #amplitude;

    constructor() {
        this.#spatialInterface = new SpatialInterface();

        this.#spatialInterface.setMoveDelay(500);

        const isStackable = true;
        const areFramesOrdered = false;
        const isFullscreenFull2D = false;
        const opensWhenAdded = true;
        const rootWhenOpened = document.querySelector('#rootWhenOpened');
        const rootWhenClosed = document.querySelector('#rootWhenClosed');
        this.#envelope = new Envelope(this.#spatialInterface, [], rootWhenOpened, rootWhenClosed, isStackable, areFramesOrdered, isFullscreenFull2D, opensWhenAdded);
        this.#envelope.onOpen(() => {
            this.#baseTool.setVisible(true);
        });
        this.#envelope.onClose(() => {
            this.#baseTool.setVisible(false);
        });
        this.#envelope.onBlur(() => {
        });
        this.#envelope.onFocus(() => {
        });

        this.#frequency = 0.25;
        this.#amplitude = 100;

        this.#baseTool = new Tool3D(this);
    } 
    
    onStart() {
        const toolNode = this.#baseTool.getToolNode();
        if (!toolNode.hasChild("buoy")) {
            this.#gltfObject = toolNode.createBuoyEntity();
            this.#gltfObject.getComponentByType(GltfLoaderComponentNode.TYPE).setUrl(self.location.href.substring(0, self.location.href.lastIndexOf('/')) + "/flagab.glb");
            this.#gltfObject.scale = {x: 1000, y: 1000, z: 1000};
            toolNode.setChild("buoy", this.#gltfObject);
        }
    }

    getSpatialInterface() {
        return this.#spatialInterface;
    }

    getToolNodeType() {
        return GLTFExampleNode.TYPE;
    }

    createToolNode() {
        return new GLTFExampleNode(this.#frequency, this.#amplitude);
    }
}

new GLTFExample();
