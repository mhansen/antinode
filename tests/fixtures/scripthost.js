var sys = require('sys');

exports.handle = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('hello world');
}
