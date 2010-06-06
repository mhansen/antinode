// -*- JavaScript -*-

function handle (req, resp) {
    log.info("in user-defined handler");
    resp.writeHead(200, { 'Content-Type': 'text/plain'});
    resp.end('hello world');
}

