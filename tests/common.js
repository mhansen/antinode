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
    "log_level": 1 //silent
}

var sys = require("sys");
for (var i in sys) exports[i] = sys[i];

exports.test_get = function(pathname, expected_code, expected_body, callback) {
    var client = http.createClient(settings.port, 'localhost');
    var request = client.request('GET', pathname);
    request.addListener('response', function (response) {
        assert.equal(response.statusCode, expected_code);
        response.setEncoding('binary');
        // if you don't care what's in the body, set expected_body to null
        if (expected_body === null) return callback();
        var offset = 0;
        response.addListener('data', function (chunk) {
            var expected_chunk = expected_body.substring(offset, offset+chunk.length);
            assert.equal(chunk.length, expected_chunk.length);
            assert.equal(chunk, expected_chunk);
            offset += chunk.length;
        });
        response.addListener('end', function () {
            puts(pathname+" OK.");
            callback();
        });
    });
    request.end();
}
