import {ARScene} from "./ARScene";
import animitter from 'animitter';  // a library for handling animation-loops

/**
* ARScene contains all information, assets and logic for the threejs scene
*/
const arScene = new ARScene();

/**
* spatialInterface connects to the server API
*/
const spatialInterface = new SpatialInterface();

spatialInterface.onRealityInterfaceLoaded(function() {
    spatialInterface.setFullScreenOn();
    spatialInterface.setStickyFullScreenOn();
    spatialInterface.subscribeToMatrix();
    spatialInterface.addMatrixListener(renderRobotCallback);
    spatialInterface.addGroundPlaneMatrixListener(groundPlaneCallback);
    spatialInterface.setVisibilityDistance(100);

    spatialInterface.getScreenDimensions(function(width, height) {      // Resize to screen dimensions
        document.body.width = width + 'px';
        document.body.height = height + 'px';
        arScene.rendererWidth = width;
        arScene.rendererHeight = height;
        arScene.renderer.setSize( arScene.rendererWidth, arScene.rendererHeight );
        spatialInterface.changeFrameSize(width, height);
    });
    
    spatialInterface.setMoveDelay(-1);  // Keep pointer move active after some time of pointer down
    
});

function pointerDown(eventData) {
    
}

function pointerMove(eventData){

}

function pointerUp( eventData ) {

}

const loop = animitter(update);     // creates a loop 60fps using window.requestAnimationFrame

/**
 * @desc update loop called at 60fps
 * @param int $deltaTime - in milliseconds
 * @param int $elapsedTime - in milliseconds
 * @param int $frameCount
 */
function update(deltaTime, elapsedTime, frameCount) {

}

document.addEventListener( 'pointerdown', pointerDown, false );
document.addEventListener( 'pointermove', pointerMove, false );
document.addEventListener( 'pointerup', pointerUp, false );

loop.start();
