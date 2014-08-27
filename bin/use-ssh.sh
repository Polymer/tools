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

# find all repos
REPOS=`find $PWD -type d -name ".git" -maxdepth 2`

for repo in $REPOS; do
  path=${repo%%/.git}
  name=${path##*[/\\]}
  pushd $path > /dev/null
  
  git remote set-url origin git@github.com:polymer-elements/$name.git

  popd > /dev/null
done