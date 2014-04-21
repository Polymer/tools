#!/bin/bash

# This script provides the repo configurations for Polymer's checkout scripts

# Windows autocloses shell when complete, use `read` to wait for user input
WINDOWS=0
if [[ $OS = "Windows_NT" ]]; then
  WINDOWS=1
fi

REPOS=()
REPO_PATHS=()
SSH=0
ORG="Polymer"

# ARGS: $1 log message, $2 repo shortname
log() {
  echo -e "\033[1;34m===== $1 \033[1;37m$2 \033[1;34m=====\033[0m"
}

ok() {
  echo -e "\033[1;32mOK\033[0m"
}

prepare() {
  # default to https auth
  if [ $SSH -eq 1 ]; then
    GIT_PATH="git@github.com:$ORG"
  else
    GIT_PATH="https://github.com/$ORG"
  fi

  REPOS=(
  core-action-icons
  core-ajax
  core-component-page
  core-component-page-dev
  core-elements
  core-doc-viewer
  core-field
  core-firebase
  core-home-page
  core-home-page-dev
  core-icon
  core-iconset
  core-iconset-svg
  core-layout
  core-layout-grid
  core-layout-trbl
  core-localstorage
  core-media-query
  core-meta
  core-range
  core-selection
  core-selector
  core-tests
  core-docs
  core-theme-aware
  core-overlay
  core-toolbar
  core-tooltip
  core-menu
  core-icon-button
  core-input
  core-item
  core-collapse
  core-pages
  core-header-panel
  core-drawer-panel
  core-transition
  core-list
  ace-element
  chart-js
  code-mirror
  cool-clock
  fire-base
  flatiron-director
  g-kratu
  google-map
  humane-js
  js-beautify
  marked-js
  more-elements
  pdf-js
  pixi-js
  polymer-ajax
  polymer-anchor-point
  polymer-animation
  polymer-collapse
  polymer-cookie
  polymer-doc-viewer
  polymer-elements
  polymer-file
  polymer-flex-layout
  polymer-google-jsapi
  polymer-grid-layout
  polymer-home-page
  polymer-home-page-dev
  polymer-jsonp
  polymer-key-helper
  polymer-layout
  polymer-list
  polymer-localstorage
  polymer-media-query
  polymer-meta
  polymer-mock-data
  polymer-overlay
  polymer-page
  polymer-scrub
  polymer-sectioned-list
  polymer-selection
  polymer-selector
  polymer-shared-lib
  polymer-signals
  polymer-stock
  polymer-ui-accordion
  polymer-ui-action-icons
  polymer-ui-animated-pages
  polymer-ui-arrow
  polymer-ui-base
  polymer-ui-breadcrumbs
  polymer-ui-card
  polymer-ui-clock
  polymer-ui-collapsible
  polymer-ui-dropdown
  polymer-ui-dropup
  polymer-ui-elements
  polymer-ui-field
  polymer-ui-icon
  polymer-ui-icon-button
  polymer-ui-iconset
  polymer-ui-line-chart
  polymer-ui-menu
  polymer-ui-menu-button
  polymer-ui-menu-item
  polymer-ui-nav-arrow
  polymer-ui-overlay
  polymer-ui-pages
  polymer-ui-ratings
  polymer-ui-scaffold
  polymer-ui-sidebar
  polymer-ui-sidebar-header
  polymer-ui-sidebar-menu
  polymer-ui-splitter
  polymer-ui-stock
  polymer-ui-submenu-item
  polymer-ui-tabs
  polymer-ui-theme-aware
  polymer-ui-toggle-button
  polymer-ui-toolbar
  polymer-ui-weather
  polymer-view-source-link
  sampler-scaffold
  smoothie-chart
  speech-mic
  speech-transcript
  three-js
  tk-buildbot
  typeahead-input
  wu-weather
  x-binding
  x-designable
  x-designer
  x-dom-serializer
  x-editors
  x-file-document
  x-inspector
  x-live-edit
  x-meta
  x-output
  x-palette
  x-property-inspector
  x-tags
  x-tree
  yt-search
  yt-search-video
  yt-video
  github-elements
  )

  # Array of all the repos with full path
  REPO_PATHS=()

  for REPO in ${REPOS[@]}; do
    REPO_PATHS+=("$GIT_PATH/$REPO.git")
  done
}

# repos that fail to clone will be put here
FAILED=()

# default branch of clones
DEFAULT_BRANCH="master"

die() {
  if [ -n "$1" ]; then
    err "$1"
  fi
  [ $WINDOWS -eq 1 ] && read
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

# Prints errors or says OK
status_report() {
  if [[ ${#FAILED[@]} -gt 0 ]]; then
    repo_err "$1"
  else
    ok
    [ $WINDOWS -eq 1 ] && read
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
if [ ${0##*[/\\]} == "pull-all-elements.sh" ]; then
  # figure out what branch to pull with the -v "version" argument
  while getopts ":v:s" opt; do
    case $opt in
      s)
        SSH=1
        ;;
      v)
        BRANCH="$OPTARG"
        ;;
      :)
        die "Option -$OPTARG requires an argument"
        ;;
    esac
  done
  prepare
  sync_repos
fi
