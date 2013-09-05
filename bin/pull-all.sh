#!/bin/bash

# This script provides the repo configurations for Polymer's checkout scripts

# Check if cwd/tools/bin/pull-all exists, use that if it does
# this way, a random download of pull-all is always correct
if [ `basename $0` == "pull-all.sh" ] && [ -x "tools/bin/pull-all.sh" ] && ! [ "$0" -ef "tools/bin/pull-all.sh" ]; then
  echo "exec'ing more up-to-date copy"
  exec tools/bin/pull-all.sh "$@"
fi

# default to https auth
POLYMER_PATH=${POLYMER_PATH:-"https://github.com/Polymer"}

# Short names for all the repos
REPOS=(
  CustomElements
  HTMLImports
  NodeBind
  PointerEvents
  PointerGestures
  ShadowDOM
  TemplateBinding
  WeakMap
  labs
  more-elements
  observe-js
  platform
  polymer
  polymer-elements
  polymer-expressions
  polymer-ui-elements
  projects
  todomvc
  toolkit-ui
  tools
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
  if [ -n "$1" ]; then
    err "$1"
  fi
  read
  exit 1
}

err() {
  echo -e "\033[1;31m$1\033[0m"
}

repo_err() {
  err "${#FAILED[@]} REPOS FAILED TO $1!"
    for f in "${FAILED[@]}"; do
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

# ARGS: $1 shortname
pull() {
  pushd $1 >/dev/null 2>&1
  log "PULLING" "$1"
  # argument arity is important for some reason :(
  if [[ -z "$BRANCH" ]]; then
    git pull --rebase
  else
    git checkout "$BRANCH"
    git pull --rebase origin "$BRANCH"
  fi
  if [ $? -ne 0 ]; then
    FAILED+=("$1")
  else
    git submodule update --init --recursive
  fi
  popd >/dev/null 2>&1
}

# ARGS: $1 repo path, $2 shortname
clone() {
  log "CLONING" "$1"
  b=${BRANCH:-$DEFAULT_BRANCH}
  git clone -b "$b" --recursive "$1"
  if [ $? -ne 0 ]; then
    FAILED+=($2)
  fi
}

# ARGS: $1 branch
sync_repos() {
  for i in "${!REPOS[@]}"; do
    REPO="${REPOS[$i]}"
    if [ -d $REPO ]; then
      pull "$REPO"
    else
      clone "${REPO_PATHS[$i]}" "$REPO"
    fi
  done

  status_report "CHECKOUT"
}

# only sync if run, not if importing functions
if [ `basename $0` == "pull-all.sh" ]; then
  # figure out what branch to pull with the -v "version" argument
  while getopts ":v:" opt; do
    case $opt in
      v)
        BRANCH="$OPTARG"
        ;;
      :)
        die "Option -$OPTARG requires an argument"
        ;;
    esac
  done
  sync_repos
fi
