// test rewriting of urls like '/' to '/index.html'
require('./common');
var filename = path.join(settings.default_host.root, "folder/index.html");
var indexText = fs.readFileSync(filename, 'binary');

exports["GET /folder -> /folder/index.html"] = function(test) {
    antinode.start(settings, function() {
        test_get(test,'/folder', 200, indexText, function() { 
            antinode.stop(); 
            test.done();
        });
    });
}
exports["GET /folder/ -> /folder/index.html"] = function(test) {
    antinode.start(settings, function() {
        test_get(test,'/folder/', 200, indexText, function() { 
            antinode.stop(); 
            test.done();
        });
    });
}
