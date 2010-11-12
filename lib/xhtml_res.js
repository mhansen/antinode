var header = '<?xml version="1.0" encoding="utf-8" ?>\n<!DOCTYPE html>\n';

var namespace = {
	'begin' : '<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en">\n',
	'end' : '</html>\n'
}

var head = {
	'begin' : '<head>\n',
	'end' : '</head>\n',
	'title' : function(title) { return '<title>' + title + '</title>\n'; },
	'css' : function(style) { return '<style type="text/css">\n' + style + '</style>\n' }
}

var body = {
	'begin' : '<body>\n',
	'end' : '</body>\n'
}

exports.error = function (code, title, desc) {
	return header + namespace.begin + head.begin 
		+ head.title(code + ': ' + title) + head.end
		+ body.begin + '<h1>' + title + '</h1>\n'
		+ '<p>' + desc + '</p>\n'
		+ body.end + namespace.end;
}

// List the content of a directory, lighttpd way.
// TODO: Display human readable sizes and dates, cut too long file names.
exports.listdir = function (dir, files) {
	var style = 'a, a:active {text-decoration: none; color: blue;}\n'
		+ 'a:visited {color: #48468F;}\n'
		+ 'a:hover, a:focus {text-decoration: underline; color: red;}\n'
		+ 'body {background-color: #F5F5F5;}\n'
		+ 'h2 {margin-bottom: 12px;}\n'
		+ 'table {margin-left: 12px; border-collapse: collapse;}\n'
		+ 'th, td { font: 90% monospace; text-align: left; padding: 0px;}\n'
		+ 'th { font-weight: bold; padding-right: 14px; padding-bottom: 3px;}\n'
		+ 'td {padding-right: 14px;}\n'
		+ 'td.s, th.s {text-align: right;}\n'
		+ 'div.list { background-color: white; border-top: 1px solid #646464; border-bottom: 1px solid #646464; padding-top: 10px; padding-bottom: 14px;}\n'
		+ 'div.foot { font: 90% monospace; color: #787878; padding-top: 4px;}\n';
	var resp = header + namespace.begin + head.begin
		+ head.title('Index of ' + dir)
		+ head.css(style) + head.end
		+ body.begin + '<h2>Index of ' + dir + '</h2>\n'
		+ '<div class="list">\n'
		+ '<table>\n'
		+ '<thead><tr><th class="n">Name</th><th class="m">Last Modified</th><th class="s">Size</th><th class="t">Type</th></tr></thead>\n'
		+ '<tbody>\n';
	for (i in files.folders) {
		resp += '<tr>'
			+ '<td class="n"><a href="' + files.folders[i].path + '">' + files.folders[i].name + '</a>/</td>'
			+ '<td class="m">' + (files.folders[i].mtime || ' ') + '</td>'
			+ '<td class="s">-  </td>'
			+ '<td class="t">Directory</td>'
			+ '</tr>\n';
	}
	for (i in files.files) {
		resp += '<tr>'
			+ '<td class="n"><a href="' + files.files[i].path + '">' + files.files[i].name + '</a></td>'
			+ '<td class="m">' + files.files[i].mtime + '</td>'
			+ '<td class="s">' + files.files[i].size + '</td>'
			+ '<td class="t">' + files.files[i].mime_type + '</td>'
			+ '</tr>\n';
	}
	resp += '</tbody>\n'
		+ '</table>\n'
		+ '</div>\n'
		+ '<div class="foot"></div>\n'
		+ body.end
		+ namespace.end;
	return resp;
}
