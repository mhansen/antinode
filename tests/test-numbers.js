require('./common');
var path = require("path");

var file = "numbers";

var default_host_path = path.join(fixturesDir,"default-host");
var fullname = path.join(default_host_path, file);

var fileText = require('fs').readFileSync(fullname);

var settings = {
    "port": PORT, 
    "default_host" : {
        "root": path.join(fixturesDir,"default-host")
    },
    "log_level": 4 //silent
}
antinode.start(settings, function() {
    var client = http.createClient(PORT, 'localhost');
    var request = client.request('GET', '/'+file);
    request.addListener('response', function (response) {
        assert.equal(response.statusCode, 200);
        response.setEncoding('utf8');
        response.addListener('data', function (chunk) {
            assert.equal(chunk, fileText);
            puts("OK");
            antinode.stop();
        });
    });
    request.end();
});
