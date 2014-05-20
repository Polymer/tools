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
  // remove spacer rectangles
  node.find('rect[fill],rect[style*="fill"]').remove();
  // remove empty groups
  var innerHTML = $.xml(node.find('*').filter(':not(g)'));
  node.html(innerHTML);
  // remove extraneous whitespace
  var output = $.xml(node).replace(/\t|\r|\n/g, '');
  // print icon svg
  console.log(output);
}

function path2IconName(file) {
  parts = path.basename(file).split('_');
  // remove ic_
  parts.shift();
  // remove _24px.svg
  parts.pop();
  return parts.join('-');
}

files.forEach(function(file) {
  var name = path2IconName(file);
  var $ = read(file);
  transmogrify($, name);
});
