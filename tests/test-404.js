require('./common');

var file = "/doesntexist.html";
exports[file] = function (test) {
    antinode.start(settings, function() {
        test_get(test,file, 404, null, function() {
            antinode.stop();
            test.done();
        });
    });
};
