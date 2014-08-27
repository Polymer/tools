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

browserstack=./node_modules/browserstack-cli/bin/cli.js

runBS() {
  $browserstack tunnel localhost:9876 &
  tunnelPid=$!
  $browserstack launch --attach --os $2 $1 $3
}

killBS() {
  kill -s STOP $tunnelPid
}

trap "killBS; exit 0" EXIT

browser=$1
os=$2
url=$3
runBS $browser $os $url