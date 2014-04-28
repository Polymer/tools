#!/usr/bin/node

fs = require('fs');
cheerio = require('cheerio');

var cheerioOptions = {xmlMode: true};
var files = process.argv.slice(2);
var EOL = require('os').EOL;

function read(file) {
  var content = fs.readFileSync(file, 'utf8');
  return cheerio.load(content, cheerioOptions);
}

function transmogrify($) {
  // remove styles
  $('svg > style').remove();
  $('[class]').removeAttr('class');
}

function write($) {
  // only write the <g> of each icon
  console.log($.xml('svg > g'));
}

console.log('<svg><defs>');
for (var i = 0, $; i < files.length; i++) {
  $ = read(files[i]);
  transmogrify($);
  write($);
}
console.log('</defs></svg>');
