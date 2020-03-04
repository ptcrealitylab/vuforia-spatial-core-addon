const fetch = require('node-fetch');

/**
*  This class connects to the MIR RESTful API
*  in order to get, post or delete information
*  from the robot's server.
*/
class restapiInterface {

    constructor(hostIP){

        // This variable contains the authorization to make requests:
        this._authorization = '[insert authorization here]';

        this.getData = this.getData.bind(this);
    }

    // Example GET method implementation:
    getData(url = '') {

        // Default options are marked with *

        return fetch(url, {
            method: "GET", // *GET, POST, PUT, DELETE, etc.
            mode: "cors", // no-cors, cors, *same-origin
            cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
            credentials: "same-origin", // include, *same-origin, omit
            headers: {
                "Content-Type": "application/json",
                "authorization": this._authorization,
            },
            redirect: "follow", // manual, *follow, error
            referrer: "no-referrer", // no-referrer, *client
        }).then(response => response.json(), response => {  // parses JSON response into native Javascript objects
            //console.log("ERROR: ", response);
            console.log('\x1b[36m%s\x1b[0m', "\nKINETIC AR: Couldn't GET data from REST API. Are you sure MIR robot is ON? ☹ ");
        });
        
    }

    // Example POST method implementation:
    postData(url = '', data = {}) {

        // Default options are marked with *
        return fetch(url, {
            method: "POST", // *GET, POST, PUT, DELETE, etc.
            mode: "cors", // no-cors, cors, *same-origin
            cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
            credentials: "same-origin", // include, *same-origin, omit
            headers: {
                "Content-Type": "application/json",
                "authorization": this._authorization,
            },
            redirect: "follow", // manual, *follow, error
            referrer: "no-referrer", // no-referrer, *client
            body: JSON.stringify(data), // body data type must match "Content-Type" header
        })
            .then(response => response.text())      // convert to plain text
    }

    // Example DELETE method implementation:
    deleteData(url = '') {

        // Default options are marked with *
        return fetch(url, {
            method: "DELETE", // *GET, POST, PUT, DELETE, etc.
            mode: "cors", // no-cors, cors, *same-origin
            cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
            credentials: "same-origin", // include, *same-origin, omit
            headers: {
                "Content-Type": "application/json",
                "authorization": this._authorization,
            },
            redirect: "follow", // manual, *follow, error
            referrer: "no-referrer" // no-referrer, *client
        })
            .then(response => response.text())      // convert to plain text
    }

    checkStatus(res) {
        if (res.ok) { // res.status >= 200 && res.status < 300
            return res;
        } else {
            throw console.error("ERROR: ", res.statusText);
        }
    }
}

exports.RestAPIInterface = restapiInterface;
