require('./common');

antinode.start(settings, function() {
    test_get('/doesntexist.html', 404, null, function() {
        puts("Got 404 OK");
        antinode.stop();
    });
});
