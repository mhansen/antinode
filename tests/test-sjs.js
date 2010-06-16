require('./common');

var cases = [ { "file": "hello.sjs", "expectedBody": "hello world" } ];

cases.forEach(function (testcase) {
    exports[testcase.file] = function(test) {
        antinode.start(settings, function() {
            test_http(test,
                {
                    'method':'GET',
                    'pathname': '/'+testcase.file
                },
                {
                    'statusCode':200, 
                    'body':testcase.expectedBody,
                },
                function() {
                    antinode.stop();
                    test.done();
                }
            );
        });
    };
});
