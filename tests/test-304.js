require('./common');
var exec = require('child_process').exec;
var file = "304test";

var mtime = "2000-01-01T12:00:00"; //aribtrary

var file_path = path.join(settings.default_host.root, file);
function change_mtime(callback) {
    // Node doesn't have a utime() call to change mtime.
    // We delegate this task to the trusty `touch`
    var command = 'touch '+file_path+' -m -d "'+mtime+'"';
    var child = exec(command, function (err, stdout, stderr) {
        if (err) throw err;
        assert.equal(stdout, "");
        assert.equal(stderr, "");
        callback();
    });
}

var tests = [
/* RFC 2616 Section 14.25
 *
 * a) If the request would normally result in anything other than a
 *    200 (OK) status, or if the passed If-Modified-Since date is
 *    invalid, the response is exactly the same as for a normal GET.
 *    A date which is later than the server's current time is
 *    invalid.  */
{
    "description": "Invalid date string",
    "date":'this is not a valid date string',
    "status":200
},
{
    "description": "A date string in the distant future",
    "date":'Sun, 17 May 2020 08:43:31 GMT',
    "status":200
},
/*  b) If the variant has been modified since the If-Modified-Since date,
 *     the response is exactly the same as for a normal GET.  */
{ 
    "description" : "Before file modification time",
    "date" : 'Sat, 29 Oct 1994 19:43:31 GMT',
    "status": 200
},
/*  c) If the variant has not been modified since a valid If- Modified-Since
 *     date, the server SHOULD return a 304 (Not Modified) response.  */
{
    "description": "After file modification time",
    "date":'Fri, 29 Oct 2004 08:43:31 GMT',
    "status": 304

},
]

var responses = 0;
change_mtime(function() {
    antinode.start(settings, function() {
        var client = http.createClient(settings.port, 'localhost');
        for (var i=0;i<tests.length;i++) {
            var test = tests[i];
            var request = client.request('GET', '/'+file, {
                'if-modified-since': test.date 
            });
            request.addListener('response', createFunc(test));
            request.end();
        };
    });
});

/* Create a new function each time through the loop to avoid 
 * the closure loop variable problem. */
function createFunc(test) {
    return function(response) {
        assert.equal(response.statusCode, test.status);
        responses++;
        if (responses >= tests.length) {
            antinode.stop();
            puts("304 Test OK");
        }
    }
}
