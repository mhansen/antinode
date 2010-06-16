require('./common');

var host = 'examplevirtualhost.com';

exports['a request to the root of a vhost is routed to the right directory']=
function(test) {
    antinode.start(settings, function() {
        test_http(test, {'method':'GET','pathname':'/','headers':{'host':host}},
                        {'statusCode':200, 'body':'This is a virtual host root\n'}, 
          function() {
            antinode.stop();
            test.done();
        });
    });
};
