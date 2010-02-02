/**
 * Simple webserver with logging. By default, serves whatever files are
 * reachable from the directory where node is running.
 */
var posix = require('posix'),
	sys = require('sys'),
    config = require('./config').settings;

var DEBUG = 0, INFO = 1, WARN = 2, ERROR = 3;
var LOG_LEVEL = DEBUG;
var VERSION = "0.1"
var MAX_READ = 1024 * 1024 * 5; // 5MB - max bytes to request at a time
var TIMEOUT = 1000 * 30; // 30 seconds
var PORT = config.port || 8080; //listen port
var baseDir = config.baseDir || "./"; //web root

require("http").createServer(function(req,resp) {
    log(INFO, "Got request for",req.url); 
    var pathname = require('url').parse(req.url).pathname || '/';
    function sanitize(path) {
        return path.replace(/\.\.\//g,''); //don't allow access to parent dirs
    }
    stream(baseDir + sanitize(pathname), resp);
}).listen(PORT);

log(INFO,"Server running on port",PORT);
log(INFO,"serving directory:",baseDir);


function stream(path, resp) {
    var die = setTimeout(finish,TIMEOUT);
    function sendHeaders(httpstatus, contentType) {
        resp.sendHeader(httpstatus, {
                "Content-Type" : contentType || 
                                 require("./content-type").mime_type(path) ||
                                 "application/octet-stream",
                "Server" : "Antinode/" + VERSION + 
                           " Node.js/" + process.version + 
                           " " + process.platform,
                "Date" : (new Date()).toUTCString()
            });
    }
    posix.stat(path).addCallback(function (stat) {
        if (stat.isDirectory()) {
            path += "/index.html";
        }
        streamFile(path);
    }).addErrback(fileNotFound);

    function streamFile(file) {
        posix.open(file,process.O_RDONLY, 0660).addCallback(function(fd) {
            var position = 0;
            log(DEBUG,"opened",fd);
            if(fd) {
                sendHeaders(200);
                read();
                function read() {
                    posix.read(fd,MAX_READ,position, "binary").addCallback(function(data,bytes_read) {
                        log(DEBUG,"read",bytes_read,"bytes of",file);
                        if(bytes_read > 0) {
                            resp.sendBody(data, "binary");
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
                sendHeader(500, "text/plain");
                resp.sendBody(file);
                resp.sendBody(" couldn't be opened.");
                finish(fd);
            }
        }).addErrback(fileNotFound);
    }
    function fileNotFound() {
        log(DEBUG,"404 opening",path,">",arguments);
        sendHeaders(404,"text/plain");
        resp.sendBody("*** Error opening " + path +
                ". Check the console for details. ***");
        finish();
    }
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
