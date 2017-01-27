
// includes
const express = require("express");
const uuid = require("node-uuid");
const request = require("request");

// startup express
const app = express();

// create the lobbies
var lobbies = [];

// the servers will contain all possible URLs and the number of games hosted with each
var servers = [
    {
        url: "http://game01:8001",
        ws: "ws://pelasne-fleet.eastus.cloudapp.azure.com:81",
        games: 0,
        status: "unverified",
        lastQuery: 0
    }, {
        url: "http://game02:8001",
        ws: "ws://pelasne-fleet.eastus.cloudapp.azure.com:82",
        games: 0,
        status: "unverified",
        lastQuery: 0
    }, {
        url: "http://game03:8001",
        ws: "ws://pelasne-fleet.eastus.cloudapp.azure.com:83",
        games: 0,
        status: "unverified",
        lastQuery: 0
    }, {
        url: "http://game04:8001",
        ws: "ws://pelasne-fleet.eastus.cloudapp.azure.com:84",
        games: 0,
        status: "unverified",
        lastQuery: 0
    }, {
        url: "http://game05:8001",
        ws: "ws://pelasne-fleet.eastus.cloudapp.azure.com:85",
        games: 0,
        status: "unverified",
        lastQuery: 0
    }, {
        url: "http://game06:8001",
        ws: "ws://pelasne-fleet.eastus.cloudapp.azure.com:86",
        games: 0,
        status: "unverified",
        lastQuery: 0
    }, {
        url: "http://game07:8001",
        ws: "ws://pelasne-fleet.eastus.cloudapp.azure.com:87",
        games: 0,
        status: "unverified",
        lastQuery: 0
    }, {
        url: "http://game08:8001",
        ws: "ws://pelasne-fleet.eastus.cloudapp.azure.com:88",
        games: 0,
        status: "unverified",
        lastQuery: 0
    }, {
        url: "http://game09:8001",
        ws: "ws://pelasne-fleet.eastus.cloudapp.azure.com:89",
        games: 0,
        status: "unverified",
        lastQuery: 0
    }
];

// refresh the server list every few seconds
setInterval(function() {

    // sort (oldest refresh is first index)
    servers.sort((a, b) => {
        return a.lastQuery - b.lastQuery;
    });

    // contact a server to find out if it up and verify the number of games it has
    const server = servers[0];
    server.lastQuery = Date.now();
    request({
        method: "GET",
        url: server.url + "/status",
        json: true
    }, function(err, response, body) {
        if (!err && response.statusCode == 200) {
            server.games = body.games;
            server.status = "verified";
        } else {
            server.status = "unavailable";
            console.log("server (" + server.url + ") was marked unavailable.");
        }
    });

}, 5000);

// show all lobbies that contain players
app.get("/lobbies", function(req, res) {
    const list = [];
    lobbies.forEach((lobby) => {
        if (lobby.players.length > 0) {
            list.push(lobby);
        }
    });
    res.send(list);
});

// show all servers
app.get("/servers", function(req, res) {
    res.send(servers);
});

// blocks until it can respond with a match 
app.get("/match", function(req, res) {

    // make sure all requirements are met
    const playerId = req.query.playerId;
    if (playerId == null) {
        res.status(400).send("missing_arguments");
    } else if (servers.length < 1) {
        res.status(500).send("no_servers");
    } else {

        // determine the proper lobby type
        let type = req.query.type;
        const opponentId = req.query.opponentId;
        if (type) {
            // if a type was specified, use it
        } else if (opponentId) {
            // if an opponent was specified, put into that lobby
            type = "player:" + opponentId;
        } else {
            // if nothing was specified, assume the client is waiting to be matched
            type = "player:" + playerId;
        }

        // find the right lobby, or create one if there isn't already one for this game type
        let lobby = lobbies.find((entry) => { return entry.type == type });
        if (lobby == null) {
            lobby = {
                type: type,
                players: []
            }
            lobbies.push(lobby);
        }

        // see if any other players are in the lobby but aren't matched yet
        const waiting = lobby.players.find((entry) => { return entry.playerId != playerId && entry.opponentId == null });
        if (waiting) {

            // find an available server with the fewest games
            const availableServers = servers
                .filter((server) => { return server.status != "unavailable" })
                .sort((a, b) => { return a.games - b.games; });
            if (availableServers.length > 0) {

                // increase the game count of the server
                const server = availableServers[0];
                server.games++;
                
                // notify your opponent
                waiting.server = server.ws;
                waiting.opponentId = playerId;
                waiting.gameId = uuid.v4();
                if (waiting.onMatch) waiting.onMatch();

                // return immediately since a match was found
                res.send({
                    playerId: playerId,
                    opponentId: waiting.playerId,
                    gameId: waiting.gameId,
                    server: waiting.server
                });

            } else {

                // return immediately that no servers were available
                res.status(500).send("no_servers");

            }

        } else {

            // see if the entry already exists; create it if it doesn't
            let self = lobby.players.find((entry) => { return entry.playerId == playerId });
            if (self == null) {
                self = {
                    playerId: playerId,
                    opponentId: null,
                    gameId: null,
                    server: null
                }
                lobby.players.push(self);
            }
            self.lastQuery = Date.now();

            // create a function that can close out this request
            const close = function() {

                // remove from the lobby
                const index = lobby.players.indexOf(self);
                lobby.players.splice(index, 1);

                // notify
                res.send({
                    playerId: self.playerId,
                    opponentId: self.opponentId,
                    gameId: self.gameId,
                    server: self.server
                });

            }

            // see if it has already been matched
            if (self.opponentId) {

                // close immediately
                close();

            } else {

                // add the onMatch event so another connection can close this one
                self.onMatch = close;

                // allow the connection to stay open for 30 seconds
                setTimeout(function() {
                    self.onMatch = null;
                    if (self.gameId == null) res.send({ status: "unmatched" });
                }, 30000);

            }

        }

    }

});

// clean house once a minute
setInterval(function() {

    // prune any players that are in a lobby but haven't checked in within the past 60 seconds
    const timestamp = Date.now();
    lobbies.forEach((lobby) => {
        lobby.players = lobby.players.filter((player) => {
            return (timestamp - player.lastQuery < 60000);
        });
    });

    // prune any lobbies that have no players
    lobbies = lobbies.filter((lobby) => {
        return (lobby.players.length > 0);
    });

}, 60000);

// start listening
app.listen(8000, function() {
    console.log("listening on port 8000...");
});
