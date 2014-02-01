#!/bin/bash

# ssh auth, easier to script
POLYMER_PATH="git@github.com:Polymer"
REPOLIST=()

# Only pull new versions with -p flag
PULL=false

# If -t flag is given, actually push the tags
PUSHTAGS=false

# test by default, override with -f flag
TEST=true

# Must give a version number with -v
VERSION=

# Don't make builds automatically, override with -b flag
BUILD=false

# Make new tags, override with -n
TAG=true

# directory for tools/bin scripts
PA_PREFIX="$PWD/${0%[/\\]*}"

# node script for mucking with package json
VERSIONSCRIPT="$PA_PREFIX/set-version.js"

while getopts ":bfnptv:" opt; do
  case $opt in
    b)
      BUILD=true
      ;;
    f)
      TEST=false
      ;;
    n)
      TAG=false
      ;;
    p)
      PULL=true
      ;;
    t)
      PUSHTAGS=true
      ;;
    v)
      VERSION="$OPTARG"
      ;;
    :)
      die "Option -$OPTARG requires an argument";
  esac
done

# abort on missing version number
# TODO(dfreed): read the version out of polymer and bump it up one?
if [[ -z "$VERSION" ]]; then
  echo "Need a version number!"
  exit 1
fi

load() {

  # import and checkout repos from all scripts
  ! [ -d components ] && mkdir components
  pushd components

  # polymer repos
  . "$PA_PREFIX/pull-all-polymer.sh"
  BRANCH=master
  SSH=1
  prepare
  if $PULL; then
    sync_repos
  fi

  # skip web animations repo
  for r in ${REPOS[@]}; do
    if [ $r = 'web-animations-js' ]; then
      continue
    fi
    REPOLIST+=("components/$r")
  done

  # element repos
  . "$PA_PREFIX/pull-all-elements.sh"
  BRANCH=master
  SSH=1
  prepare
  if $PULL; then
    sync_repos
  fi
  for r in ${REPOS[@]}; do
    REPOLIST+=("components/$r")
  done
  popd

  ! [ -d projects ] && mkdir projects
  pushd projects

  # project repos
  . "$PA_PREFIX/pull-all-projects.sh"
  BRANCH=master
  SSH=1
  prepare
  if $PULL; then
    sync_repos
  fi
  for r in ${REPOS[@]}; do
    REPOLIST+=("projects/$r")
  done
  popd

}

version() {
  if [ -e "bower.json" ]; then
    node $VERSIONSCRIPT "$PWD/bower.json" $VERSION
  fi
}

tag_repos() {
  FAILED=()
  for REPO in "${REPOLIST[@]}"; do
    pushd $REPO >/dev/null
    log "TAGGING" "$REPO"
    git checkout -q --detach
    version "$VERSION"
    git ci -a -m "release $VERSION"
    git tag -f "$VERSION"
    popd >/dev/null
  done
  status_report "TAG"
}

push_tags() {
  FAILED=()
  for REPO in "${REPOLIST[@]}"; do
    pushd $REPO >/dev/null
    log "PUSHING TAG" "$REPO"
    git push --tags
    if [ $? -ne 0 ]; then
      FAILED+=($REPO)
    fi
    popd >/dev/null
  done;
  status_report "PUSH"
}

gen_changelog() {
  echo -n "" > "changelog.md"
  for REPO in ${REPOLIST[@]}; do
    pushd $REPO >/dev/null

    # strip off the leading folders
    RNAME=${REPO##*[/\\]}

    # Changelog format: - commit message ([commit](commit url on github))
    PRETTY="- %s ([commit](https://github.com/Polymer/${RNAME}/commit/%h))"
    log "GEN CHANGELOG" "$REPO"

    # find slightly older tag, sorted semver style
    OLD_VERSION="`git tag -l | sort -t. -k1,1n -k2,2n -k3,3n | tail -n 2 | head -n 1`"
    if [[ -n $OLD_VERSION ]]; then
      echo "#### ${RNAME}" >> "../../changelog.md"
      git log $OLD_VERSION..$VERSION --pretty="$PRETTY" >> "../../changelog.md"
      echo "" >> "../../changelog.md"
    fi
    popd >/dev/null
  done
  ok
}

build() {

  # build platform
  pushd components/platform-dev
  log "INSTALLING" "node modules"
  npm --silent install
  if $TEST; then
    log "TESTING" "platform"
    grunt test
    if [ $? -ne 0 ]; then
      die "platform FAILED TESTING"
    fi
  fi
  log "BUILDING" "platform"
  grunt

  # version number on build file
  mv build/{build.log,platform.js{,.map}} ../platform/
  ok
  popd >/dev/null

  # build polymer
  pushd components/polymer-dev
  log "INSTALLING" "node modules"
  npm --silent install
  if $TEST; then
    log "TESTING" "polymer"
    grunt test
    if [ $? -ne 0 ]; then
      die "polymer FAILED TESTING"
    fi
  fi
  log "BUILDING" "polymer"
  grunt

  # version number on build file
  mv build/{build.log,polymer.js{,.map}} ../polymer/
  ok
  popd >/dev/null
}

release() {
  mkdir -p polymer-$VERSION
  pushd polymer-$VERSION >/dev/null
  load
  if $PUSHTAGS; then
    push_tags
  else
    if $BUILD; then
      build
    fi
    if $TAG; then
      tag_repos
    fi
    gen_changelog
  fi
  popd >/dev/null
}

release
