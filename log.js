var sys = require('sys');

function log() {
    sys.print((new Date()).toUTCString() + ": ");
    sys.puts(join(arguments));
}

exports.levels = levels = { 
    "DEBUG" : 0, 
    "INFO" : 1,
    "WARN" : 2,
    "ERROR" : 3
}

exports.level = levels.warn;

exports.debug = function() {
    if (exports.level <= levels.DEBUG) {
        log(arguments);
    }
}
exports.warn = function() {
    if (exports.level <= levels.WARN) {
        log(arguments);
    }
}
exports.info = function() {
    if (exports.level <= levels.INFO) {
        log(arguments);
    }
}
exports.error = function() {
    if (exports.level <= levels.ERROR) {
        log(arguments);
    }
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
