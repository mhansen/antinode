// test rewriting of urls like '/' to '/index.html'
require('./common');
var filename = path.join(settings.default_host.root, "folder/index.html");
var indexText = fs.readFileSync(filename, 'binary');

var pathnames = [ '/folder', '/folder/' ];

pathnames.forEach(function(pathname) {
    exports["GET "+pathname+" -> /folder/index.html"] = function(test) {
        antinode.start(settings, function() {
            test_http(test,
                  {
                      'method':'GET',
                      'pathname':pathname
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
});
