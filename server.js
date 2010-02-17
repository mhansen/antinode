/**
 * Simple webserver with logging. By default, serves whatever files are
 * reachable from the directory where node is running.
 */
var VERSION = "0.2";
var fs = require('fs'),
    pathlib = require('path'),
    uri = require('url'),
    events = require('events'),
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
};

try {
    log.debug("Reading/parsing settings.json");
    var custom_settings = JSON.parse(fs.readFileSync('./settings.json'));
    process.mixin(settings, custom_settings);
} catch(e) {
    log.warn("Using default settings: cannot read settings.json.",e);
}

log.info( "Starting server on port", settings.port);
require("http").createServer(function(req,resp) {
    log.info("Request from ",req.connection.remoteAddress,"for",req.url);
    log.info(JSON.stringify(req.headers));
    resp.die = setTimeout(function() {
        finish(resp); 
    }, settings.timeout_milliseconds);

    find_local_file_path(req).addListener('success', function(path) {
        try_stream(path, resp);
    });
}).listen(settings.port);


function find_local_file_path(req) {
    var vhost = settings.hosts[req.headers.host] || settings.default_host;
    log.debug("selected vhost",vhost.root);
    //disallow parent directory access
    var clean_path = uri.parse(req.url || '/').pathname.replace(/\.\.\//g);
    var path = pathlib.join(vhost.root, clean_path);

    var emitter = new events.EventEmitter();
    fs.stat(path).addCallback(function (stat) {
        if (stat.isDirectory()) {
            path = pathlib.join(path, "index.html");
        }
        emitter.emit('success', path);
    }).addErrback(function () {
        emitter.emit('success', path);
    });
    return emitter;
}

function try_stream(path, resp) {
    function send_headers(httpstatus, length, content_type, modified_time) {
        var headers = {
            "Content-Type" : content_type || "application/octet-stream",
            "Server" : "Antinode/"+VERSION+" Node.js/"+process.version,
            "Date" : (new Date()).toUTCString(),
            "Content-Length" : length
        };
        if (modified_time) { 
            headers["Last-Modified"] = modified_time.toUTCString(); 
        }
        resp.sendHeader(200, headers);
    }

    fs.stat(path).addCallback(function (stats) {
        if (stats.isFile()) {
            stream_file(path, stats);
        } else {
            file_not_found();
        }
    }).addErrback(file_not_found);
    function stream_file(file, stats) {
        fs.open(file,'r', 0660).addCallback(function(fd) {
            var position = 0;
            log.debug("opened",path,"on fd",fd);
            function read() {
              fs.read(fd,settings.max_bytes_per_read,position, "binary")
                .addCallback(function(data,bytes_read) {
                    log.debug("read",bytes_read,"bytes of",file);
                    if(bytes_read > 0) {
                        resp.write(data, "binary");
                        position += bytes_read;
                        read(); // read more
                    } else {
                        finish(resp);
                        close(fd);
                    }
                }).addErrback(function() {
                    log.error("Error reading from",file,"position:",position,
                        ">",arguments);
                    resp.write("Error reading from " + file);
                    finish(resp);
                    close(fd);
                });
            }
            if(fd) {
                send_headers(200, stats.size, mime.mime_type(file), stats.mtime);
                read();
            } else {
                server_error(file+" couldn't be opened (invalid fd)");
                close(fd);
            }
        }).addErrback(file_not_found);
    }

    function file_not_found() {
        log.debug("404 opening",path,">",arguments);
        var body = "404: " + path + " not found.";
        send_headers(404,body.length,"text/plain");
        resp.write(body);
        finish(resp);
    }

    function server_error(message) {
        log.error("error opening ",path,":",message);
        send_headers(500, message.length, "text/plain");
        resp.write(message);
        finish(resp);
    }
}

function finish(resp) {	
    clearTimeout(resp.die);
    resp.finish();
    log.debug("finished response");
}
function close(fd) {
    fs.close(fd);
    log.debug("closed fd",fd);
}
