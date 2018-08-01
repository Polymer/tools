#!/usr/bin/env bash

# Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
# This code may only be used under the BSD style license found at
# http://polymer.github.io/LICENSE.txt The complete set of authors may be found
# at http://polymer.github.io/AUTHORS.txt The complete set of contributors may
# be found at http://polymer.github.io/CONTRIBUTORS.txt Code distributed by
# Google as part of the polymer project is also subject to an additional IP
# rights grant found at http://polymer.github.io/PATENTS.txt

# This script should be run from `npm run test:setup`. It reads a list of repos
# from `fixtures.txt`, clones them into the `src/test/fixtures` directory, and
# installs them for testing.
#
# To add a new repo for testing, add it to `fixtures.txt`, run `npm run
# test:setup && npm run update-goldens`.

set -e

cd src/test
mkdir -p fixtures
cd fixtures

while read -r repo commitish dir; do
  if [ $repo = "#" ]; then continue; fi  # Commented out line. 
  if [ -d $dir ]; then continue; fi  # Already set up.
  # Note you can't do a shallow clone of a SHA.
  git clone $repo $dir
  cd $dir
  git checkout $commitish
  if [ -e package.json ]; then
    npm install --production
  elif [ -e bower.json ]; then
    bower install --production
  fi
  cd -
done < ../../../scripts/fixtures.txt
