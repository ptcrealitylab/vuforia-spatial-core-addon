// node-opcua documentation: http://node-opcua.github.io/api_doc/2.0.0/index.html

/********************************** Imports ***********************************/

const {
    OPCUAClient,
    MessageSecurityMode,
    SecurityPolicy,
    AttributeIds,
    makeBrowsePath,
    ClientSubscription,
    TimestampsToReturn,
    MonitoringParametersOptions,
    ReadValueIdLike,
    ClientMonitoredItem,
    DataValue,
    NodeClass,
    Variant,
    DataType,
    findServers
} = require('node-opcua');

/******************************* General Config *******************************/

const connectionStrategy = {
    initialDelay: 1000,
    maxRetry: 1
}

const subscriptionParameters = {
    requestedPublishingInterval: 300, // How often server pushes updates
    requestedLifetimeCount:      100, // How many publishing intervals can pass without client response before disconnecting client
    requestedMaxKeepAliveCount:   10, // How many publishing intervals get skipped when no new data is available before sending empty keep alive notification
    maxNotificationsPerPublish:  500,
    publishingEnabled: true,
    priority: 10
}

const monitoringParameters = {
    samplingInterval: -1, // Match publishing interval
    discardOldest: true,
    queueSize: 10
};

// These are the default security options used by Kepware.
// In theory, someone could set up their system to use a different security
//     scheme and we'd want to adapt to that.
// This is only used for the discovery endpoint, as the discovery endpoint tells
//     us how to connect to the OPC UA endpoints.
const endpointOptions = {
    clientName: "SpatialToolbox",
    connectionStrategy: connectionStrategy,
    securityMode: MessageSecurityMode.SignAndEncrypt,
    securityPolicy: SecurityPolicy.Basic256Sha256,
    endpointMustExist: false
}

/******************************* Main Contents ********************************/

class Kepware {
    constructor(_discoveryUrl, _credentials, _onItemAdd, _onItemUpdate, _onItemRemove) {
        this.discoveryUrl = _discoveryUrl; // URL of discovery server
        this.credentials = _credentials; // {userName, password}
        this.onItemAdd = _onItemAdd; // Callback function(item, permissions) | permissions = {canRead: boolean, canWrite: boolean}
        this.onItemUpdate = _onItemUpdate; // Callback function(item, result) | call result.value.value to get value
        this.onItemRemove = _onItemRemove; // Callback function(item)
        this.monitoredItems = {}; // Keeps track of items
        this.disconnected = false;
    }
    
    // Handles closing connections and removing subscriptions to updates.
    disconnect() {
        this.disconnected = true;
        if (this.refreshItemsInterval) {
            clearInterval(this.refreshItemsInterval);
            delete this.refreshItemsInterval;
        }
        Promise.all(Object.keys(this.monitoredItems).map((nodeId, index) => {
            return new Promise((resolve, reject) => {
                setTimeout(() => { // Stagger terminations
                    this.monitoredItems[nodeId].monitor.terminate().then(() => {
                        resolve();
                    }, err => {
                        console.error(`Failed to terminate item monitoring`);
                        reject(err);
                    });
                    this.onItemRemove(this.monitoredItems[nodeId].item);
                    delete this.monitoredItems[nodeId];
                }, index * 15); // Stagger requests to avoid overwhelming server
            });
        })).then(() => {
            if (this.subscription) {
                this.subscription.terminate().then(() => {
                    delete this.subscription;
                    console.log('Terminated subscription');
                }, err => console.error(`Failed to terminate subscription\n${err}`));
            }
            if (this.session) {
                this.session.close().then(() => {
                    delete this.session;
                    console.log('Closed session');
                }, err => console.error(`Failed to close session\n${err}`));
            }
            if (this.client) {
                this.client.disconnect().then(() => {
                    delete this.client;
                    console.log('Disconnected from client');
                }, err => console.error(`Failed to close session\n${err}`));
            }
        });
    }
    
