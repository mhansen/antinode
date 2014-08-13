var sys = require('sys');

function log(level, args) {
    if (level >= exports.level) { 
        sys.print("\033[1m" +(new Date()).toUTCString() + ": \033[0m");

        switch (level) {
            case 1:
                sys.print("\033[32m"); //green
                break;
            case 2:
                sys.print("\033[33m"); //yellow
                break;
            case 3:
                sys.print("\033[31m"); //red
                break;
        }

        // Convert arguments object to an array so we can use
        // Array's join method on it
        sys.print(Array.prototype.slice.call(args).join(' '));
        sys.puts("\033[0m");
    }
}

var levels = exports.levels = {
    "DEBUG" : 0, 
    "INFO" : 1,
    "WARN" : 2,
    "ERROR" : 3
};

exports.level = levels.WARN;

exports.debug = function() {
    log(levels.DEBUG, arguments);
};
exports.warn = function() {
    log(levels.WARN, arguments);
};
exports.info = function() {
    log(levels.INFO, arguments);
};
exports.error = function() {
    log(levels.ERROR, arguments);
};

// vim:set expandtab shiftwidth=4 tabstop=4:
