require('./common');

var filename = "doesntexist.html";

antinode.start(settings, function() {
    var client = http.createClient(settings.port, 'localhost');
    var request = client.request('GET', '/'+filename);
    request.addListener('response', function (response) {
        assert.equal(response.statusCode, 404);
        puts("Got 404 OK");
        antinode.stop();
    });
    request.end();
});