    // Need to connect to discovery endpoint first to determine how to connect
    //     to OPC UA endpoint.
    connect() {
        if (this.disconnected) return;
        console.log(`Attempting connection to OPC UA discovery endpoint at ${this.discoveryUrl}`);
        findServers(this.discoveryUrl).then(results => {
            console.log(`Successfully connected to OPC UA discovery endpoint at ${this.discoveryUrl}`);
            this.client = OPCUAClient.create(endpointOptions);
            const servers = results.servers.filter(server=>server.applicationType === 0 || server.applicationType === 2); //0=Server,2=Server+Client
            if (servers.length === 0) {
                console.error('No endpoints found in OPC UA discovery endpoint');
                return;
            }
            console.log('Successfully fetched endpoints from OPC UA discovery endpoint');
            this.endpointUrls = servers[0].discoveryUrls;
            this.endpointIndex = 0;
            this.endpointUrl = this.endpointUrls[this.endpointIndex];
            this.clientConnect();
        }, err => {
            const localDiscoveryUrl = new URL(this.discoveryUrl);
            if (localDiscoveryUrl.hostname.indexOf('.') === -1) { // In case of machine hostname on local network (e.g. opc.tcp://ubuntuServer:49330)
                localDiscoveryUrl.hostname += '.local'; // Resolve hostname properly (e.g. opc.tcp://ubuntuServer.local:49330)
                this.endpointUrl = localDiscoveryUrl.href;
                this.clientConnect(); // Won't loop endlessly, because hostname now has `.`
            } else {
                console.error(`Failed to connect to OPC UA discovery endpoint at ${this.discoveryUrl}\n${err}`)
            }
        });
    }
    
    // Connects to an OPC UA endpoint after the discovery process.
    // Loops through all available endpoints until it connects successfully.
    // Could benefit from allowing the user to choose an endpoint to connect to.
    clientConnect() {
        if (this.disconnected) return;
        console.log(`Attempting connection to OPC UA endpoint at ${this.endpointUrl}`);
        this.client.connect(this.endpointUrl).then(() => {
            console.log(`Successfully connected to OPC UA endpoint at ${this.endpointUrl}`);
            this.createSession();
        }, err => {
            const localEndpointUrl = new URL(this.endpointUrl);
            if (localEndpointUrl.hostname.indexOf('.') === -1) { // In case of machine hostname on local network (e.g. opc.tcp://ubuntuServer:49330)
                localEndpointUrl.hostname += '.local'; // Resolve hostname properly (e.g. opc.tcp://ubuntuServer.local:49330)
                this.endpointUrl = localEndpointUrl.href;
                this.clientConnect(); // Won't loop endlessly, because hostname now has `.`
            } else {
                console.error(`Failed to connect to OPC UA endpoint at ${this.endpointUrl}\n${err}`);
                this.endpointIndex += 1; // On failure to connect, try the next endpoint
                if (this.endpointIndex < this.endpointUrls.length) {
                    this.endpointUrl = this.endpointUrls[this.endpointIndex];
                    this.clientConnect();
                }
            }
        });
    }
    
    // Sets up an OPC UA session with the endpoint to enable subscriptions and
    //     other access to data.
    createSession() {
        if (this.disconnected) return;
        this.client.createSession(this.credentials).then(session => {
          if (this.disconnected) return;
            this.session = session;
            console.log(`Logged in to OPC UA endpoint session as ${this.credentials.userName}`);
            this.subscription = ClientSubscription.create(session, subscriptionParameters);
            this.subscription.on("started", function() {
                console.log("OPC UA subscription started");
            }).on("terminated", function() {
                console.log("OPC UA subscription terminated");
            });
            this.refreshItems();
            this.refreshItemsInterval = setInterval(() => this.refreshItems(), 5000);
        }, err => console.error(`Failed to create OPC UA endpoint session\n${err}`));
    }
    
    // Reads the value of a tag.
    readItem(item) {
        return this.session.readVariableValue(item.nodeId).then(result => {
            return result.value.value;
        }, err => console.error(`Failed to read value from ${item.nodeId}\n${err}`));
    }
    
    // Writes a value to a tag.
    writeItem(item, value) {
        this.session.getBuiltInDataType(item.nodeId).then(dataType => {
            this.session.writeSingleNode(item.nodeId, new Variant({dataType: dataType, value:value})).then(statusCode => {
                // console.log(`statusCode for writing ${item.nodeId} with dataType ${dataType}`, statusCode);
            }, err => console.error(`Failed to write value to ${item.nodeId}\n${err}`));
        }, err => console.error(`Failed to get data type for ${item.nodeId}\n${err}`));
    }

