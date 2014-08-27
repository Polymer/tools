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

# You must have ios-sim installed for this to work!
#   (https://github.com/phonegap/ios-sim)

tmpdir=/tmp/ios-simulator-$$

runSafari() {
  scriptdir=`dirname $0`
  mkdir $tmpdir
  unzip -d $tmpdir $scriptdir/IOSSimulatorSafariLauncher.app.zip
  ios-sim launch $tmpdir/IOSSimulatorSafariLauncher.app --family ipad --args "$1"
}

killSafari() {
  killall "iPhone Simulator"
  killall ios-sim
  rm -rf $tmpdir
}

trap "killSafari; exit 0" EXIT

runSafari "$1"