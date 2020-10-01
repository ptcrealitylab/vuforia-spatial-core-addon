import * as THREE from 'three';
import FBXLoader from "three-fbx-loader";
import {Path} from "./path";

export class RobotDummy extends THREE.Group {
    constructor() {

        super();

        // Robot dummy for Object Target
        const geometryCube = new THREE.BoxGeometry( 10, 10, 10 );
        const materialCube = new THREE.MeshBasicMaterial( {color: 0xffffff} );
        let robotDummy = new THREE.Mesh( geometryCube, materialCube );
        //robotDummy.matrixAutoUpdate = false;
        robotDummy.position.set(0,0,0);
        this.add( robotDummy );

        const materialCubeX = new THREE.MeshBasicMaterial( {color: 0xff0000} );
        let dummyX = new THREE.Mesh( geometryCube, materialCubeX );
        robotDummy.add(dummyX);
        dummyX.position.set(50,0,0);

        const materialCubeZ = new THREE.MeshBasicMaterial( {color: 0x0000ff} );
        let dummyZ = new THREE.Mesh( geometryCube, materialCubeZ );
        robotDummy.add(dummyZ);
        dummyZ.position.set(0,0,50);

        const materialCubeY = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
        let dummyY = new THREE.Mesh( geometryCube, materialCubeY );
        robotDummy.add(dummyY);
        dummyY.position.set(0,50,0);

    }
}
