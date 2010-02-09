var sys = require('sys');

function log(level, args) {
    if (level >= exports.level) { 
        sys.print((new Date()).toUTCString() + ": ");
        sys.puts(join(args));
    }
}

exports.levels = levels = { 
    "DEBUG" : 0, 
    "INFO" : 1,
    "WARN" : 2,
    "ERROR" : 3
}

exports.level = levels.warn;

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

/* Utility functions */
function slice(array,start) {
	return Array.prototype.slice.call(array,start);
}
function isString(s) {
	return typeof s === "string" || s instanceof String;
}
function flatten(array) {
	var result = [], i, len = array && array.length;
	if(len && !isString(array)) {
		for(i = 0; i < len; i++) {
			result = result.concat(flatten(array[i]));
		}
	} else if(len !== 0) {
		result.push(array);
	}
	return result;
}
function join() {
	return flatten(slice(arguments,0)).join(" ");
}
