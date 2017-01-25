
// includes
const websocket = require("ws");

// start listening on specific port
const wss = new websocket.Server({ port: 8080 });

// globals
var games = [];

// wait for connections to be established
wss.on("connection", function(ws) {

    // references
    let game;
    let opponent;

    // received a message
    ws.on("message", function(raw) {

        // parse into a packet
        let packet = JSON.parse(raw);

        console.log("-----------------------");
        console.log("game: " + packet.gameId);
        console.log("from: " + packet.fromId);
        console.log(" cmd: " + packet.cmd);
        console.log("-----------------------");

        // get a connection to the opponent
        if (opponent == null) {

            // get a reference to the game
            game = games.find((game) => { return game.id == packet.gameId });
            if (game != null) {

                console.log("update or add self " + packet.fromId);

                // update or add self
                let self = game.players.find((player) => { return player.id == packet.fromId });
                if (self) {
                    self.ws = ws;
                } else {
                    game.players.push({
                        id: packet.fromId,
                        ws: ws
                    });
                }

                // get the opponent reference
                opponent = game.players.find((player) => { return player.id != packet.fromId });

            } else {

                console.log("create a game reference " + packet.fromId);

                // create a game reference
                game = {
                    id: packet.gameId,
                    players: [
                        {
                            id: packet.fromId,
                            ws: ws
                        }
                    ]
                }
                games.push(game);

            }

        }

        // process the message
        if (packet.cmd == "hello") {

            // the client announcing itself
            console.log("hello from " + packet.fromId);

        } else if (packet.cmd == "goodbye") {

            // the client is disconnecting; remove it from the game
            let selfIndex = game.players.findIndex((player) => { return player.id == packet.fromId });
            if (selfIndex > -1) game.players.splice(selfIndex, 1);
            
            // send a packet to the other player announcing the disconnect

        } else {

            // if there is an opponent connection, pass the message through, otherwise, fail
            if (opponent) {
                console.log("passed: %s", raw);
                opponent.ws.send(raw);
            } else {
                console.log("failed.");
                ws.send(JSON.stringify({ cmd: "fail" }));
            }

        }

    });

    ws.on("close", function() {
        console.log("player %s disconnected.");
    });

    ws.on("error", function(e) {
        console.log("error:" + e.message);
    });

});


// add express with an interface to query for the number of active games

// add a lastQuery to the game
// add setInterval to clean-up any old games