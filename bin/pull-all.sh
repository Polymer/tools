#!/bin/bash

# This script provides the repo configurations for Polymer's checkout scripts

# Check if cwd/tools/bin/pull-all exists, use that if it does
# this way, a random download of pull-all is always correct
if [ -x "tools/bin/pull-all.sh" ] && ! [ "$0" -ef "tools/bin/pull-all.sh" ]; then
  echo "exec'ing more up-to-date copy"
  exec tools/bin/pull-all.sh "$@"
fi

# default to https auth
POLYMER_PATH=${POLYMER_PATH:-"https://github.com/Polymer"}

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

# Array of all the repos with full path
REPO_PATHS=()

for REPO in ${REPOS[@]}; do
  REPO_PATHS+=("$POLYMER_PATH/$REPO.git")
done

# Web Animations has its own org, hardcode full path
REPOS+=("web-animations-js")
REPO_PATHS+=("https://github.com/web-animations/web-animations-js.git")

# repos that fail to clone will be put here
FAILED=()

# default branch of clones
DEFAULT_BRANCH="master"

die() {
  read
  exit 1
}

err() {
  echo -e "\033[1;31m$1\033[0m"
}

repo_err() {
  err "${#FAILED[@]} REPOS FAILED TO $1!"
    for f in ${FAILED[@]}; do
      echo -e "\033[1m$f\033[0m"
    done
  # Wait for user input
  die
}

# ARGS: $1 log message, $2 repo shortname
log() {
  echo -e "\033[1;34m===== $1 \033[1;37m$2 \033[1;34m=====\033[0m"
}

ok() {
  echo -e "\033[1;32mOK\033[0m"
}

# Prints errors or says OK
status_report() {
  if [[ ${#FAILED[@]} -gt 0 ]]; then
    repo_err "$1"
  else
    ok
  fi
}

# ARGS: $1 shortname, $2 branch
pull() {
  pushd $1 >/dev/null 2>&1
  log "PULLING" "$1"
  # argument arity is important for some reason :(
  if [[ -z "$2" ]]; then
    git pull --rebase
  else
    git pull --rebase origin "$2"
  fi
  if [ $? -ne 0 ]; then
    FAILED+=($1)
  else
    git submodule update --init --recursive
  fi
  popd >/dev/null 2>&1
}

# ARGS: $1 shortname, $2 branch
clone() {
  log "CLONING" "$1"
  branch=${2:-$DEFAULT_BRANCH}
  git clone -b "$branch" --recursive "$1"
}

# ARGS: $1 branch
sync_repos() {
  for i in ${!REPOS[@]}; do
    REPO="${REPOS[$i]}"
    if [ -d $REPO ]; then
      pull "$REPO" "$1"
    else
      clone "${REPO_PATHS[$i]}" "$1"
    fi
  done

  status_report "CHECKOUT"
}

# only sync if run, not if importing functions
if [ `basename $0` == "pull-all.sh" ]; then
  sync_repos
fi
