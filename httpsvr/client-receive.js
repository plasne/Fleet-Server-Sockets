
const request = require("request");

request({
    method: "GET",
    uri: "http://localhost:8000/msg"
}, function(err, response, body) {
    if (!err) {
        console.log(body);
    } else {
        console.error("err: " + err);
    }
});