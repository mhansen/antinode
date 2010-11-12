var http = require('http'),
    fs = require('fs'),
    pathlib = require('path'),
    uri = require('url'),
    mime = require('./content-type'),
    log = require('./log'),
    xhtml_res = require('./xhtml_res'),
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
    "log_level" : log.levels.DEBUG,
    "index_files" : [ "index.html" ]
};
exports.log_levels = log.levels;

var settings;

var server;

/* require() all the scripts at the start, so there's no
 * waiting for in the middle of a request */
function load_hostspecific_handlers() {
    for (var host in settings.hosts) {
        var script = settings.hosts[host]['handler'];
        if (script !== undefined && typeof script === 'string') {
            /* remove filename extension */
            var require_name = script.match(/(.*)\..*/)[1];
            settings.hosts[host].handler = require(require_name);
        }
    }
}

/* call the module_init method if exists on each registered module.
   allows modules to hook in to the server startup event. */
function handlers_init() {
    for(var host in settings.hosts) {
        if(settings.hosts[host].handler && settings.hosts[host].handler.handler_init) {
            settings.hosts[host].handler.handler_init();
        }
    }
}

/* default preprocessor - just send the file out */
var preprocess_request = map_request_to_local_file; 

exports.start = function(custom_settings, callback) {
    settings = custom_settings || {};
    settings.__proto__ = exports.default_settings;
    
    load_hostspecific_handlers();
    if (settings.request_preprocessor) {
        preprocess_request = settings.request_preprocessor;
    }

    log.level = settings.log_level;
    log.info( "Starting server on port", settings.port);
    
    server = http.createServer(function(req,resp) {
        log.debug("Request from", req.connection.remoteAddress, "for", req.url);
        log.debug(JSON.stringify(req.headers));
        preprocess_request(req, resp, map_request_to_local_file);
    });
    server.listen(settings.port);
    handlers_init();
    server.addListener('listening', function() {
        if (callback) callback();
    });
    server.addListener('connection', function(connection) {
        connection.setTimeout(settings.timeout_milliseconds);
        connection.addListener('timeout', function() {
            log.debug("Connection from",connection.remoteAddress,"timed out. Closing it...");
            connection.destroy();
        });
    });
};

/* decides which file on our file system the request is asking for
 * then dispatch to stream_file to send it out */
