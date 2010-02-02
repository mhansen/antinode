Antinode is a simple static file webserver built on node.js.

# Usage

Run it from the command line. 

   $ node server.js

If you want to bind to a port under 1024, you'll need to run node with special privileges.

# Configuration

Edit config.js to set up where to serve files from, and what port to listen on.

Example config file:

    exports.settings = {
        "port" : 8080,
        "baseDir" : "/var/www"
    }

This serves up all the files in `/var/www` listening to HTTP requests on port 8080.
E.g. an HTTP request for `/styles/site.css` will will look for the file `/var/www/styles/site.css`

# Features

- HTTP `Content-Type` header detection from file extension
- HTTP `Content-Length` header support
- HTTP `Date` header
- Reads files in binary mode - so can serve images and other binary files (not just text)
- Requests to any `directory` try to return `directory/index.html`

# Credits

Original code forked from [Noah Sloan](http://github.com/iamnoah)'s [simple logging webserver](http://gist.github.com/246761).
