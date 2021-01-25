const KepwareClient = require('./kepwareClient');

const kepware = new KepwareClient('Spatial Toolbox');
kepware.connect('opc.tcp://ubuntuPtc:49330', {userName:'Administrator', password:'passwordpassword'}).then(() => {
  kepware.getAllTags().then(tags => {
    tags.forEach(tag => {
      
      // // Tag Reading
      // if (tag.name === 'Sine1') {
      //   kepware.readTag(tag).then(value => {
      //     console.log(`${tag.name}: ${value}`);
      //   });
      // }
      
      // Tag Monitoring
      if (tag.name === 'Sine1') {
        kepware.monitorTag(tag, value => {
          console.log(`${tag.name}: ${value}`);
        }).then(monitor => {
          setTimeout(() => monitor.terminate(), 10000);
        });
      }
      
      // // Tag Permissions
      // if (tag.name === 'Sine1') {
      //   kepware.getTagPermissions(tag).then(permissions => {
      //     console.log(`${tag.name}:\n  canRead:${permissions.canRead}\n  canWrite:${permissions.canWrite}`);
      //   })
      // }
    });
    setTimeout(() => kepware.disconnect(), 1000);
  });
});