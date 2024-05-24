import {ToolRenderSocket} from "/objectDefaultFiles/scene/ToolRenderStream.js";
import WorldNode from "/objectDefaultFiles/scene/WorldNode.js";
import WorldStore from "/objectDefaultFiles/scene/WorldStore.js";
//import {GLTFNode} from "/objectDefaultFiles/scene/scene3DNode.js";
import {ParentMessageInterface} from "/objectDefaultFiles/scene/MessageInterface.js";
import EntityNode from "/objectDefaultFiles/scene/EntityNode.js";
import EntityStore from "/objectDefaultFiles/scene/EntityStore.js";
import GltfLoaderComponentNode from "/objectDefaultFiles/scene/GltfLoaderComponentNode.js";
import GltfLoaderComponentStore from "/objectDefaultFiles/scene/GltfLoaderComponentStore.js";

/**
 * @typedef {import("/objectDefaultFiles/scene/ToolNode.js").default} ToolNode
 */

class GLTFExample {
    /** @type {import('../../../../libraries/objectDefaultFiles/object.js').SpatialInterface} */
    #spatialInterface;

    /** @type {import('../../../../liberaries/objectDefaultFiles/envelope.js').Envelope} */
    #envelope;

    /** @type {ToolRenderSocket} */
    #socket;

    /** @type {WorldNode|null} */
    #world; 

    /** @type {ToolNode|null} */
    #tool;

    /**@type {EntityNode|null} */
    #gltfObject;

    constructor() {
        this.#spatialInterface = new SpatialInterface();

        this.#spatialInterface.setMoveDelay(500);
        this.#spatialInterface.useToolRenderer();

        const messageInterface = new ParentMessageInterface("*");
        this.#socket = new ToolRenderSocket(messageInterface);
        this.#socket.setListener(this);

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

        this.#world = null;
        this.#tool = null;
        this.#gltfObject = null;

        this.#spatialInterface.onSpatialInterfaceLoaded(() => {
            this.#socket.sendGet(this.#spatialInterface);
        });
    } 
    
    onReceivedSet(state) {
        console.log("gltfExample: ", state)
        if (this.#world === null) {
            this.#world = new WorldNode(new WorldStore());
        }
        this.#world.setState(state);
        this.#tool = this.#world.get("threejsContainer").get("tools").values()[0]; // <- server will only send content for this tool (world with one tool)
        if (!this.#tool.hasChild("gltfObject")) {
            this.#gltfObject = new EntityNode(new EntityStore());
            const gltfLoader = new GltfLoaderComponentNode(new GltfLoaderComponentStore());
            gltfLoader.setUrl(self.location.href.substring(0, self.location.href.lastIndexOf('/')) + "/flagab.glb");
            this.#gltfObject.addComponent(1, gltfLoader);
            this.#gltfObject.setScale(1000, 1000, 1000);
            this.#tool.setChild("gltfObject", this.#gltfObject);
        }
        this.#socket.sendUpdate(this.#world.getChanges());
    }
}

new GLTFExample();
