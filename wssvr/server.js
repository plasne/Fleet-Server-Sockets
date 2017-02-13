
// includes
const websocket = require("uws");
const express = require("express");

// startup express and websockets
const app = express();
const wss = new websocket.Server({ port: 8080 });
wss.startAutoPing(2000);

// globals
var games = [];

// respond to calls for status
app.get("/status", function(req, res) {
    res.send({
        games: games.length
    });
});

// wait for connections to be established
wss.on("connection", function(ws) {

    // references
    let game;
    let self;
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
        if (game == null || self == null || self.ws == null || opponent == null || opponent.ws == null) {

            // get a reference to the game
            game = games.find((game) => { return game.id == packet.gameId });
            if (game != null) {

                console.log("update or add self " + packet.fromId);

                // update or add self
                self = game.players.find((player) => { return player.id == packet.fromId });
                if (self) {
                    self.ws = ws;
                } else {
                    self = {
                        id: packet.fromId,
                        ws: ws,
                        lastQuery: 0
                    }
                    game.players.push(self);
                    game.status = "running";
                }

                // get the opponent reference
                opponent = game.players.find((player) => { return player.id != packet.fromId });

            } else {

                console.log("create a game reference " + packet.fromId);

                // create self
                self = {
                    id: packet.fromId,
                    ws: ws,
                    lastQuery: 0
                }

                // create a game reference
                game = {
                    id: packet.gameId,
                    status: "creating",
                    players: [ self ]
                }
                games.push(game);

            }

        }

        // record the lastQuery
        self.lastQuery = Date.now();

        // process the message
        if (packet.cmd == "hello") {

            // the client announcing itself
            console.log("hello from " + packet.fromId);

        } else if (packet.cmd == "goodbye") {

            // the client is disconnecting; remove it from the game
            let selfIndex = game.players.findIndex((player) => { return player.id == packet.fromId });
            if (selfIndex > -1) game.players.splice(selfIndex, 1);
            
            // send a packet to the other player announcing the disconnect
            if (opponent && opponent.ws) {
                opponent.ws.send(JSON.stringify({ cmd: "quit" }));
            }

        } else {

            // if there is an opponent connection, pass the message through, otherwise, fail
            if (opponent && opponent.ws) {
                opponent.ws.send(raw, function(err) {
                    if (!err) {
                        console.log("success from %s to %s", self.id, opponent.id);
                        ws.send(JSON.stringify({ cmd: "success" }), function(err) {
                            // simply catch error
                        });
                    } else {
                        console.log("send exception: " + err);
                        ws.send(JSON.stringify({ cmd: "fail" }), function(err) {
                            // simply catch error
                        });
                    }
                });
            } else {
                console.log("fail from %s", self.id);
                ws.send(JSON.stringify({ cmd: "fail" }), function(err) {
                    // simply catch error
                });
            }

        }

    });

    /*
    ws.on("close", function() {

        // drop reference to ws
        self.ws = null;

        // notify the opponent
        if (opponent && opponent.ws) {
            console.log("notified opponent %s of disconnect.", opponent.id);
            opponent.ws.send(JSON.stringify({ cmd: "fail" }), function(err) {
                // simply catch error
            });
        }

        // log
        if (self) {
            console.log("player %s disconnected.", self.id);
        } else {
            console.log("unknown player disconnected.");
        }

    });

    ws.on("error", function(e) {
        console.log("error:" + e.message);
    });
    */

});

// start listening
app.listen(8001, function() {
    console.log("listening on port 8001...");
});

// clean-up old games
setInterval(function() {
    const timestamp = Date.now();

    // disconnect any game that has a player that is dormant for 15 minutes or more
    games.forEach((game) => {
        game.players.forEach((player) => {
            if (timestamp - player.lastQuery > 1000 * 60 * 15 || game.status === "disconnected") {
                game.status = "disconnected";
                if (player.ws) {
                    player.ws.send(JSON.stringify({ cmd: "inactive" }), function(err) {
                        // simply catch error
                    });
                }
            }
        });
    });
    games = games.filter((game) => { return game.status !== "disconnected" });
    
}, 20000);