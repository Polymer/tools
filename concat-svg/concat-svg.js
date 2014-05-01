#!/usr/bin/env node

var fs = require('fs');
var cheerio = require('cheerio');
var path = require('path');

var cheerioOptions = {xmlMode: true};
var files = process.argv.slice(2);

function read(file) {
  var content = fs.readFileSync(file, 'utf8');
  return cheerio.load(content, cheerioOptions);
}

function transmogrify($, name) {
  // output with cleaned up icon name
  var node = $('#Icon').attr('id', name);
  // print icon svg
  console.log($.xml(node));
}

function path2IconName(file) {
  parts = path.basename(file).split('_');
  // remove ic_
  parts.shift();
  // remove _24px.svg
  parts.pop();
  return parts.join('-');
}

console.log('<svg><defs>');
files.forEach(function(file) {
  var name = path2IconName(file);
  var $ = read(file);
  transmogrify($, name);
});
console.log('</defs></svg>');
