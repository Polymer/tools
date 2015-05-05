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

# This script pushes a demo-friendly version of your element and its
# dependencies to gh-pages.

# usage gp Polymer core-item [branch]
# Run in a clean directory passing in a GitHub org and repo name
org=$1
repo=$2
branch=${3:-"master"} # default to master when branch isn't specified

# make folder (same as input, no checking!)
mkdir $repo
git clone git@github.com:$org/$repo.git -b $branch --single-branch

# switch to gh-pages branch
pushd $repo >/dev/null
git checkout --orphan gh-pages

# use bower to install runtime deployment
bower cache clean # ensure we're getting the latest
echo "{
  \"directory\": \"./\"
}
" > .bowerrc

# install current component into a subfolder (including dev dependencies!)
bower install ./#$branch

# remove all original content
git rm -rf -q .

# redirect by default to the component folder
echo "<META http-equiv="refresh" content=\"0;URL=$repo/\">" >index.html

# send it all to github
git add -A .
git commit -am 'seed gh-pages'
git push -u origin gh-pages --force

popd >/dev/null
