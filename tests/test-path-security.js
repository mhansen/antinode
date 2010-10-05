require('./common');

exports["don't allow access to files outside of basedir"] = function (test) {
    antinode.start(settings, function() {
        test_http(test, {
                      'method':'GET',
                      'pathname':'/....//scripthost.js',
                      'headers': { 'host' : 'default-host' }
                    }, {
                      'statusCode': 404,
                      'body':''
                    },
          function () {
              antinode.stop();
              test.done();
        });
    });
};
