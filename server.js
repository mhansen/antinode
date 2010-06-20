#!/usr/bin/env node
/**
 * Simple webserver with logging. By default, serves whatever files are
 * reachable from the directory where node is running.
 */
var fs = require('fs'),
antinode = require('./lib/antinode'),
sys = require('sys');

fs.readFile(process.argv[2] || './settings.json', function(err, data) {
    var settings = {};
    if (err) {
        sys.puts('No settings.json found. Using default settings');
    } else {
        try {
            settings = JSON.parse(data.toString('utf8',0,data.length));
        } catch (e) {
            sys.puts('Error parsing settings.json: '+e);
            process.exit(1);
        }
    }
    antinode.start(settings);
});
