var http = require('http'),
    fs = require('fs'),
    pathlib = require('path'),
    uri = require('url'),
    mime = require('./content-type'),
    log = require('./log'),
    VERSION = "2.0",
    sys = require('sys'),
    Script = process.binding('evals').Script;

exports.default_settings = {
    "timeout_milliseconds": 1000 * 10,
    "hosts" : {},
    "port" : 8080,
    "default_host" : {
        "root" : process.cwd()
    },
    "log_level" : log.levels.DEBUG
};
exports.log_levels = log.levels;

var settings;

var server;
exports.start = function(custom_settings, callback) {
    settings = custom_settings || {};
    settings.__proto__ = exports.default_settings;

    log.level = settings.log_level;
    log.info( "Starting server on port", settings.port);
    server = http.createServer(function(req,resp) {
        log.debug("Request from", req.connection.remoteAddress, "for", req.url);
        log.debug(JSON.stringify(req.headers));

        var path = get_local_file_path(req);
        handle_request(path, req, resp);
    });
    server.listen(settings.port);
    server.addListener('listening', function() {
        if (callback) callback();
    });
    server.addListener('connection', function(connection) {
        connection.setTimeout(settings.timeout_milliseconds);
        connection.addListener('timeout', function() {
            log.debug("Connection from", connection.remoteAddress, "timed out.");
            connection.destroy();
        });
    });
};

exports.stop = function(callback) {
    if (server) {
        if (callback) server.addListener('close', callback);
        server.close();
    }
};

function get_local_file_path(req) {
    var url = uri.parse(req.url);
    //if the parsed url doesn't have a pathname, default to '/'
    var pathname = (url.pathname || '/');
    //disallow parent directory access, convert spaces
    var clean_pathname = pathname.replace(/\.\.\//g,'').replace(/\%20/g,' ');
    var vhost = select_vhost(req.headers.host);
    var path = pathlib.join(vhost.root, clean_pathname);
    return path;
}

function select_vhost(host_header) {
    if (host_header) {
        host_header = host_header.split(':')[0]; //remove the port
        return settings.hosts[host_header] || settings.default_host;
    } else {
        return settings.default_host;
    }
}

function handle_request(path, req, resp) {
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
        log.info(req.connection.remoteAddress, req.method, path, httpstatus, length);
    }

    fs.stat(path, function (err, stats) {
        if (err) {
            // ENOENT is normal on 'file not found'
            if (err.errno != process.ENOENT) { 
                // any other error is abnormal - log it
                log.error("fs.stat(",path,") failed: ", err);
            }
            return file_not_found();
        }
        if (stats.isDirectory()) {
            return handle_request(pathlib.join(path, "index.html"), req, resp);
        }
        if (!stats.isFile()) {
            return file_not_found();
        } else {
            if (path.match(/\.sjs$/)) {
                execute_sjs(path, req, resp);
            } else {
                var if_modified_since = req.headers['if-modified-since'];
                if (if_modified_since) {
                    var req_date = new Date(if_modified_since);
                    if (stats.mtime <= req_date && req_date <= Date.now()) {
                        return not_modified();
                    }
                    else stream_file(path, stats);
                } else {
                    return stream_file(path, stats);
                }
            }
        }
    });

    function stream_file(file, stats) {
        fs.open(file,'r', 0660, function(err, fd) {
            if (err) {
                log.debug("fs.open(",file,") error: ",err.message);
                return file_not_found();
            }
            log.debug("opened", path, "on fd", fd);
            var fd_open = true;
            req.connection.addListener('timeout', function() {
                if (fd_open) {
                    // close file descriptors so we don't run out of them.
                    // only close the file once. If our timeout handler runs after
                    // we've finished sending the file, the fd will already be closed
                    // and it could be reused by another request. It would interrupt
                    // the other request if we closed a fd twice.
                    close(fd);
                    fd_open = false;
                }
            });

            send_headers(200, stats.size, mime.mime_type(file), stats.mtime);
            resp._send('');	// HACK force a flush

            send_chunk(0, stats.size, function() {
                finish(resp); 
                close(fd); 
                fd_open = false;
            });

            // For large files, sendfile(2) may only send a small chunk of the
            // file (even when we request it send more) due to TCP's flow
            // control so we need to keep sending till the whole file's sent.
            function send_chunk(offset, bytes_to_write, callback) {
                log.debug('sending chunk of', file, offset, bytes_to_write);
                fs.sendfile(req.connection.fd, fd, offset, bytes_to_write, 
                  function (err, bytes_written) {
                    if (err) {
                        switch (err.errno) {
                        case process.EAGAIN:
                            // write would have blocked, try again later
                            bytes_written = 0;
                            break;

                        default:
                            log.error("sendfile(", file, ") failed: ", err.message);
                            // fall through

                        case process.EBADF:
                            // don't write a log message, the timeout handler already did
                            callback();
                            return;
                        }
                    }
                    if (bytes_written > 0) {
                        // this isn't an idle connection.  Bump the connection
                        // timeout. Usually this would be done for us in the
                        // response.write() call but we use sendfile(), so we
                        // need to update this manually.
                        req.connection.setTimeout(settings.timeout_milliseconds);
                    }
                    bytes_to_write -= bytes_written;
                    offset += bytes_written;
                    if (bytes_to_write < 1) {
                        callback();
                    }
                    else {
                        send_chunk(offset, bytes_to_write, callback);
                    }
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
        log.debug("404 opening path: '"+path+"'");
        var body = "404: " + req.url + " not found.\n";
        send_headers(404,body.length,"text/plain");
        resp.write(body);
        finish(resp);
    }

    function server_error(message) {
        log.error(message);
        send_headers(500, message.length, "text/plain");
        resp.write(message);
        finish(resp);
    }

    function execute_sjs() {
        fs.readFile(path, 'utf8', function(err, script) {
            try {
                if (err) throw err;
                var handler = {
                    log: log,
                    require: require
                };
                Script.runInNewContext(script, handler, path);
                handler.handle(req, resp);
            }
            catch (e) {
                server_error("Error executing server script "+path+": "+e);
            }
        });
    }
}

function finish(resp) {	
    resp.end();
    log.debug("finished response");
}

function close(fd) {
    fs.close(fd);
    log.debug("closed fd",fd);
}
