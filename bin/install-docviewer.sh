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

die() {
  echo $1
  exit 1
}

log() {
  echo -e "\033[1;34m===== $1 \033[1;37m$2 \033[1;34m=====\033[0m"
}

INDEX=
while getopts ":i:" opt; do
  case $opt in
    i)
      INDEX="$OPTARG"
      ;;
    :)
      die "Option -$OPTARG requires an argument"
      ;;
  esac
done

if [ -z $INDEX ]; then
  die "Need index.html to copy, use -i flag to specify"
fi

shift $(($OPTIND - 1))

for repo in $@; do
  name=${repo##*[/\\]};
  log "Installing Doc Viewer to" "$name"
  if [ -e $repo/index.html ] && [ -e $repo/smoke.html ]; then
    continue;
  fi
  if [ -e $repo/index.html ]; then
    echo "moving old index.html to smoke test"
    mv $repo/index.html $repo/smoke.html
  fi
  echo "Copying doc index.html"
  cp $INDEX $repo/index.html
done