require('./common');

var files = ["smalltext", "dictionary", "cat.jpg"];
var fileTexts = _.map(files, function (file) {
    var filename = path.join(settings.default_host.root, file);
    return fs.readFileSync(filename, 'binary');
});

antinode.start(settings, function() {
    var finishedFiles = 0;
    for (var i=0; i<files.length; i++) {
        test_get('/'+files[i], 200, fileTexts[i], function() {
            finishedFiles++;
            if (finishedFiles >= files.length) {
                antinode.stop();
                puts("Passed: 200 Test");
            }
        });
    }
});
