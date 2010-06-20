require('./common');

var files = [
    {"name": "smalltext", "statusCode":200},
    {"name": "dictionary", "statusCode":200},
    {"name": "cat.jpg", "statusCode":200},
    {"name": "iwill404", "statusCode":404}
];

files.forEach(function (file) {
    exports[file.name] = function(test) {
        antinode.start(settings, function() {
            test_http(test,
                      {'method':'HEAD','pathname':'/'+file.name},
                      {'statusCode':file.statusCode,'body':''},
            function() {
                antinode.stop();
                test.done();
            });
        });
    };
});
