
// includes
const express = require("express");

// startup express
const app = express();

// track the games
const games = {};

// respond to calls for status
app.get("/status", function(req, res) {
    res.send({
        games: Object.keys(games).length
    });
});

// post a message to a partner
app.post("/msg", function(req, res) {

    // get the parameters
    const gameId = req.header("gameId") || req.query.gameId;
    const fromId = req.header("fromId") || req.query.fromId;
    const toId = req.header("toId") || req.query.toId;
    const ref = gameId + "." + toId;

    // create the dispatch function
    const dispatch = function() {
        if (games[ref]) {
            games[ref].send(req.body);
            delete games[ref];
            return true;
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
                res.status(200).end();
            } else {
                res.status(408).end();
            }
        }, 10000);
    }

});

// listen for a message from a partner
app.get("/msg", function(req, res) {

    // get the parameters
    const gameId = req.header("gameId") || req.query.gameId;
    const fromId = req.header("fromId") || req.query.fromId;
    const toId = req.header("toId") || req.query.toId;
    const ref = gameId + "." + fromId;

    // create a reference to the response object
    games[ref] = res;

    // allow the connection to stay open for 30 seconds
    setTimeout(function() {
        if (games[ref]) {
            delete games[ref];
            res.status(408).end();
        }
    }, 30000);

});

// start listening
app.listen(8000, function() {
    console.log("listening on port 8000...");
});
