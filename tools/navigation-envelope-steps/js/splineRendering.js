(function(exports) {

    function SplineRender(mainContainer) {
        
        this.container = mainContainer;
        this.splinesIdMap = [];
        this.splinesObjIdMap = [];
        addSpline = addSpline.bind(this);
        
    }

    function addSpline(nodeId, positions) {
        
        // MESHLINE
        
        console.log('NEW SPLINE: ', nodeId);

        console.log('Create points');
        const curve = new THREE.CatmullRomCurve3(positions);
        const points = curve.getPoints( 50 );

        let geometry = new THREE.Geometry();
        geometry.vertices = points;

        console.log('Create spline');
        let spline = new MeshLine();
        spline.setGeometry( geometry );

        let textureArrow = new THREE.TextureLoader().load ('resources/pathArrow2.png');

        console.log('Create material');
        
        textureArrow.wrapS = THREE.RepeatWrapping;
        const material = new MeshLineMaterial({
            map: textureArrow,
            useMap: true,
            repeat: new THREE.Vector2(20, 1),
            transparent: true,
            lineWidth: 60,
            color: new THREE.Color('#ffffff'),
            dashArray: 0,     // always has to be the double of the line
            dashOffset: 0,    // start the dash at zero
            dashRatio: 0,     // visible length range
            sizeAttenuation: true
            
        });

        let splineObject = new THREE.Mesh( spline.geometry, material );
        this.container.add( splineObject );
        
        console.log('NODE ID: ', nodeId);
        
        this.splinesIdMap[nodeId] = spline;
        this.splinesObjIdMap[nodeId] = splineObject;
        
    }
    

    SplineRender.prototype.updateSpline = function(nodeId, positions) {
        
        let localPositions = [];
        positions.forEach(function(pos) {
            let newPos = new THREE.Vector3(pos.x, 0, pos.y);
            localPositions.push(newPos);
        }.bind(this));

        if (!(nodeId in this.splinesIdMap)) {
            
            addSpline(nodeId, localPositions);
            
        } else {
            
            let thisSpline = this.splinesIdMap[nodeId];

            const curve = new THREE.CatmullRomCurve3(localPositions);
            const points = curve.getPoints( 50 );

            var geometry = new THREE.Geometry();
            geometry.vertices = points;

            thisSpline.setGeometry( geometry );
        }
        
    };

    SplineRender.prototype.highlightSpline = function(nodeId, highlight) {
        let splineObj = this.splinesObjIdMap[nodeId];
        
        if (splineObj === undefined) return;
        
        if (highlight){
            splineObj.material.color.setHex( 0x006611 );
        } else {
            splineObj.material.color.setHex( 0x000000 );
        }
    };
          
    exports.SplineRender = SplineRender;
})(window);
