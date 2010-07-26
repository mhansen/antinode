require('./common');

var files = ["smalltext", "dictionary", "cat.jpg", "oranga_thumb.jpg"];

files.forEach(function (file) {
    var disc_filename = path.join(settings.default_host.root, file);
    var fileText = fs.readFileSync(disc_filename, 'binary');

    exports[file] = function(test) {
        antinode.start(settings, function() {
            test_http(test,
                      {'method':'GET','pathname':'/'+file},
                      {'statusCode':200,'body':fileText},
            function() {
                antinode.stop();
                test.done();
            });
        });
    };
});
