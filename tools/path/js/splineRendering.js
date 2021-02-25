/* global THREE, MeshLine, MeshLineMaterial, window */

(function(exports) {

    function SplineRender(mainContainer, splineTexture) {

        this.container = mainContainer;
        this.splinesIdMap = [];
        this.splinesObjIdMap = [];
        //this.textureArrow = splineTexture;
        //this.textureArrow.wrapS = THREE.RepeatWrapping;
        addSpline = addSpline.bind(this);
    }

    let addSpline = function(nodeId, positions) {

        // MESHLINE

        console.log('1 - NEW SPLINE: ', nodeId);

        console.log('2 - Create points');
        const curve = new THREE.CatmullRomCurve3(positions);
        const points = curve.getPoints( 50 );

        let geometry = new THREE.Geometry();
        geometry.vertices = points;

        /*
        console.log('3 - Create spline');
        let spline = new MeshLine();
        spline.setGeometry( geometry );
        
        console.log('4 - Create material');
        const material = new MeshLineMaterial({
            //map: this.textureArrow,
            useMap: false,
            //repeat: new THREE.Vector2(20, 1),
            transparent: false,
            lineWidth: 30,
            color: new THREE.Color('#ffffff'),
            dashArray: 0,     // always has to be the double of the line
            dashOffset: 0,    // start the dash at zero
            dashRatio: 0,     // visible length range
            sizeAttenuation: true
        });*/

        if (!this.lineMaterial) {
            this.lineMaterial = new THREE.LineBasicMaterial({
                linewidth: 1, // 10 isn't technically supported in Safari
                color: 0xffffff
            });
        }

        //let splineObject = new THREE.Mesh( spline.geometry, material );
        let splineObject = new THREE.Line(geometry, this.lineMaterial);
        this.container.add(splineObject);

        this.splinesIdMap[nodeId] = geometry;
        this.splinesObjIdMap[nodeId] = splineObject;
    };

    SplineRender.prototype.deleteSpline = function(nodeId) {
        if (this.splinesObjIdMap[nodeId]) {
            this.container.remove(this.splinesObjIdMap[nodeId]);
            delete this.splinesObjIdMap[nodeId];
        }
    };


    SplineRender.prototype.updateSpline = function(nodeId, positions) {

        let localPositions = [];
        positions.forEach(function(pos) {
            let newPos = new THREE.Vector3(pos.x, 0, pos.y);
            localPositions.push(newPos);
        }.bind(this));

        if (!(nodeId in this.splinesIdMap)) {

            addSpline(nodeId, localPositions);

        } else {
            
            this.splinesObjIdMap[nodeId].visible = true;
            
            const curve = new THREE.CatmullRomCurve3(localPositions);

            this.splinesIdMap[nodeId].vertices = curve.getPoints( 50 );
            this.splinesIdMap[nodeId].verticesNeedUpdate = true;
            
        }
    };

    SplineRender.prototype.highlightSpline = function(nodeId, highlight) {
        let splineObj = this.splinesObjIdMap[nodeId];

        if (splineObj === undefined) return;

        if (highlight) {
            splineObj.material.color.setHex( 0x006611 );
        } else {
            splineObj.material.color.setHex( 0x000000 );
        }
    };

    exports.SplineRender = SplineRender;
})(window);
