#!/bin/bash -e

dir=`pwd -P`
TMP="$dir/builds-temp"
mkdir -p $TMP
pushd $TMP

pushd components/platform
git reset --hard origin/master
popd

pushd components/polymer
git reset --hard origin/master
popd

node $dir/node_modules/bigstraw/index.js -s $dir/../repo-configs/polymer.json

pushd components/platform-dev
npm install
grunt minify audit
cp build/build.log build/platform.js build/platform.js.map ../platform/
popd

pushd components/platform
git commit . -m 'update build'
git push origin master
popd

pushd components/polymer-dev
npm install
grunt minify audit
cp build/build.log build/polymer.js build/polymer.js.map ../polymer/
popd

pushd components/polymer
git commit . -m 'update build'
git push origin master
popd

popd
