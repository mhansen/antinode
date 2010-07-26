require ('./common');

exports['redirect 301 to new domain'] = function (test) {
    antinode.start(settings, function () {
        test_http(test, {
            'method':'HEAD',
            'pathname':'/lol',
            'headers':{ 'host': '301.domain.com' }
        }, {
            'statusCode': 301, 
            'headers' : {
                'location': 'http://default-host/lol'
            },
            'body': ''
        },
        function () {
            antinode.stop();
            test.done();
        });
    })
};
