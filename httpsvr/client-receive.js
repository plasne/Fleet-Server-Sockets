
const request = require("request");

request({
    method: "GET",
    uri: "http://localhost:8000/msg",
    headers: {
        gameId: "AAAA-BBB-CCCC",
        fromId: "psycho"
    }
}, function(err, response, body) {
    if (!err && response.statusCode == 200) {
        console.log(body);
    } else {
        console.error("err (" + response.statusCode + "): " + err);
    }
});