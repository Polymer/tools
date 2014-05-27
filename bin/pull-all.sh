#!/bin/bash
dir="${0%[/\\]*}"
pushd $dir
git pull
if [ ! -e node_modules/bigstraw ]; then
  # ~/node_modules may be the installation target if local node_modules folder doesn't exist
  mkdir node_modules
  npm install bigstraw
fi
popd
node $dir/node_modules/bigstraw/index.js -s $dir/../repo-configs/{core,polymer}.json $@
