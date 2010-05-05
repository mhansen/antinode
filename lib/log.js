var sys = require('sys');
require('./underscore/underscore');

function log(level, args) {
    if (level >= exports.level) { 
        sys.print((new Date()).toUTCString() + ": ");
        sys.puts(_(args).toArray().join(' '));
    }
}

var levels = exports.levels = {
    "DEBUG" : 0, 
    "INFO" : 1,
    "WARN" : 2,
    "ERROR" : 3
}

exports.level = levels.WARN;

exports.debug = function() {
    log(levels.DEBUG, arguments);
}
exports.warn = function() {
    log(levels.WARN, arguments);
}
exports.info = function() {
    log(levels.INFO, arguments);
}
exports.error = function() {
    log(levels.ERROR, arguments);
}
