// test rewriting of urls like '/' to '/index.html'
require('./common');
var filename = path.join(settings.hosts['examplevirtualhost.com'].root, "folder/index.html");
var indexText = fs.readFileSync(filename, 'binary');

exports["'GET /folder' returns '302 Found: http://examplevirtualhost.com/folder/'"] = function(test) {
    antinode.start(settings, function() {
        test_http(test,
              {
                  'method':'GET',
                  'pathname':'/folder',
                  'headers': {
                      'host': 'examplevirtualhost.com'
                  }
              },
              {
                  'statusCode':302,
                  'body':'',
                  'headers': {
                      'location': 'http://examplevirtualhost.com/folder/'
                  }
              }, 
              function() { 
                  antinode.stop(); 
                  test.done();
              }
         );
    });
};
exports["'GET /folder/' returns 200, text of /folder/index.html"] = function(test) {
    antinode.start(settings, function() {
        test_http(test,
              {
                  'method':'GET',
                  'pathname':'/folder/',
                  'headers': {
                      'host': 'examplevirtualhost.com'
                  }
              },
              {
                  'statusCode':200,
                  'body':indexText
              },
              function() { 
                  antinode.stop(); 
                  test.done();
              }
         );
    });
};
