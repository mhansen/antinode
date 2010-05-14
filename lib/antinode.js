var fs = require('fs'),
    pathlib = require('path'),
    uri = require('url'),
    events = require('events'),
    mime = require('./content-type'),
    log = require('./log'),
    VERSION = "2.0";

var settings = exports.default_settings = {
    "max_bytes_per_read": 1024 * 1024 * 5, // 5MB
    "timeout_milliseconds": 1000 * 30, //30 sec
    "hosts" : {},
    "port" : 8080,
    "default_host" : {
        "root" : "./"
    },
    "log_level" : log.levels.DEBUG
};

exports.start = function(custom_settings) {
    settings = custom_settings || exports.default_settings;
    log.level = settings.log_level;
    log.info( "Starting server on port", settings.port);
    require("http").createServer(function(req,resp) {
        log.info("Request from ",req.connection.remoteAddress,"for",req.url);
        log.info(JSON.stringify(req.headers));
        resp.die = setTimeout(function() {
            finish(resp); 
        }, settings.timeout_milliseconds);

        find_local_file_path(req).addListener('success', function(path) {
            try_stream(path, req, resp);
        });
    }).listen(settings.port);
}

function find_local_file_path(req) {
    var url = uri.parse(req.url);
    //if the parsed url doesn't have a pathname, default to '/'
    var pathname = (url.pathname || '/');
    //disallow parent directory access, convert spaces
    var clean_pathname = pathname.replace(/\.\.\//g,'').replace(/\%20/g,' ');

    var vhost = select_vhost(req.headers.host);

    log.debug("requested host:", req.headers.host, "selected vhost:", vhost.root);
    var path = pathlib.join(vhost.root, clean_pathname);
    log.debug("Path = ", path);

    var emitter = new events.EventEmitter();
    fs.stat(path, function (err, stat) {
        if (err) {
            emitter.emit('success', path); //continue with program, will 404 later
            return;
        }
        if (stat.isDirectory()) {
            path = pathlib.join(path, "index.html");
        }
        emitter.emit('success', path);
    });
    return emitter;
}

function select_vhost(host_header) {
    if (host_header) {
        host_header = host_header.split(':')[0]; //remove the port
        return settings.hosts[host_header] || settings.default_host;
    } else {
        return settings.default_host;
    }
}


function try_stream(path, req, resp) {
    function send_headers(httpstatus, length, content_type, modified_time) {
        var headers = {
            "Server" : "Antinode/" + VERSION + " Node.js/" + process.version,
            "Date" : (new Date()).toUTCString()
        };
        if (length) {
            headers["Content-Length"] = length;
        }
        if (content_type) {
            headers["Content-Type"] = content_type || "application/octet-stream";
        }
        if (modified_time) { 
            headers["Last-Modified"] = modified_time.toUTCString(); 
        }
        resp.writeHead(httpstatus, headers);
    }

    fs.stat(path, function (err, stats) {
        if (err) {
            log.error("fs.stat(",path,") failed: ", err);
            return file_not_found();
        }
        if (!stats.isFile()) {
            file_not_found();
        } else {
            //
            // RFC 2616, section 14.25
            //
            // Note: When handling an If-Modified-Since header field, some
            // servers will use an exact date comparison function, rather than a
            // less-than function, for deciding whether to send a 304 (Not
            // Modified) response. To get best results when sending an If-
            // Modified-Since header field for cache validation, clients are
            // advised to use the exact date string received in a previous Last-
            // Modified header field whenever possible.
            //
            var if_modified_since = req.headers['if-modified-since'];
            if (if_modified_since && if_modified_since == stats.mtime.toUTCString()) {
                not_modified();
            } else {
                stream_file(path, stats);
            }
        }
    });

    function stream_file(file, stats) {
        fs.open(file,'r', 0660, function(err, fd) {
            if (err) {
                log.debug("fs.open(",file,") error: ",err.message);
                file_not_found();
                return;
            }
            log.debug("opened", path, "on fd", fd);

            send_headers(200, stats.size, mime.mime_type(file), stats.mtime);
            resp.flush();

            send_chunk(0, stats.size, function() { 
                finish(resp); 
                close(fd); 
            });

            // For large files, sendfile(2) may only send a small chunk of the
            // file (even when we request it send more) so we need
            function send_chunk(offset, bytes_to_write, callback) {
                log.debug('sending chunk of', file, offset, bytes_to_write);
                fs.sendfile(req.connection.fd, fd, offset, bytes_to_write, 
                  function (err, bytes_written) {
                    if (err) {
                        bytes_written = 0;
                        // If we get EAGAIN, the write would have blocked. 
                        // Just try again later
                        if (err.errno != process.EAGAIN) {
                            log.error("sendfile(", file,") failed: ",err.message);
                            callback();
                            return;
                        }
                    }
                    bytes_to_write -= bytes_written;
                    offset += bytes_written;
                    if (bytes_to_write < 1) callback();
                    else send_chunk(offset, bytes_to_write, callback);
                });
            }
        });
    }

    function not_modified() {
        // no need to send content length or type
        log.debug("304 for resource ", path);
        send_headers(304);
        finish(resp);
    }

    function file_not_found() {
        log.debug("404 opening",path,">",arguments);
        var body = "404: " + req.url + " not found.\n";
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
    resp.end();
    log.debug("finished response");
}
function close(fd) {
    fs.close(fd);
    log.debug("closed fd",fd);
}
