// node-opcua documentation: http://node-opcua.github.io/api_doc/2.0.0/index.html

/********************************** Imports ***********************************/

const {
    OPCUAClient,
    MessageSecurityMode,
    SecurityPolicy,
    AttributeIds,
    TimestampsToReturn,
    NodeClass,
    Variant,
    DataType,
    findServers
} = require('node-opcua');

/******************************* General Config *******************************/

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

/******************************* Main Contents ********************************/

class KepwareClient {
  constructor(_clientName) {
    this.connected = false;
    this.clientName = _clientName;
  }
  
  // Connects to a server.
  connect(endpointUrl, credentials) {
    // These are the default security options used by Kepware.
    // In theory, someone could set up their system to use a different security
    //     scheme and we'd want to adapt to that.
    const endpointOptions = {
      clientName: this.clientName,
      connectionStrategy: {
        initialDelay: 1000,
        maxRetry: 1
      },
      securityMode: MessageSecurityMode.SignAndEncrypt,
      securityPolicy: SecurityPolicy.Basic256Sha256,
      endpointMustExist: false
    }
    this.client = OPCUAClient.create(endpointOptions);
    
    if (!endpointUrl.includes('opc.tcp://')) {
      endpointUrl = `opc.tcp://${endpointUrl}`;
    }
    console.log(`Attempting connection to OPC UA endpoint at ${endpointUrl}`);
    return this.client.connect(endpointUrl).then(() => {
      return this.client.createSession(credentials).then(session => {
        console.log(`Successfully connected to OPC UA endpoint at ${endpointUrl}`);
        this.connected = true;
        this.session = session;
        session.createSubscription2(subscriptionParameters).then(subscription => {
          this.subscription = subscription;
        });
        return;
      });
    }).catch(err => {
      throw 'Failed to connect to OPC UA endpoint. Re-check your url and credentials.';
    });
  }
  
  // Disconnects from a server.
  disconnect() {
    this.connected = false;
    if (!this.session) {
      return Promise.resolve(null);
    }
    return this.session.close().catch(err => {
      throw `Error when disconnecting from Kepware server: ${err}`;
    });
  }
  
  // Returns a list of all tags available on the server.
  getAllTags() {
    if (!this.connected) {
      throw 'Must connect to Kepware server before getting tags.';
    }
    const getAllTagsHelper = nodeIds => {
      if (nodeIds.length === 0) {
        return Promise.resolve([]);
      }
      return this.session.browse(nodeIds).then(nodes => {
        return Promise.all(nodes.map(node => {
          const tags = node.references.filter(ref => {
            return ref.nodeClass === NodeClass.Variable;
          });
          // References are folders that can contain more nodes
          const references = node.references.filter(ref => {
            return ref.nodeClass === NodeClass.Object && !ref.browseName.name.startsWith('_') && ref.browseName.namespaceIndex != 0;
          });
          return getAllTagsHelper(references.map(ref => ref.nodeId)).then(allChildTags => {
            return allChildTags.flat().concat(tags);
          });
        }));
      });
    }
    return getAllTagsHelper(['ObjectsFolder']).then(tags => {
      return tags.flat().map(tag => {
        return {
          nodeId: tag.nodeId.toString(),
          name: tag.displayName.text,
        }
      });
    });
  }
  
  // Reads a value from a tag.
  readTag(tag) {
    if (!this.connected) {
      throw 'Must connect to Kepware server before reading tags.';
    }
    return this.session.readVariableValue(tag.nodeId).then(result => {
      return result.value.value;
    });
  }
  
  // Writes a value to a tag.
  writeTag(tag, value) {
    if (!this.connected) {
      throw 'Must connect to Kepware server before writing tags.';
    }
    this.session.getBuiltInDataType(tag.nodeId).then(dataType => {
      this.session.writeSingleNode(tag.nodeId, new Variant({dataType: dataType, value:value})).then(statusCode => {
        // console.log(`statusCode for writing ${tag.nodeId} with dataType ${dataType}`, statusCode);
      });
    });
  }
  
  // Creates a callback to read updates for a tag.
  // Returns a handle that can be used to terminate the monitoring. 
  monitorTag(tag, callback) {
    if (!this.connected) {
      throw 'Must connect to Kepware server before monitoring tags.';
    }
    const tagToMonitor = {
      nodeId: tag.nodeId,
      attributeId: AttributeIds.value
    };
    return this.subscription.monitor(tagToMonitor, monitoringParameters, TimestampsToReturn.Neither).then(monitoredItem => {
      monitoredItem.on("changed", result => {
        callback(result.value.value);
      });
      const kepwareClient = this;
      return {
        terminate() {
          if (!kepwareClient.connected) {
            return;
          }
          monitoredItem.terminate();
        }
      };
    })
  }
  
  // Reads the permissions available on a tag.
  getTagPermissions(tag) {
    if (!this.connected) {
      throw 'Must connect to Kepware server before reading tag permissions.';
    }
    return this.session.read({nodeId:tag.nodeId, attributeId: AttributeIds.UserAccessLevel}).then(data => {
      return {
        canRead: data.value.value % 2 == 1,
        canWrite: Math.floor(data.value.value / 2) % 2 == 1
      };
    });
  }

  // Asks an OPC UA discovery server for the list of endpoint servers it has available and returns that list.
  static discoverServers(discoveryUrl) {
    console.log(`Attempting connection to OPC UA discovery endpoint at ${discoveryUrl}`);
    return findServers(discoveryUrl).then(results => {
      console.log(`Successfully connected to OPC UA discovery endpoint at ${discoveryUrl}`);
      const servers = results.servers.filter(server=>server.applicationType === 0 || server.applicationType === 2); //0=Server,2=Server+Client
      return servers.map(server => { return {
        name: server.applicationName.text,
        urls: server.discoveryUrls
      }});
    }).catch(err => {
      throw 'Failed to connect to OPC UA discovery server. Re-check your url.';
    });
  }
}

module.exports = KepwareClient;