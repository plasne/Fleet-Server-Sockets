
const request = require("request");

request({
    method: "POST",
    uri: "http://localhost:8000/msg",
    headers: {
        "gameId": "AAAA-BBB-CCCC",
        "toId": "psycho"
    },
    body: { msg: "hello" },
    json: true
}, function(err, response, body) {
    if (!err && response.statusCode == 200) {
        console.log("success");
    } else {
        console.error("err (" + response.statusCode + "): " + err);
    }
});