require('./common');

var file = "/doesntexist.html";
exports[file] = function (test) {
    antinode.start(settings, function() {
        test_http(test, 
             {   
                 'method':'GET', 
                 'pathname':file
             },
             { 'statusCode':404 },
             function() {
                 antinode.stop();
                 test.done();
             }
        );
    });
};
