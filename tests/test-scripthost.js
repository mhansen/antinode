require('./common');

exports['Request to host with a script handler'] = function (test) {
    antinode.start(settings, function() {
        test_http(test, {
                      'method':'GET',
                      'pathname':'/',
                      'headers': { 'host' : 'scripthost.com' }
                    }, {
                      'statusCode':200,
                      'body':'hello world'
                    },
          function () {
              antinode.stop();
              test.done();
        });
    });
};
