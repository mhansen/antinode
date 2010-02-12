/**
 * Simple webserver with logging. By default, serves whatever files are
 * reachable from the directory where node is running.
 */
var VERSION = "0.1"
var posix = require('posix'),
    pathlib = require('path'),
    uri = require('url')
    mime = require('./lib/content-type'),
    log = require('./lib/log');

log.level = log.levels.DEBUG;

var settings = {
    "max_bytes_per_read": 1024 * 1024 * 5, // 5MB
    "timeout_milliseconds": 1000 * 30, //30 sec
    "hosts" : [],
    "port" : 8080,
    "default_host" : {
        "root" : "./"
    } 
}

try {
    log.debug("Reading/parsing settings.json");
    var custom_settings = JSON.parse(posix.cat('./settings.json').wait());
    process.mixin(settings, custom_settings);
} catch(e) {
    log.warn("Using default settings: cannot read settings.json.",e);
}

log.info( "Starting server on port", settings.port);
require("http").createServer(function(req,resp) {
    log.info("Request:", JSON.stringify(req.headers));
    var vhost = get_vhost(req.headers["host"]);
    var path = get_file_path(vhost.root, req.url);
    log.debug( "Streaming", path);
    resp.die = setTimeout(finish, settings.timeout_milliseconds);
    stream(path, resp);

    function get_vhost(hostname) {
        return settings.hosts[hostname] || settings.default_host;
    }

    function get_file_path(webroot, url) {
        var path = uri.parse(url || '/').pathname;
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
            log.debug("opened",path,"on fd",fd);
            if(fd) {
                sendHeaders(200, filesize, mime.mime_type(path));
                read();
                function read() {
                  posix.read(fd,settings.max_bytes_per_read,position, "binary")
                    .addCallback(function(data,bytes_read) {
                        log.debug("read",bytes_read,"bytes of",file);
                        if(bytes_read > 0) {
                            resp.sendBody(data, "binary");
                            position += bytes_read;
                            read(); // read more
                        } else {				
                            finish(resp,fd);
                        }
                    }).addErrback(function() {
                        log.error("Error reading from",file,"position:",position,
                            ">",arguments);
                        resp.sendBody("Error reading from " + file);
                        finish(resp,fd);
                    });
                }
            } else {
                log.warn("Invalid fd for file:",file);
                var body = file + " couldn't be opened.";
                sendHeaders(500, body.length, "text/plain");
                resp.sendBody(body);
                finish(resp,fd);
            }
        }).addErrback(fileNotFound);
    }
    function fileNotFound() {
        log.debug("404 opening",path,">",arguments);
        var body = "404: " + path + " not found.";
        sendHeaders(404,body.length,"text/plain");
        resp.sendBody(body);
        finish(resp);
    }
}

function finish(resp, fd) {	
    clearTimeout(resp.die);
    resp.finish();
    log.debug("finished request for",resp.url);
    if(fd) {
        posix.close(fd);
        log.debug("closing fd",fd);
    }
}
