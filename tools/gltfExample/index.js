import {ToolRenderSocket} from "/objectDefaultFiles/scene/ToolRenderStream.js";
import WorldNode from "/objectDefaultFiles/scene/WorldNode.js";
import WorldStore from "/objectDefaultFiles/scene/WorldStore.js";
import {ParentMessageInterface} from "/objectDefaultFiles/scene/MessageInterface.js";
import EntityNode from "/objectDefaultFiles/scene/EntityNode.js";
import EntityStore from "/objectDefaultFiles/scene/EntityStore.js";
import DefaultEntity from "/objectDefaultFiles/scene/DefaultEntity.js";
import GltfLoaderComponentNode from "/objectDefaultFiles/scene/GltfLoaderComponentNode.js";
import GltfLoaderComponentStore from "/objectDefaultFiles/scene/GltfLoaderComponentStore.js";
import Base3DTool from "/objectDefaultFiles/scene/Base3DTool.js";

/**
 * @typedef {import("/objectDefaultFiles/scene/ToolNode.js").default} ToolNode
 */

class GLTFExample2 {
    /** @type {import('../../../../libraries/objectDefaultFiles/object.js').SpatialInterface} */
    #spatialInterface;

    /** @type {import('../../../../liberaries/objectDefaultFiles/envelope.js').Envelope} */
    #envelope;

    /** @type {EntityNode|null} */
    #gltfObject;

    /** @type {Base3DTool} */
    #baseTool;

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
        });
        this.#envelope.onClose(() => {
        });
        this.#envelope.onBlur(() => {
        });
        this.#envelope.onFocus(() => {
        });

        this.#baseTool = new Base3DTool(this.#spatialInterface, this);
    } 
    
    onStart() {
        if (!this.#baseTool.getTool().hasChild("gltfObject")) {
            this.#gltfObject = new EntityNode(new EntityStore(new DefaultEntity()));
            const gltfLoader = new GltfLoaderComponentNode(new GltfLoaderComponentStore());
            gltfLoader.setUrl(self.location.href.substring(0, self.location.href.lastIndexOf('/')) + "/flagab.glb");
            this.#gltfObject.addComponent(1, gltfLoader);
            this.#gltfObject.setScale(1000, 1000, 1000);
            this.#baseTool.getTool().setChild("gltfObject", this.#gltfObject);
        }
    }

    /**
     * 
     * @param {BaseComponentNodeState} _state 
     * @returns null
     */
    createComponent(_state) {
        return null;
    }

    /**
     * 
     * @param {string} _name 
     * @returns {BaseEntity}
     */
    createEntity(_name) {
        return new DefaultEntity();
    }

    /**
     * 
     * @param {string} _key 
     * @param {EntityNode} _node 
     */
    onInitializeEntity(_key, _node) {

    }

}

new GLTFExample2();
