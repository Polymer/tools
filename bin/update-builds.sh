#!/bin/bash -e
#
# @license
# Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
# This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
# The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
# The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
# Code distributed by Google as part of the polymer project is also
# subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
#

RELEASE=0
while getopts ":r" opt; do
  case $opt in
    r)
      RELEASE=1
      ;;
  esac
done

dir=`pwd -P`
TMP="$dir/builds-temp"
mkdir -p $TMP
pushd $TMP

if [ -d components/webcomponentsjs ]; then
  pushd components/webcomponentsjs
  git reset --hard origin/master
  popd
fi

if [ -d components/polymer ]; then
  pushd components/polymer
  git reset --hard origin/master
  popd
fi

node $dir/node_modules/bigstraw/index.js -s $dir/../repo-configs/polymer.json -b master

pushd components/webcomponentsjs-dev
npm install
if [ $RELEASE -eq 1 ]; then
  gulp release
else
  gulp
fi
cp dist/* ../webcomponentsjs/
popd

pushd components/webcomponentsjs
if ! git diff --quiet; then
  if [ $RELEASE -eq 1 ]; then
    git commit . -m 'update build for release'
  else
    git commit . -m 'update build'
  fi
  git push origin master
fi
popd

pushd components/polymer-dev
npm install
if [ $RELEASE -eq 1 ]; then
  grunt release
else
  grunt minify audit
fi
cp build/build.log build/polymer.js build/polymer.js.map layout.html ../polymer/
popd

pushd components/polymer
if ! git diff --quiet; then
  if [ $RELEASE -eq 1 ]; then
    git commit . -m 'update build for release'
  else
    git commit . -m 'update build'
  fi
  git push origin master
fi
popd

popd
