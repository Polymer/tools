#!/bin/bash
#
# @license
# Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
# This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
# The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
# The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
# Code distributed by Google as part of the polymer project is also
# subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
#
dir="${0%[/\\]*}"
pushd $dir
git pull
if [ ! -e node_modules/bigstraw ]; then
  # ~/node_modules may be the installation target if local node_modules folder doesn't exist
  mkdir node_modules
fi
npm install bigstraw
popd
node $dir/node_modules/bigstraw/index.js -s $dir/../repo-configs/{core,polymer,paper,labs,misc}.json $@