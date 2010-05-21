require.paths.push(__dirname);
var run = require('./lib/nodeunit/lib/nodeunit').testrunner.run;
run(['tests']); // test all js files in tests dir