    // Creates a subscription to read updates for an item, and calls callbacks
    //     accordingly.
    monitorItem(item) {
        const itemToMonitor = {
          nodeId: item.nodeId,
          attributeId: AttributeIds.value
        };
      
        this.subscription.monitor(itemToMonitor, monitoringParameters, TimestampsToReturn.Neither).then(monitoredItem => {
          monitoredItem.on("changed", result => {
            // console.log(`Monitored item update for ${item.nodeId.toString().slice(0, item.nodeId.toString().lastIndexOf('.'))} ${item.browseName.name}: ${result.value.value}`);
            this.onItemUpdate(item, result)
          });
          this.monitoredItems[item.nodeId.value] = {item: item, monitor: monitoredItem};
        })
    }
    
    // Keeps track of tags available at the OPC UA endpoint and calls callbacks
    //     to allow the interface to instantiate or remove nodes accordingly.
    // Folder structure over OPC UA is
    //     ObjectsFolder > [Channel] > [Device] > [Tag]
    refreshItems() {
        if (this.disconnected) return;
        this.findAllVariables('ObjectsFolder').then(variables => {
            const removedNodeIds = Object.keys(this.monitoredItems).filter(monitoredNodeId => {
                return variables.filter(variable => {
                    return variable.nodeId.value === monitoredNodeId;
                }).length === 0;
            });
            if (removedNodeIds.length > 0) {
                console.log(`Removing ${removedNodeIds.length} OPC UA variables that no longer exist on the server`);
            }
            const newNodeIds = variables.filter(variable => {
                return Object.keys(this.monitoredItems).filter(monitoredNodeId => {
                    return monitoredNodeId === variable.nodeId.value;
                }).length === 0;
            }).map(variable => variable.nodeId.value);
            removedNodeIds.map(nodeId => {
                setTimeout(() => { // Stagger removals
                    this.monitoredItems[nodeId].monitor.terminate();
                    this.onItemRemove(this.monitoredItems[nodeId].item);
                    delete this.monitoredItems[nodeId];
                }, Math.random() * 1000);
            });
            variables = variables.filter(variable => newNodeIds.includes(variable.nodeId.value));
            if (variables.length > 0) {
                console.log(`Subscribed to ${variables.length} new OPC UA variables, currently subscribed to ${Object.keys(this.monitoredItems).length + variables.length} variables`);
            }
            variables.map((variable, index) => {
                setTimeout(() => {
                    this.monitorItem(variable);
                    this.session.read({nodeId:variable.nodeId, attributeId: AttributeIds.UserAccessLevel}).then(data => {
                        const permissions = {
                            canRead: data.value.value % 2 == 1,
                            canWrite: Math.floor(data.value.value / 2) % 2 == 1
                        };
                        this.onItemAdd(variable, permissions);
                    });
                },index * 15); // Stagger requests to avoid overwhelming server
            });
        }, err => console.error(`Failed to find variables\n${err}`));
    }

    // Recursively returns all tags (variables) found on the OPC UA endpoint.
    findAllVariables(nodeId) {
        return this.session.browse(nodeId).then(result => {
            const variables = result.references.filter(ref => {
                return ref.nodeClass === NodeClass.Variable;
            });
            const references = result.references.filter(ref => {
                return ref.nodeClass === NodeClass.Object && !ref.browseName.name.startsWith('_') && ref.browseName.namespaceIndex != 0;
            });
            return Promise.all(references.map(ref => this.findAllVariables(ref.nodeId))).then(allResults => {
                return allResults.flat().concat(variables);
            });
        }, err => {
            console.error(`Browse failed\n${err}`);
            return [];
        });
    }
    
    // Helper function to split up nodeIds into distinct parts.
    static parseId(nodeId) {
        const split = nodeId.value.split('.');
        if (split.length === 3) {
            return {
                channelName: split[0],
                deviceName: split[1],
                groupName: split[2], // If not in a group, consider it in a group of itself
                tagName: split[2]
            }
        }
        return {
            channelName: split[0],
            deviceName: split[1],
            groupName: split.slice(2, split.length - 1).join('.'),
            tagName: split[split.length - 1]
        }
    }
}

module.exports = Kepware;