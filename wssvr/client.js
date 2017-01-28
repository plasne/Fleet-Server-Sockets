const websocket = require("ws");

var ws = new websocket("ws://pelasne-fleet.eastus.cloudapp.azure.com:83");
ws.on("open", function() {

    ws.send(JSON.stringify({
        gameId: "1111",
        fromId: "psycho",
        cmd: "hello"
    }));

    ws.on("message", function(data, flags) {
        console.log(data);
    });

});