
// includes
const express = require("express");
const bodyParser = require("body-parser");

// globals
const cleanup_interval = 1 * 60 * 1000;  // 1 min
const player_timeout = 2 * 60 * 1000;    // 2 min
const game_timeout = 8 * 60 * 60 * 1000; // 8 hours
const tombstone_timeout = 5 * 60 * 1000; // 5 min
const http_ok = 200;
const http_error = 500;
const http_gone = 410;

// startup express
const app = express();
app.use(bodyParser.raw({
    type: function() { return true; }
}));

// track the games
const games = {};

// respond to calls for status
app.get("/status", function(req, res) {
    res.send({
        games: Object.keys(games).length
    });
});

function postOrPut(req, res) {

    // get the parameters
    const gameId = req.header("gameId") || req.query.gameId;
    const toId = req.header("toId") || req.query.toId;

    // SHOULD ADD SOME VALIDATION OF PARAMS

    // create the dispatch function
    const dispatch = function() {
        const game = games[gameId];
        if (game) {
            const player = game.players[toId];
            if (player && player.res) {
                clearTimeout(player.timeout);
                player.res.send(req.body);
                delete player.res;
                delete player.timeout;
                return true;
            } else {
                return false;
            }
        } else {
            return false;
        }
    }

    // if the client is listening, pass it the message; otherwise try again soon
    if (dispatch()) {
        res.status(200).end();
    } else {
        setTimeout(function() {
            if (dispatch()) {
                res.status(http_ok).end();
            } else {
                res.status(http_error).end();
            }
        }, 2000);
    }

}

// post a message to a partner
app.put("/msg", function(req, res) {
    postOrPut(req, res);
});
app.post("/msg", function(req, res) {
    postOrPut(req, res);
});

// listen for a message from a partner
app.get("/msg", function(req, res) {

    // get the parameters
    const gameId = req.header("gameId") || req.query.gameId;
    const fromId = req.header("fromId") || req.query.fromId;

    // find or create the game
    let game = games[gameId];
    if (!game) {
        game = games[gameId] = {
            created: Date.now(),
            players: { },
            status: "active",
            cleanup: setInterval(function() {
                const now = Date.now();
                switch (game.status) {
                    case "active":
                        if (now - game.created > game_timeout) {
                            game.status = "expired";
                        } else {
                            for (let id in game.players) {
                                if (now - game.players[id].last > player_timeout) {
                                    console.log("disconnected " + id + ", now: " + now + " - " + game.players[id].last + " = " + (now - game.players[id].last) + ".");
                                    game.status = "disconnected";
                                }
                            }
                        }
                        break;
                    case "expired":
                    case "disconnected":
                        clearInterval(game.cleanup);
                        setTimeout(function() {
                            console.log("tombstoned " + gameId);
                            delete games[gameId];
                        }, tombstone_timeout);
                        break;
                }
            }, cleanup_interval)
        };
    }

    // handle as long-poll
    if (game.status === "active") {

        // allow the connection to stay open for 30 seconds
        const timeout = setTimeout(function() {
            if (game && game.players[fromId]) {
                delete game.players[fromId].res;
                delete game.players[fromId].timeout;
                res.status(http_ok).end();
            } else {
                res.status(http_gone).end();
            }
        }, 30000);

        // create a reference to the response object
        game.players[fromId] = {
            res: res,
            timeout: timeout,
            last: Date.now()
        };

    } else {
        res.status(http_gone).end();
    }

});

// start listening
app.listen(8000, function() {
    console.log("listening on port 8000...");
});
