require('./common');

var files = ["smalltext", "dictionary", "cat.jpg"];
var fileTexts = _.map(files, function (file) {
    var filename = path.join(settings.default_host.root, file);
    return fs.readFileSync(filename, 'binary');
});

antinode.start(settings, function() {
    for (var i=0; i<files.length; i++) {
        test_file_transfer(files[i], fileTexts[i]);
    }
});

var finishedFiles = 0;
function test_file_transfer(filename, content) {
    var client = http.createClient(settings.port, 'localhost');
    var request = client.request('GET', '/'+filename);
    request.addListener('response', function (response) {
        assert.equal(response.statusCode, 200);
        response.setEncoding('binary');
        var offset = 0;
        response.addListener('data', function (chunk) {
            var file_chunk = content.substring(offset, offset+chunk.length);
            assert.equal(chunk.length, file_chunk.length);
            assert.equal(chunk, file_chunk);
            offset += chunk.length;
        });
        response.addListener('end', function () {
            puts(filename+" OK.");
            finishedFiles++;
            if (finishedFiles >= files.length) antinode.stop();
        });
    });
    request.end();
}
