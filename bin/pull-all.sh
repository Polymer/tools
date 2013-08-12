#!/bin/bash

# This script will check out all of the Polymer project's repositories
# Pick which level of authorization you want.

## ssh auth / need acls to Polymer project
# POLYMER_PATH="git@github.com:Polymer"

## https auth / can read without auth
POLYMER_PATH="https://github.com/Polymer"

## read only
# POLYMER_PATH="git://github.com/Polymer"

REPOS=(
  HTMLImports
  CustomElements
  PointerEvents
  PointerGestures
  ShadowDOM
  ObserveJS
  Node-bind
  Template-instantiation
  PolymerExpressions
  platform
  polymer
  projects
  polymer-elements
  polymer-ui-elements
  more-elements
  toolkit-ui
  tools
  buildbot
  apps
  chrome-app-seed
  todomvc
  polymer-chrome-app
  polymer-all
  labs
)

pull() {
    pushd $REPO >/dev/null 2>&1
    echo "PULLING $REPO"
    git checkout master
    git pull
    git submodule update --init --recursive
    popd >/dev/null 2>&1
}

checkout() {
  echo "CHECKING OUT $REPO"
  git clone -b master --recursive "$1"
}

for REPO in ${REPOS[@]}; do
  if [ -d $REPO ]; then
    pull
  else
    checkout "$POLYMER_PATH/$REPO.git"
  fi
done

# Web animations is in a different org, readonly copy only
REPO='web-animations-js'
if [ -d $REPO ]; then
  pull
else
  checkout "git://github.com/web-animations/$REPO"
fi
