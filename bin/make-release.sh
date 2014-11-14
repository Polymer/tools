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

# Windows autocloses shell when complete, use `read` to wait for user input
WINDOWS=0
if [[ $OS = "Windows_NT" ]]; then
  WINDOWS=1
fi

# Pull only the "regular" set, "all" with -a
ALL=false

# Only pull new versions with -p flag
PULL=false

# If -t flag is given, actually push the tags
PUSHTAGS=false

# Must give a version number with -v
VERSION=

# Must give a semver range with -r
RANGE=

# Make new tags, override with -n
TAG=true

# directory for tools/bin scripts
PA_PREFIX="$PWD/${0%[/\\]*}"

# node script for mucking with package json
VERSIONSCRIPT="$PA_PREFIX/set-version.js"

while getopts ":abfnptv:r:" opt; do
  case $opt in
    a)
      ALL=true
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
    r)
      RANGE="$OPTARG"
      ;;
    :)
      die "Option -$OPTARG requires an argument";
  esac
done

# repos that fail to clone will be put here
FAILED=()

# default branch of clones
DEFAULT_BRANCH="master"


log() {
  echo -e "\033[1;34m===== $1 \033[1;37m$2 \033[1;34m=====\033[0m"
}

ok() {
  echo -e "\033[1;32mOK\033[0m"
}

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

pull() {
  node $PA_PREFIX/node_modules/.bin/bigstraw -s -b master ${PA_PREFIX}/../repo-configs/{core,polymer,paper}.json
  if $ALL; then
    node $PA_PREFIX/node_modules/.bin/bigstraw -s -b master ${PA_PREFIX}/../repo-configs/{labs,misc}.json
  fi
}

version() {
  if [ -e "bower.json" ]; then
    node $VERSIONSCRIPT "$PWD/bower.json" "$VERSION" "$RANGE"
  fi
}

tag_repos() {
  FAILED=()
  for REPO in "${REPOLIST[@]}"; do
    if [ $REPO = "components/polymer" -o $REPO = "components/webcomponentsjs" -o $REPO = "components/web-component-tester" ]
    then
      continue
    fi
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

  # abort on missing version number
  # TODO(dfreed): read the version out of polymer and bump it up one?
  if [[ -z "$VERSION" ]]; then
    echo "Need a version number!"
    exit 1
  fi

  # abort on missing dependency range
  if [[ -z "$RANGE" ]]; then
    echo "Need a semver range!"
    exit 1
  fi

  # build platform
  pushd components/webcomponentsjs
  log "INSTALLING" "node modules"
  npm --silent install
  log "BUILDING" "webcomponentsjs"
  gulp release
  ok

  log "PREPARING" "webcomponentjs"
  if git tag -l | grep -q $VERSION; then
    git tag -d $VERSION
  fi
  local lasttag=`git tag -l | sort -t. -k1,1n -k2,2n -k3,3n | tail -n 1`
  git checkout ${lasttag}
  git merge -s ours master --no-commit
  rm -rf node_modules
  find . -maxdepth 1 -not -name "dist" -not -name ".git" -delete
  mv dist/* .
  rmdir dist
  version
  git add -A

  git ci -m "release $VERSION"
  git tag -f "$VERSION"

  ok
  popd >/dev/null

  # build polymer
  pushd components/polymer
  log "INSTALLING" "node modules"
  npm --silent install
  log "BUILDING" "polymer"
  grunt release
  ok

  log "PREPARING" "polymer"
  if git tag -l | grep -q $VERSION; then
    git tag -d $VERSION
  fi
  local lasttag=`git tag -l | sort -t. -k1,1n -k2,2n -k3,3n | tail -n 1`
  git checkout ${lasttag}
  git merge -s ours master --no-commit
  rm -rf node_modules
  find . -maxdepth 1 -not -name "dist" -not -name ".git" -delete
  mv dist/* .
  rmdir dist
  git show master:dist/polymer.html > polymer.html
  rm polymer-versioned.js
  version
  git add -A

  git ci -m "release $VERSION"
  git tag -f "$VERSION"

  ok
  popd >/dev/null
}

release() {
  mkdir -p polymer-$VERSION
  pushd polymer-$VERSION >/dev/null
  if $PULL; then
    pull
  fi
  REPOLIST=(components/* projects/*)
  if $PUSHTAGS; then
    push_tags
  else
    build
    if $TAG; then
      tag_repos
    fi
    gen_changelog
  fi
  popd >/dev/null
}

release
