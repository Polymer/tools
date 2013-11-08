#!/usr/bin/env node

require('simple-github')({owner: process.argv[2]}).request('GET /orgs/:owner/repos').then(function(blob) {
  var repos = blob.map(function(r) {
    return r.name;
  }).sort();
  console.log(repos.join(' '));
});
