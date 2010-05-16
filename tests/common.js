exports = module.exports = global;

exports.path = require("path");
exports.testDir = __dirname;
exports.fixturesDir = path.join(__dirname, "fixtures");
exports.libDir = path.join(testDir, "../lib");

exports.antinode = require(path.join(libDir, "antinode"));
exports.http = require('http');
exports.fs = require('fs');
exports.assert = require('assert');

exports.settings = {
    "port": 12346, 
    "default_host" : {
        "root": path.join(fixturesDir,"default-host")
    },
    "log_level": 4 //silent
}

var sys = require("sys");
for (var i in sys) exports[i] = sys[i];
