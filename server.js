/**
 * Simple webserver with logging. By default, serves whatever files are
 * reachable from the directory where node is running.
 */
var fs = require('fs'),
antinode = require('./lib/antinode');

fs.readFile('./settings.json', function(err, data) {
    var settings, custom_settings;
    if (err) {
        sys.puts('No settings.json found. Using default settings');
        antinode.start(antinode.default_settings);
        process.exit(0);
    }
    try {
        custom_settings = JSON.parse(data);
    } catch (e) {
        sys.puts('Error parsing settings.json');
        process.exit(1);
    }
    settings = mixin(antinode.default_settings, custom_settings);
    antinode.start(settings);
});

function mixin(base, extension) {
    var out = {};
    for (var key in base) out[key] = base[key];
    for (var key in extension) out[key] = extension[key];
    return out;
}
