#!/bin/bash

# This script provides the repo configurations for Polymer's checkout scripts

# https auth / can read without auth
POLYMER_PATH="https://github.com/Polymer"

# Short names for all the repos
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
  polymer-elements
  polymer-ui-elements
  more-elements
  toolkit-ui
  projects
  tools
  todomvc
  labs
)

# Web Animations has its own org, hardcode full path
WEB_ANIMATIONS_REPO="https://github.com/web-animations/web-animations-js.git"

# Will house all the repos with full path
POLYMER_REPOS=();

for REPO in ${POLYMER_REPOS[@]}; do
  POLYMER_REPOS+=("$POLYMER_PATH/$REPO.git")
done
POLYMER_REPOS+=("$WEB_ANIMATIONS_REPO");

# repos that fail to clone will be put here
FAILED=()

REPO_BRANCH="master"

err() {
  echo -e "\033[1;31m${#FAILED[@]} REPOS FAILED TO CHECK OUT!\033[0m"
    for f in ${FAILED[@]}; do
      echo -e "\033[1m$f\033[0m"
    done
  # Wait for user input
  read
}

log() {
  echo -e "\033[1;37m===== $1 \033[1;34m$2 \033[1;37m=====\033[0m"
}

ok() {
  echo -e "\033[1;32mOK\033[0m"
}

pull() {
    pushd $1 >/dev/null 2>&1
    log "PULLING" "$1"
    git pull "$2" --rebase
    if [ $? -ne 0 ]; then
      FAILED+=($REPO)
    else
      git submodule update --init --recursive
    fi
    popd >/dev/null 2>&1
}

clone() {
  log "CLONING" "$1"
  git clone -b "$2" --recursive "$1"
}
