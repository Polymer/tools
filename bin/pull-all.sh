#!/bin/bash
dir="${0%[/\\]*}"
pushd $dir
npm install bigstraw
popd
node $dir/node_modules/bigstraw/index.js $dir/../repo-configs/*.json $@
