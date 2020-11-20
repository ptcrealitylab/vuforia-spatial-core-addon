(function(exports) {
    
    function Node(x, y, z, radius, color, presetId, weightFactor) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.radius = radius || 20;
        this.color = color || 'blue';
        this.id = presetId || uuidTimeShort();
        this.weightFactor = weightFactor || 1;
    }

    function Edge(nodeA, nodeB, weight) {
        this.nodeA = nodeA;
        this.nodeB = nodeB;
        this.weight = weight || 1;
        this.id = 'edge_' + nodeA.id + '_' + nodeB.id;
    }
    
    function Pathfinder() {
        // these are configured by user
        this.pointsOfInterest = [];
        this.obstacles = [];
        // these are computed based on PoIs and obstacles
        this.nodes = [];
        this.edges = [];
        this.averageDistance = 1000;
        this.nodeIdMap = {};
        this.edgeIdMap = {};
        this.map = {};
    }
    
    Pathfinder.prototype.addPointOfInterest = function(nodeId) {
        let newNode = new Node(0, 0, 0, 20, 'blue', nodeId);
        this.pointsOfInterest.push(newNode);
        this.nodeIdMap[newNode.id] = newNode;
    };
    
    Pathfinder.prototype.addObstacle = function(nodeId) {
        let newNode = new Node(0, 0, 0, 40, 'red', nodeId);
        this.obstacles.push(newNode);
        this.nodeIdMap[newNode.id] = newNode;
    };

    Pathfinder.prototype.removePointOfInterest = function(nodeId) {
        let thisNode = this.nodeIdMap[nodeId];
        let index = this.pointsOfInterest.indexOf(thisNode);
        if (index > -1) {
            this.pointsOfInterest.splice(index, 1);
        }
    };

    Pathfinder.prototype.removeObstacle = function(nodeId) {
        let thisNode = this.nodeIdMap[nodeId];
        let index = this.obstacles.indexOf(thisNode);
        if (index > -1) {
            this.obstacles.splice(index, 1);
        }
    };

    Pathfinder.prototype.updateNodePosition = function(nodeId, centerX, centerY, centerZ) {
        let node = this.nodeIdMap[nodeId];
        if (typeof centerX !== 'undefined') {
            node.x = centerX;
        }
        if (typeof centerY !== 'undefined') {
            node.y = centerY;
        }
        if (typeof centerZ !== 'undefined') {
            node.z = centerZ;
        }
    };

    Pathfinder.prototype.updateNodeRadius = function(nodeId, radius) {
        let node = this.nodeIdMap[nodeId];
        node.radius = radius;
    };

    // run this eaach time before calling computeShortestsPaath
    Pathfinder.prototype.precomputeGraph = function() {
        
        // 1. ------- Compute all nodes -------
        this._computeAllNodes();
        this.averageDistance = this._getAverageDistanceBetweenNodes();
        
        // 2. ------- Compute all edges -------
        this._computeAllEdges();
        
        this.map = {};
        this.nodes.forEach(function(node) {
            this.map[node.id] = {};
        }.bind(this));
        
        this.edges.forEach(function(edge) {
            this.map[edge.nodeA.id][edge.nodeB.id] = edge.weight;
        }.bind(this));
        
        return new Graph(this.map);
    };
    
    Pathfinder.prototype._computeAllNodes = function() {
        this.nodes = [];

        let inBetweenNodes = [];

        // add nodes for each point of interest
        this.pointsOfInterest.forEach(function(node) {
            // this.nodes.push(node);
            this.addNode(node);

            // also create nodes between every pair of pointsOfInterest
            this.pointsOfInterest.forEach(function(nodeB) {
                if (node === nodeB) { return; } // don't add reflexive
                let newX = (node.x + nodeB.x) / 2;
                let newY = (node.y + nodeB.y) / 2;
                let newZ = (node.z + nodeB.z) / 2;
                if (inBetweenNodes.some(function(alreadyCreatedNode) {
                    return (alreadyCreatedNode.x === newX && alreadyCreatedNode.y === newY && alreadyCreatedNode.z === newZ);
                })) {
                    return;
                }
                let preferredWeightFactor = 0.9; // prefer these over other routes
                let inBetween = new Node(newX, newY, newZ, 10, 'green', node.id+'_'+nodeB.id, preferredWeightFactor);
                inBetweenNodes.push(inBetween);
                this.addNode(inBetween);

            }.bind(this));
            
        }.bind(this));
        
        this.obstacles.forEach(function(node) {

            // also create nodes around each obstacle
            let obstacleRadius = node.radius * 2; // put the routable nodes slightly beyond tool border
            let upperLeftFront = new Node(node.x - obstacleRadius, node.y - obstacleRadius, node.z - obstacleRadius, 10, 'red', node.id+'_ULF');
            let upperRightFront = new Node(node.x + obstacleRadius, node.y - obstacleRadius, node.z - obstacleRadius,10, 'red', node.id+'_URF');
            let lowerLeftFront = new Node(node.x - obstacleRadius, node.y + obstacleRadius, node.z - obstacleRadius,10, 'red', node.id+'_LLF');
            let lowerRightFront = new Node(node.x + obstacleRadius, node.y + obstacleRadius, node.z - obstacleRadius,10, 'red', node.id+'_LRF');
            this.addNode(upperLeftFront);
            this.addNode(upperRightFront);
            this.addNode(lowerLeftFront);
            this.addNode(lowerRightFront);
            let upperLeftBack = new Node(node.x - obstacleRadius, node.y - obstacleRadius, node.z + obstacleRadius, 10, 'red', node.id+'_ULB');
            let upperRightBack = new Node(node.x + obstacleRadius, node.y - obstacleRadius, node.z + obstacleRadius,10, 'red', node.id+'_URB');
            let lowerLeftBack = new Node(node.x - obstacleRadius, node.y + obstacleRadius, node.z + obstacleRadius,10, 'red', node.id+'_LLB');
            let lowerRightBack = new Node(node.x + obstacleRadius, node.y + obstacleRadius, node.z + obstacleRadius,10, 'red', node.id+'_LRB');
            this.addNode(upperLeftBack);
            this.addNode(upperRightBack);
            this.addNode(lowerLeftBack);
            this.addNode(lowerRightBack);

            // also create nodes between every pair of obstacles
            this.obstacles.forEach(function(nodeB) {
                if (node === nodeB) { return; } // don't add reflexive
                let newX = (node.x + nodeB.x) / 2;
                let newY = (node.y + nodeB.y) / 2;
                let newZ = (node.z + nodeB.z) / 2;
                if (inBetweenNodes.some(function(alreadyCreatedNode) {
                    return (alreadyCreatedNode.x === newX && alreadyCreatedNode.y === newY && alreadyCreatedNode.z === newZ);
                })) {
                    return;
                }
                let preferredWeightFactor = 1.0; //0.9;
                let inBetween = new Node(newX, newY, newZ, 10, 'green', node.id+'_'+nodeB.id, preferredWeightFactor);
                inBetweenNodes.push(inBetween);
                this.addNode(inBetween);
                
            }.bind(this));

        }.bind(this));
    };
    
    Pathfinder.prototype._getAverageDistanceBetweenNodes = function() {
        let totalDistance = 0;
        let count = 0;
        this.nodes.forEach(function(nodeA) {
            this.nodes.forEach(function(nodeB) {
                if (nodeA === nodeB) {
                    return;
                } // don't add reflexive
                let dx = nodeB.x - nodeA.x;
                let dy = nodeB.y - nodeA.y;
                let dz = nodeB.z - nodeA.z;
                let distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                totalDistance += distance;
                count++;
            }.bind(this));
        }.bind(this));
        if (count < 1) {
            return 1000; // default was arbitrarily chosen to be 1000
        }
        return totalDistance / count;
    };

    Pathfinder.prototype._distanceToClosestObstacle = function(node) {
        let closestDistance = 100000; // arbitrarily large number if no obstacles;
        this.obstacles.forEach(function(obstacle) {
            let dx = obstacle.x - node.x;
            let dy = obstacle.y - node.y;
            let dz = obstacle.z - node.z;
            let distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (distance < closestDistance) {
                closestDistance = distance;
            }
        }.bind(this));
        return closestDistance;
    };

    Pathfinder.prototype.addNode = function(node) {
        this.nodes.push(node);
        this.nodeIdMap[node.id] = node;
    };
    
    Pathfinder.prototype.addEdge = function(edge) {
        this.edges.push(edge);

        if (typeof this.edgeIdMap[edge.nodeA.id] === 'undefined') {
            this.edgeIdMap[edge.nodeA.id] = {};
        }
        this.edgeIdMap[edge.nodeA.id][edge.nodeB.id] = edge;
    };
    
    Pathfinder.prototype._computeAllEdges = function() {
        this.edges = [];

        this.nodes.forEach(function(nodeA) {
            this.nodes.forEach(function(nodeB) {
                if (nodeA === nodeB) { return; } // don't add reflexive, but do add symmetric
                let dx = nodeB.x - nodeA.x;
                let dy = nodeB.y - nodeA.y;
                let dz = nodeB.z - nodeA.z;
                let distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

                let nodeADist = this._distanceToClosestObstacle(nodeA); // TODO: implement function as class method
                let nodeBDist = this._distanceToClosestObstacle(nodeB);
                let thisNodeDistance = (nodeADist + nodeBDist) / 2;
                let obstacleWeightFactor = Math.sqrt(this.averageDistance / thisNodeDistance);

                let edge = new Edge(nodeA, nodeB, distance * obstacleWeightFactor);
                // this.edges.push(edge);
                this.addEdge(edge);
            }.bind(this));
        }.bind(this));

        // remove any edges that pass through an obstacle
        this.obstacles.forEach(function(node) {
            // shrink the obstacle hit-box a little so it doesn't prune lines that skirt around it
            // let circle = new Circle((node.radius * 0.99), new Point(node.x, node.y)); // TODO: CHANGE TO 3D INTERSECTION
            
            // get the upperLeftFront box corner and the lowerRightBack box corner
            let upperLeftFront = this.nodeIdMap[node.id+'_ULF'];
            let lowerRightBack = this.nodeIdMap[node.id+'_LRB'];
            let boxCorner1 = [upperLeftFront.x, upperLeftFront.y, upperLeftFront.z];
            let boxCorner2 = [lowerRightBack.x, lowerRightBack.y, lowerRightBack.z];

            let edgesToRemove = [];

            this.edges.forEach(function(edge) {
                let linePoint1 = [edge.nodeA.x, edge.nodeA.y, edge.nodeA.z];
                let linePoint2 = [edge.nodeB.x, edge.nodeB.y, edge.nodeB.z];
                
                let doesIntersectObstacle = isSegmentIntersectingBox(linePoint1, linePoint2, boxCorner1, boxCorner2);
                
                if (doesIntersectObstacle) {
                    edgesToRemove.push(edge);
                }
                // let line = new Line(new Point(edge.nodeA.x, edge.nodeA.y), new Point(edge.nodeB.x, edge.nodeB.y));
                // let intercepts = interceptCircleLineSeg(circle, line);
                // if (intercepts.length > 0) {
                //     edgesToRemove.push(edge);
                // }
            });

            edgesToRemove.forEach(function(edge) {
                let index = this.edges.indexOf(edge);
                this.edges.splice(index, 1);
            }.bind(this));
        }.bind(this));
    };
    
    Pathfinder.prototype.computeShortestPath = function(startNodeId, endNodeId) {
        let thisGraph = this.precomputeGraph();
        
        let shortestPath = thisGraph.findShortestPath(startNodeId, endNodeId);

        if (!shortestPath) {
            console.warn('could not find any valid paths from start to end');
        }

        let shortestPathNodes = this.getShortestPathNodes(shortestPath);
        // console.log('nodes', shortestPathNodes);
        let shortestPathEdges = this.getShortestPathEdges(shortestPath);
        
        return {
            nodes: shortestPathNodes,
            edges: shortestPathEdges
        };
    };

    Pathfinder.prototype.getShortestPathNodes = function(shortestPath) {
        if (!shortestPath || shortestPath.length < 2) {
            return [];
        }

        let selectedNodes = [];
        shortestPath.forEach(function(nodeId) {
            // find the node with corresponding nodeId
            selectedNodes.push(this.nodeIdMap[nodeId]);
        }.bind(this));
        return selectedNodes;
    };

    Pathfinder.prototype.getShortestPathEdges = function(shortestPath) {
        if (!shortestPath || shortestPath.length < 2) {
            return [];
        }

        let selectedEdges = [];
        for (let i = 0; i < shortestPath.length - 1; i++) {
            let startId = shortestPath[i];
            let endId = shortestPath[i+1];
            // find the edge that goes from startId -> endId
            selectedEdges.push(this.edgeIdMap[startId][endId]);
        }
        return selectedEdges;
    };
    
    // ----- Utilities ----- //
    
    function isSegmentIntersectingBox(linePoint1, linePoint2, boxCorner1, boxCorner2) {
        // segment will intersect box unless its interval is not overlapping the box in the x, y, or z dimensions
        for (let i = 0; i < linePoint1.length; i++) {
            if (!areIntervalsIntersecting(linePoint1[i], linePoint2[i], boxCorner1[i], boxCorner2[i])) {
                return false;
            }
        }
        return true;
    }
    
    // inspired by https://stackoverflow.com/a/6307612
    function areIntervalsIntersecting(a0, a1, b0, b1) {
        // swaps order if needed
        if (a1 < a0) {
            let temp1 = a1;
            a1 = a0;
            a0 = temp1;
        }

        if (b1 < b0) {
            let temp1 = b1;
            b1 = b0;
            b0 = temp1;
        }

        // # 6 conditions:
        //
        // # 1)
        // #        a0 ---------- a1                              a0 < b0 and a1 < b0
        // #                             b0 ---------- b1         (no intersection)
        //
        // # 2)
        // #               a0 ---------- a1
        // #                      b0 ---------- b1                (intersection)
        //
        // # 3)
        // #               a0 ------------------------ a1
        // #                      b0 ---------- b1                (intersection)
        //
        // # 4)
        // #                      a0 ---------- a1
        // #               b0 ------------------------ b1         (intersection)
        //
        // # 5)
        // #                             a0 ---------- a1         (intersection)
        // #                      b0 ---------- b1
        //
        // # 6)
        // #                                    a0 ---------- a1  b0 < a0 and b1 < a0
        // #               b0 ---------- b1                       (no intersection)

        if (b0 < a0) {
            // # conditions 4, 5 and 6
            return a0 < b1; // # conditions 4 and 5
        } else {
            // # conditions 1, 2 and 3
            return b0 < a1; // # conditions 2 and 3
        }

    }

    /**
     * Generates a random 8 character unique identifier using uppercase, lowercase, and numbers (e.g. "jzY3y338")
     * @return {string}
     */
    function uuidTimeShort() {
        var dateUuidTime = new Date();
        var abcUuidTime = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        var stampUuidTime = parseInt("" + dateUuidTime.getMilliseconds() + dateUuidTime.getMinutes() + dateUuidTime.getHours() + dateUuidTime.getDay()).toString(36);
        while (stampUuidTime.length < 8) stampUuidTime = abcUuidTime.charAt(Math.floor(Math.random() * abcUuidTime.length)) + stampUuidTime;
        return stampUuidTime;
    }

    exports.Pathfinder = Pathfinder;
})(window);
