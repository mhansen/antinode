// test rewriting of urls like '/' to '/index.html'
require('./common');
var filename = path.join(settings.default_host.root, "folder/index.html");
var indexText = fs.readFileSync(filename, 'binary');

antinode.start(settings, function() {
    test_get('/folder', 200, indexText, function() { 
        antinode.stop(); 
        puts("PASSED: Index Test");
    });
});

