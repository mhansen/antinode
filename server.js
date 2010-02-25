/**
 * Simple webserver with logging. By default, serves whatever files are
 * reachable from the directory where node is running.
 */
var fs = require('fs'),
    antinode = require('./lib/antinode');

var settings;
try {
    var custom_settings = JSON.parse(fs.readFileSync('./settings.json'));
    settings = process.mixin(antinode.default_settings, custom_settings);
} catch(e) {
    settings = antinode.default_settings;
}
antinode.start(settings);
