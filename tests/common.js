exports = module.exports = global;
var sys = require("sys");
for (var i in sys) exports[i] = sys[i];

exports.path = require("path");
exports.testDir = __dirname;
exports.fixturesDir = path.join(__dirname, "fixtures");
exports.libDir = path.join(testDir, "../lib");

exports.antinode = require(path.join(libDir, "antinode"));
exports.http = require('http');
exports.fs = require('fs');

exports.settings = {
    "port": 12346, 
    "hosts" : {
        "examplevirtualhost.com" : {
            "root" : path.join(fixturesDir,"examplevirtualhost.com")
        },
        "scripthost.com" : {
            "handler" : path.join(fixturesDir,"scripthost.js")
        }
    },
    "default_host" : {
        "root": path.join(fixturesDir,"default-host")
    },
	"index_files" : [ "index.html" ],
    /* turn this up to 'log_levels.DEBUG' when debugging failing tests */
    "log_level": antinode.log_levels.ERROR 
};
settings.request_preprocessor = require('./fixtures/redirector').preprocessor;


/* Testing helper functions */

/** Fires an HTTP request, and test that the response is what we expect
 *
 * test: The nodeunit test object
 *
 * req.method:  HTTP request method
 * req.headers: HTTP request headers
 * req.pathname: HTTP Request resource
 * 
 * expected_res.statusCode: The expected response code
 * expected_res.body: The expected HTTP response body
 * expected_res.headers: The expected HTTP response headers (only test the ones specified)
 * Leave any of these values undefined, and they won't be tested
 */
exports.test_http = function(test, req, expected_res, callback) {
    var client = http.createClient(settings.port, 'localhost');
    var r = client.request(req.method, req.pathname, req.headers);
    r.addListener('response',function(response){
        if (expected_res.statusCode) {
            test.equals(response.statusCode, expected_res.statusCode);
        }
        if (expected_res.headers) {
            for (var name in expected_res.headers) {
                if (expected_res.headers.hasOwnProperty(name)) {
                    var expected_header = expected_res.headers[name];
                    var actual_header = response.headers[name];
                    test.equals(expected_header, actual_header);
                }
            }
        }
        if (expected_res.body) {
            response.setEncoding('binary');
            var offset = 0;
            response.addListener('data', function (chunk) {
                var expected_chunk = expected_res.body.substring(offset, offset+chunk.length);
                test.equals(chunk.length, expected_chunk.length);
                test.equals(chunk, expected_chunk);
                offset += chunk.length;
            });
            response.addListener('end', callback);
        }
        else {
            return callback();
        }
    });
    r.end();
};
