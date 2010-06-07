require('./common');

var cases = [ { "file": "hello.sjs", "expected": "hello world" } ];

cases.forEach(function (testcase) {
    exports[testcase.file] = function(test) {
        antinode.start(settings, function() {
            test_get(test,'/'+testcase.file, 200, testcase.expected, function() {
                antinode.stop();
                test.done();
            });
        });
    }
});
