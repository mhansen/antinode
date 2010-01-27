/**
 * Simple webserver with logging. Serves whatever files are reachable from
 * the directory where node is running.
 */
var posix = require('posix'),
	sys = require('sys');

var DEBUG = 0, INFO = 1, WARN = 2, ERROR = 3;
var LOG_LEVEL = DEBUG;

// we never create a file, but posix.open requires us 
// to specify permissions for creating a file anyway
var FILE_PERMISSIONS = 0660; 

var MAX_READ = 1024 * 1024 * 5; // 5MB - max bytes to request at a time
var TIMEOUT = 1000 * 30; // 30 seconds
var PORT = 8080;

var baseDir = "./";

require("http").createServer(function(req,resp) {
	// don't allow ../ in paths
    var uri = require('url').parse(req.url);
	var file = uri.pathname.replace(/\.\.\//g,'').substring(1) || 'index.html';

    var contentType = require("./mime").mime_type(file, "text/plain");

	log(DEBUG,"Got request for",file,contentType);
	streamFile(baseDir + file,resp,contentType);
}).listen(PORT);

log(INFO,"Server running on port",PORT);

function streamFile(file,resp,contentType) {
    var die = setTimeout(finish,TIMEOUT);
    posix.open(file,process.O_RDONLY, FILE_PERMISSIONS).addCallback(function(fd) {
	    var position = 0;
	    log(DEBUG,"opened",fd);
	    if(fd) {
			log(DEBUG,"sendHeader 200");
			resp.sendHeader(200,{"Content-Type":contentType || "text/plain"});
			read();
			function read() {
			    posix.read(fd,MAX_READ,position).addCallback(function(data,bytes_read) {
				    log(DEBUG,"read",bytes_read,"bytes of",file);
				    if(bytes_read > 0) {
						resp.sendBody(data);
						position += bytes_read;
						read(); // read more
				    } else {				
						finish(fd);
				    }
			    }).addErrback(function() {
					log(ERROR,"Error reading from",file,"position:",position,
						">",arguments);
					resp.sendBody("*** Error reading from "+file+
						". Check the console for details. ***");
					finish(fd);
				});
			}
	    } else {
			log(WARN,"Invalid fd for file:",file);
			resp.sendHeader(500,{"Content-Type":"text/plain"});			
			resp.sendBody(file);
			resp.sendBody(" couldn't be opened.");
			finish(fd);
	    }
    }).addErrback(function() {
	    log(DEBUG,"404 opening",file,">",arguments);
		resp.sendHeader(404,{"Content-Type":"text/plain"});
		resp.sendBody("*** Error opening "+file+
			". Check the console for details. ***");
		finish();
    });
    function finish(fd) {	
		resp.finish();
		log(DEBUG,"finished",fd);
		clearTimeout(die);			
		if(fd) {
		    posix.close(fd);
		}
    }
}

/* Logging/Utility Functions */
function log(level) {
    if(level >= LOG_LEVEL) sys.puts(join(slice(arguments,1)));
}
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
