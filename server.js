/**
 * Simple webserver with logging. By default, serves whatever files are
 * reachable from the directory where node is running.
 */
var VERSION = "0.1"
var posix = require('posix'),
	sys = require('sys');

var DEBUG = 0, INFO = 1, WARN = 2, ERROR = 3;
var default_settings = {
    "log_level": DEBUG,
    "max_bytes_per_read": 1024 * 1024 * 5, // 5MB
    "timeout_milliseconds": 1000 * 30, //30 sec
    "port" : 8080,
    "baseDir" : "./"
}

function loadSettings() {
    try {
        var json = posix.cat("./settings.json").wait();
        var file_settings = JSON.parse(json);
        return process.mixin(default_settings, file_settings);
    } catch (e) { 
        log(WARN, "Error loading settings.json (",e,
                  ") Using default settings instead.");
        return default_settings;
    } 
}
var settings = loadSettings();

log(INFO,"Creating server on port",settings.port);
log(INFO,"serving directory:",settings.baseDir);

require("http").createServer(function(req,resp) {
    log(INFO, "Got request for",req.url); 
    var pathname = require('url').parse(req.url).pathname || '/';
    function sanitize(path) {
        return path.replace(/\.\.\//g,''); //don't allow access to parent dirs
    }
    stream(settings.baseDir + sanitize(pathname), resp);
}).listen(settings.port);

function stream(path, resp) {
    var die = setTimeout(finish,settings.timeout_milliseconds);
    function sendHeaders(httpstatus, content_length, content_type) {
        resp.sendHeader(httpstatus, 
            {   
                "Content-Type" : content_type || 
                                 "application/octet-stream",
                "Server" : "Antinode/" + VERSION + 
                           " Node.js/" + process.version + 
                           " " + process.platform,
                "Date" : (new Date()).toUTCString(),
                "Content-Length" : content_length
            });
    }
    posix.stat(path).addCallback(function (stat) {
        if (stat.isDirectory()) {
            stream(path + "/index.html", resp); //try dir/index.html
        } else { 
            streamFile(path, stat.size);
        }
    }).addErrback(fileNotFound);

    function streamFile(file, filesize) {
        posix.open(file,process.O_RDONLY, 0660).addCallback(function(fd) {
            var position = 0;
            log(DEBUG,"opened",fd);
            if(fd) {
                sendHeaders(200, filesize, require('./content-type').mime_type(path));
                read();
                function read() {
                  posix.read(fd,settings.max_bytes_per_read,position, "binary")
                    .addCallback(function(data,bytes_read) {
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
                        resp.sendBody("Error reading from " + file);
                        finish(fd);
                    });
                }
            } else {
                log(WARN,"Invalid fd for file:",file);
                var body = file + " couldn't be opened.";
                sendHeaders(500, body.length, "text/plain");
                resp.sendBody(body);
                finish(fd);
            }
        }).addErrback(fileNotFound);
    }
    function fileNotFound() {
        log(DEBUG,"404 opening",path,">",arguments);
        var body = "404: " + path + " not found.";
        sendHeaders(404,body.length,"text/plain");
        resp.sendBody(body);
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
    sys.print((new Date()).toUTCString() + ": ");
    if(level >= settings.log_level) sys.puts(join(slice(arguments,1)));
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
