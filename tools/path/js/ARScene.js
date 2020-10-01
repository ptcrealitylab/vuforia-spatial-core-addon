import * as THREE from 'three';
import FBXLoader from "three-fbx-loader";
import {AxisDummy} from "./axisdummy";
import {RobotDummy} from "./robotdummy";
import {setMatrixFromArray} from "./utils";
import EventEmitter from 'eventemitter3';
import {Path} from "./path";
import {MotionVisualization} from "./motionvisualization";

window.THREE = THREE;

/**
 * @desc this class will hold functions for the THREEjs view
 * examples include createNewPath(), moveSelectedCheckpoint(), activateCheckpointMode(), showCheckpointArrows()
 * @author Anna Fuste
 * @required eventemitter3, three, three-fbx-loader, axisdummy.js, robotdummy.js, utils.js, path.js, motionvisualization.js
 */
export class ARScene extends EventEmitter{
    constructor(){

        super();

        this.scene = new THREE.Scene();

        this.rendererWidth = screen.height;
        this.rendererHeight = screen.width;
        let aspectRatio = this.rendererWidth / this.rendererHeight;

        this.camera = new THREE.PerspectiveCamera( 70, aspectRatio, 1, Number.MAX_VALUE );
        this.camera.matrixAutoUpdate = false;

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize( this.rendererWidth, this.rendererHeight );

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.previousMouseY = 0;

        // create a parent 3D object to contain all the three js objects
        // we can apply the marker transform to this object and all of its
        // children objects will be affected
        this.groundPlaneContainerObj = new THREE.Object3D();
        this.groundPlaneContainerObj.matrixAutoUpdate = false;
        this.scene.add(this.groundPlaneContainerObj);


        this.scene.add( new THREE.AmbientLight( 0x333333 ) );


        this.isProjectionMatrixSet = false;
        this.isGroundPlaneTracked = false;
        this.isRobotAnchorSet = false;

    }

    setGroundPlaneMatrix(groundPlaneMatrix, projectionMatrix){
        // only set the projection matrix for the camera 1 time, since it stays the same
        if (!this.isProjectionMatrixSet && projectionMatrix.length > 0) {
            setMatrixFromArray(this.camera.projectionMatrix, projectionMatrix);
            this.isProjectionMatrixSet = true;
        }

        if (this.isProjectionMatrixSet) {                                                // don't turn into else statement, both can happen

            setMatrixFromArray(this.groundPlaneContainerObj.matrix, groundPlaneMatrix);  // update model view matrix
            this.groundPlaneContainerObj.visible = true;

            this.update();

            if (!this.isGroundPlaneTracked) this.emit('surfaceTracked');
            this.isGroundPlaneTracked = true;
        }
    }

    renderRobot(modelviewmatrix, projectionMatrix){

        // Once the object is tracked and the frame is set to full frame, this callback keeps on getting called even if we don't see the object target.
        // This is needed to prevent from assigning a null matrix to the robot dummy
        // If this is not checked, we will get a constant warning when loosing the object target
        if (modelviewmatrix[0] !== null){

            // Update model view matrix
            setMatrixFromArray(this.robotDummy.matrix, modelviewmatrix);
            this.robotDummy.visible = true;

            this.counter++;
            if (this.counter > 100 && !this.isRobotAnchorSet && this.isGroundPlaneTracked){

                this.anchorRobotToGroundPlane(modelviewmatrix);

                this.emit('robotAnchored');

                this.isRobotAnchorSet = true;
            }
        } else {
            this.robotDummy.visible = false;
        }
    }


    update() {

        this.renderer.render(this.scene, this.camera);  // RENDER SCENE!

    }

}