function map_request_to_local_file(req, resp) {
    var url = uri.parse(req.url);
    //if the parsed url doesn't have a pathname, default to '/'
    var pathname = (url.pathname || '/');
    var clean_pathname = 
        decodeURIComponent(pathname). // decode non-ascii chars, spaces, etc
        replace(/\.\.\.*\/\/*/g,''); //disallow parent directory access

    function select_vhost() {
        if (req.headers.host) {
            var hostname = req.headers.host.split(':')[0]; //remove port
            return settings.hosts[hostname] || settings.default_host;
        } else {
            return settings.default_host;
        }
    }
    var vhost = select_vhost(req.headers.host);
    if (vhost.handler && vhost.handler.handle) {
        var action = vhost.handler.handle(req,resp);
        if(action && typeof action === 'function') {
            if(vhost.handler.handler_environment){
                action.apply(vhost.handler.handler_environment(req, resp))
            }
            else {
                action(req, resp);
            }
            return;
        }
    } 
    serve_file(pathlib.join(vhost.root, clean_pathname), req, resp);
}

function serve_file(path, req, resp) {
    if (path.match(/\.sjs$/)) {
        execute_sjs(path, req, resp);
    } else {
        serve_static_file(path, req, resp);
    }
}

exports.stop = function(callback) {
    if (server) {
        if (callback) server.addListener('close', callback);
        server.close();
    }
};

function serve_static_file(path, req, resp) {
    function send_headers(httpstatus, headers) {
        headers = headers || {};
        headers["Server"] = "Antinode/"+package.version+" Node.js/"+process.version;
        headers["Date"] = (new Date()).toUTCString();

        resp.writeHead(httpstatus, headers);
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
            var parsed_url = uri.parse(req.url);
            if (parsed_url.pathname.match(/\/$/)) {
				// Search for an index file configured in settings.index_files.
				// If none found, list the content of the directory.
				var index_files = settings.index_files;
				fs.readdir(path, function (err, files) {
					if (err) {
						server_error(err);
						return;
					}
					var found = false;
					while (!found && index_files.length > 0) {
						for (i in files) {
							if (files[i] === index_files[0])
								found = true;
							}
						if (!found)
							index_files.shift();
					}
					if (found) {
						serve_file(pathlib.join(path, index_files[0]), req, resp);
					}
					else 
						return list_directory(path, files);
				});
            }
            else {
                var redirect_host = req.headers.host ? ('http://' + req.headers['host']) : '';
                var redirect_path = parsed_url.pathname + "/" + (parsed_url.search || "");
                return redirect_302_found(redirect_host + redirect_path);
            }
        }
		else if (!stats.isFile()) {
            return file_not_found();
        } else {
            var if_modified_since = req.headers['if-modified-since'];
            if (if_modified_since) {
                var req_date = new Date(if_modified_since);
                if (stats.mtime <= req_date && req_date <= Date.now()) {
                    return not_modified();
                }
                else stream_file(path, stats);
            } else if (req.method == 'HEAD') {
                send_headers(200, {
                    'Content-Length':stats.size, 
                    'Content-Type':mime.mime_type(path),
                    'Last-Modified': stats.mtime
                });
                resp.end('');
            } else {
                return stream_file(path, stats);
            }
		}
	});

    function stream_file(file, stats) {
        try {
            var readStream = fs.createReadStream(file);
        } 
        catch (err) {
            log.debug("fs.createReadStream(",file,") error: ",sys.inspect(err,true));
            return file_not_found();
        }

        send_headers(200, {
            'Content-Length':stats.size, 
            'Content-Type':mime.mime_type(file),
            'Last-Modified':stats.mtime
        });
        sys.pump(readStream, resp, function() {
            log.debug('pumped',file);
        });

        req.connection.addListener('timeout', function() {
            /* dont destroy it when the fd's already closed */
            if (readStream.readable) {
                log.debug('timed out. destroying file read stream');
                readStream.destroy();
            }
        });

        readStream.addListener('fd', function(fd) {
            log.debug("opened",path,"on fd",fd);
        });

        readStream.addListener('error', function (err) {
            log.error('error reading',file,sys.inspect(err));
            resp.end('');
        });
        resp.addListener('error', function (err) {
            log.error('error writing',file,sys.inspect(err));
            readStream.destroy();
        });
    }

	function list_directory(dir, list) {
		var files = { 'folders' : [], 'files' : [] }
		var count = { 'folders' : 0, 'files' : 0 };
		var pathname = uri.parse(req.url).pathname || '/';
		pathname = decodeURIComponent(pathname);
		list.sort(function(a, b) { return (a.toLowerCase() < b.toLowerCase()) ? -1 : 1 });
		if (pathname != '/') {
			files.folders[count.folders] = { 
				'path' : pathlib.normalize(pathlib.join(pathname, '../')),
				'name' : 'Parent Directory',
				'mtime' : ''
			};
			count.folders++;
		}
		if (list.length > 0)
			fs.stat(pathlib.join(dir, list[0]), add_file);
		else {
			resp.writeHead(200, {'Content-Type' : 'application/xhtml+xml'});
			resp.end(xhtml_res.listdir(pathname, files));
		}
		function add_file (err, stats) {
			if (err) {
				server_error(err);
				return;
			}
			if (stats.isDirectory()) {
				files.folders[count.folders] = {
					'path' : pathlib.join(pathname, list[0]) + "/",
					'name' : list[0],
					'mtime' : stats.mtime.toUTCString(),
				}
				count.folders++;
			}
			else if (stats.isFile()) {
				files.files[count.files] = {
					'path' : pathlib.join(pathname, list[0]),
					'name' : list[0],
					'size' : stats.size,
					'mtime' : stats.mtime.toUTCString(),
					'mime_type' : mime.mime_type(list[0])
				}
				count.files++;
			}
			list.shift();
			if (list.length > 0)
				fs.stat(pathlib.join(dir, list[0]), add_file);
			else {
				var body = xhtml_res.listdir(pathname, files);
				send_headers(200, {
					"Content-Length":Buffer.byteLength(body, 'utf8'),
					"Content-Type":"application/xhtml+xml"
				});
				resp.end(body);
			}
		}
	}

    function not_modified() {
        // no need to send content length or type
        log.debug("304 for resource ", path);
        send_headers(304);
        resp.end('');
    }

    function file_not_found() {
        log.debug("404 opening path: '"+path+"'");
        var body = xhtml_res.error(404, "Not Found", req.url+" was not found on this server");
        send_headers(404,{ 
            'Content-Length':Buffer.byteLength(body, 'utf8'),
            'Content-Type':"application/xhtml+xml"
        });
        if (req.method != 'HEAD') {
            resp.end(body, 'utf-8');
        } else {
            resp.end('');
        }
    }

    function server_error(message) {
        log.error(message);
		var body = xhtml_res.error(500, "Internal Server Error", message);
        send_headers(500, {
            'Content-Length':Buffer.byteLength(body, 'utf8'),
            'Content-Type':"text/plain"
        });
        if (req.method !== 'HEAD') {
            resp.end(message,'utf-8');
        }
    }

    function redirect_302_found(location) {
        log.debug('redirecting with "302 Found" to ' + location);
        send_headers(302, {
            'Location' : location
        });
        resp.end('');
    }
}

function execute_sjs(path, req, resp) {
    fs.readFile(path, 'utf8', function(err, script) {
        try {
            if (err) throw err;
            var sandbox = {
                log: log,
                require: require,
                __filename: path,
                __dirname: pathlib.dirname(path)
            };
            Script.runInNewContext(script, sandbox, path);
            sandbox.handle(req, resp);
        }
        catch (e) {
            resp.writeHead(500,{'Content-Type':'text/plain'});
            resp.end("Error executing server script "+path+": "+e);
        }
    });
}

function close(fd) {
    fs.close(fd);
    log.debug("closed fd",fd);
}
