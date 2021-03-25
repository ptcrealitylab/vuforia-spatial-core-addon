/* global THREE, MeshLine, MeshLineMaterial, window */

(function(exports) {

    function SplineRender(mainContainer, splineTexture) {

        this.container = mainContainer;
        this.splinesIdMap = {};
        this.splinesObjIdMap = {};
        this.textureArrow = splineTexture;
        this.textureArrow.wrapS = THREE.RepeatWrapping;
        addSpline = addSpline.bind(this);
    }

    let addSpline = function(nodeId, positions) {
        const curve = new THREE.CatmullRomCurve3(positions);
        const points = curve.getPoints(50);
        const geometry = new THREE.Geometry();
        geometry.vertices = points;

        const spline = new MeshLine();
        spline.setGeometry(geometry);

        let lineMaterial = new MeshLineMaterial({
            map: this.textureArrow,
            useMap: true,
            repeat: new THREE.Vector2(points.length, 1),
            color: new THREE.Color('#ffffff'),
            transparent: true,
            lineWidth: 30,
            resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
            dashArray: 0,     // always has to be the double of the line
            dashOffset: 0,    // start the dash at zero
            dashRatio: 0,     // visible length range
            sizeAttenuation: true,
        });

        let splineObject = new THREE.Mesh(spline.geometry, lineMaterial);
        //let splineObject = new THREE.Line(geometry, this.lineMaterial);
        this.container.add(splineObject);

        this.splinesIdMap[nodeId] = spline;
        this.splinesObjIdMap[nodeId] = splineObject;
    };

    SplineRender.prototype.deleteSpline = function(nodeId) {
        if (this.splinesObjIdMap[nodeId]) {
            this.container.remove(this.splinesObjIdMap[nodeId]);
            delete this.splinesObjIdMap[nodeId];
            delete this.splinesIdMap[nodeId];
        }
    };


    SplineRender.prototype.updateSpline = function(nodeId, positions) {
        let localPositions = [];
        positions.forEach((pos) => {
            let newPos = new THREE.Vector3(pos.x, 0, pos.y);
            localPositions.push(newPos);
        });

        if (!(nodeId in this.splinesIdMap)) {
            addSpline(nodeId, localPositions);
            return;
        }

        this.splinesObjIdMap[nodeId].visible = true;

        const curve = new THREE.CatmullRomCurve3(localPositions);
        const points = curve.getPoints(50);
        const geometry = new THREE.Geometry();
        geometry.vertices = points;

        this.splinesIdMap[nodeId].setGeometry(geometry);
    };

    SplineRender.prototype.highlightSpline = function(nodeId, highlight) {
        let splineObj = this.splinesObjIdMap[nodeId];

        if (splineObj === undefined) return;

        if (highlight) {
            splineObj.material.color.setHex(0x006611);
        } else {
            splineObj.material.color.setHex(0x000000);
        }
    };

    exports.SplineRender = SplineRender;
})(window);
