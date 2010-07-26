var url = require('url');
var sys = require('sys');

/* export a single function 'preprocessor' 
 * this is middleware - it intercepts functions before anitnode has a chance to serve them
 * you can rewrite rules, do redirects here, whatever */
exports['preprocessor'] = function (req, resp, callback) {
    if (req.headers.host === '301.domain.com') {
        return redirect_to("http://default-host"+req.url);
    }
    else {
        callback(req, resp);
    }
    function redirect_to(url) {
        resp.writeHead(301, {
            'Location': url
        });
        resp.end('');
    }
}
