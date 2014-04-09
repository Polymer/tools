#!/bin/bash

# usage gp Polymer core-item
ORG=$1
REPO=$2

# make folder (same as input, no checking!)
mkdir $repo
git clone git@github.com:$org/$repo.git --single-branch

# switch to gh-pages branch
pushd $repo >/dev/null
git checkout --orphan gh-pages

# remove all content
git rm -rf -q .

# use bower to install runtime deployment
bower install $org/$repo#master

# redirect by default to the component folder
echo '^<META http-equiv="refresh" content="0;URL=components/%repo%/"^>' >index.html

# send it all to github
git add -a .
git commit -am 'seed gh-pages'
git push -u origin gh-pages --force

popd >/dev/null
