/**
 * Simple webserver with logging. By default, serves whatever files are
 * reachable from the directory where node is running.
 */
var VERSION = "0.1"
var posix = require('posix'),
	sys = require('sys'),
    pathlib = require('path');

var DEBUG = 0, INFO = 1, WARN = 2, ERROR = 3;
var settings = {
    "log_level": DEBUG,
    "max_bytes_per_read": 1024 * 1024 * 5, // 5MB
    "timeout_milliseconds": 1000 * 30, //30 sec
    "hosts" : [],
    "port" : 8080,
    "default_host" : {
        "root" : "./"
    } 
}

try {
    var custom_settings = JSON.parse(posix.cat('./settings.json').wait());
    process.mixin(settings, custom_settings);
} catch(e) {
    log(WARN, "Using default settings: cannot read settings.json.",e);
}

require("http").createServer(function(req,resp) {
    var vhost = get_vhost(req.headers["host"]);
    var path = get_file_path(vhost.root, req.url);
    log(INFO,"Request:", JSON.stringify(req.headers));
    log(DEBUG, "Streaming", path);
    resp.die = setTimeout(finish, settings.timeout_milliseconds);
    stream(path, resp);

    function get_vhost(hostname) {
        return settings.hosts[hostname] || settings.default_host;
    }

    function get_file_path(webroot, url) {
        var path = require('url').parse(url).pathname || '/';
        path = path.replace(/\.\.\//g,''); //don't allow access to parent dirs
        return pathlib.join(webroot, path);
    }
}).listen(settings.port);

function stream(path, resp) {
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
            stream(pathlib.join(path, "index.html"), resp); //try dir/index.html
        } else { 
            streamFile(path, stat.size);
        }
    }).addErrback(fileNotFound);

    function streamFile(file, filesize) {
        posix.open(file,process.O_RDONLY, 0660).addCallback(function(fd) {
            var position = 0;
            log(DEBUG,"opened",path,"on fd",fd);
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
                            finish(resp,fd);
                        }
                    }).addErrback(function() {
                        log(ERROR,"Error reading from",file,"position:",position,
                            ">",arguments);
                        resp.sendBody("Error reading from " + file);
                        finish(resp,fd);
                    });
                }
            } else {
                log(WARN,"Invalid fd for file:",file);
                var body = file + " couldn't be opened.";
                sendHeaders(500, body.length, "text/plain");
                resp.sendBody(body);
                finish(resp,fd);
            }
        }).addErrback(fileNotFound);
    }
    function fileNotFound() {
        log(DEBUG,"404 opening",path,">",arguments);
        var body = "404: " + path + " not found.";
        sendHeaders(404,body.length,"text/plain");
        resp.sendBody(body);
        finish(resp);
    }
}

function finish(resp, fd) {	
    clearTimeout(resp.die);
    resp.finish();
    log(DEBUG,"finished request for",resp.url);
    if(fd) {
        posix.close(fd);
        log(DEBUG,"closing fd",fd);
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
