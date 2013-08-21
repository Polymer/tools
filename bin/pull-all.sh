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
  observe-js
  NodeBind
  TemplateBinding
  polymer-expressions
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

err() {
  echo -e "\033[5;1;31m$REPO FAILED TO CHECK OUT!\033[0m"
  read
}

log() {
  echo -e "\033[1;37m===== $1 \033[1;34m$REPO \033[1;37m=====\033[0m"
}

ok() {
  echo -e "\033[1;32mOK\033[0m"
}

pull() {
    pushd $REPO >/dev/null 2>&1
    log "PULLING"
    git checkout master
    git pull --rebase
    if [ $? -ne 0 ]; then
      err
    else
      ok
    fi
    git submodule update --init --recursive
    popd >/dev/null 2>&1
}

checkout() {
  log "CHECKING OUT"
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
