var path = require("path");
exports = module.exports = global;

exports.testDir = __dirname;
exports.fixturesDir = path.join(__dirname, "fixtures");
exports.libDir = path.join(testDir, "../lib");
exports.PORT = 12346;
exports.antinode = require(path.join(libDir, "antinode"));
exports.http = require('http');

var sys = require("sys");
for (var i in sys) exports[i] = sys[i];
exports.assert = require('assert');
