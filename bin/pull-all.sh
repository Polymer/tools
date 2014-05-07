#!/bin/bash
dir="${0%[/\\]*}"
pushd $dir
git pull
if [ ! -e node_modules/bigstraw ]; then
  npm install bigstraw
fi
popd
node $dir/node_modules/bigstraw/index.js -s $dir/../repo-configs/*.json $@
