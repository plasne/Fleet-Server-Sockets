
const request = require("request");

request({
    method: "POST",
    uri: "http://localhost:8000/msg",
    body: "hello"
}, function(err, response, body) {
    if (!err) {
        console.log("success");
    } else {
        console.error("err: " + err);
    }
});