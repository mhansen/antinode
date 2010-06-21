var http = require('http'),
    fs = require('fs'),
    pathlib = require('path'),
    uri = require('url'),
    mime = require('./content-type'),
    log = require('./log'),
    package = JSON.parse(fs.readFileSync(__dirname+'/../package.json', 'utf8')),
    sys = require('sys'),
    Script = process.binding('evals').Script;

exports.default_settings = {
    "timeout_milliseconds": 1000 * 30,
    "hosts" : {},
    "port" : 8080, /* a port that you don't need root to bind to */
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

        function get_local_file_path() {
            var url = uri.parse(req.url);
            //if the parsed url doesn't have a pathname, default to '/'
            var pathname = (url.pathname || '/');
            var clean_pathname = pathname.
                replace(/\.\.\//g,''). //disallow parent directory access
                replace(/\%20/g,' ');  //convert spaces

            function select_vhost() {
                if (req.headers.host) {
                    var hostname = req.headers.host.split(':')[0]; //remove port
                    return settings.hosts[hostname] || settings.default_host;
                } else {
                    return settings.default_host;
                }
            }
            var vhost = select_vhost(req.headers.host);
            
            var path = pathlib.join(vhost.root, clean_pathname);
            return path;
        }
        var path = get_local_file_path();
        handle_request(path, req, resp);
    });
    server.listen(settings.port);
    server.addListener('listening', function() {
        if (callback) callback();
    });
    server.addListener('connection', function(connection) {
        connection.setTimeout(settings.timeout_milliseconds);
        connection.addListener('timeout', function() {
            log.debug("Connection from",connection.remoteAddress,"timed out.");
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

function handle_request(path, req, resp) {
    function send_headers(httpstatus, length, content_type, modified_time) {
        var headers = {
            "Server": "Antinode/"+package.version+" Node.js/"+process.version,
            "Date": (new Date()).toUTCString()
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
        log.info(req.connection.remoteAddress,req.method,path,httpstatus,length);
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
                } else if (req.method == 'HEAD') {
                    send_headers(200, stats.size, mime.mime_type(path), stats.mtime);
                    finish(resp);
                } else {
                    return stream_file(path, stats);
                }
            }
        }
    });

    function stream_file(file, stats) {
        try {
            var readStream = fs.createReadStream(file);
        } 
        catch (err) {
            log.debug("fs.createReadStream(",file,") error: ",sys.inspect(err));
            return file_not_found();
        }

        send_headers(200, stats.size, mime.mime_type(file), stats.mtime);

        req.connection.addListener('timeout', function() {
            /* dont destroy it when the fd's already closed */
            if (readStream.fd) {
                log.debug('timed out. destroying file read stream');
                readStream.destroy();
            }
        });

        readStream.addListener('open', function() {
            log.debug("opened",path);
        });
        readStream.addListener('data', function (data) {
            // send it out
            resp.write(data);
        });
        readStream.addListener('error', function (err) {
            log.error('error reading',file,sys.inspect(err));
            finish(resp);
        });
        readStream.addListener('end', function () {
            finish(resp);
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
        if (req.method != 'HEAD') {
            resp.write(body);
        }
        finish(resp);
    }

    function server_error(message) {
        log.error(message);
        send_headers(500, message.length, "text/plain");
        if (req.method !== 'HEAD') {
            resp.write(message);
        }
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
