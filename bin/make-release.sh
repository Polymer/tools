#!/bin/bash
# import functions from pull-all, must be in same folder as make-release
. "`dirname $0`/pull-all.sh"

# version number
VERSION=`date "+v0.0.%Y%m%d"`

# ssh auth, easier to script
POLYMER_PATH="git@github.com:Polymer"

tag_repos() {
  FAILED=()
  for REPO in ${REPOS[@]}; do
    pushd $REPO
    log "TAGGING" "$REPO"
    git tag "$VERSION"
    if [ $? -ne 0 ]; then
      FAILED+=($REPO)
    fi
    # push only tags
    git push --tags
    popd
  done
  status_report "TAG"
}

gen_changelog() {
  touch "changelog.md"
  for REPO in ${REPOS[@]}; do
    # skip web animations repo
    if [ $REPO = 'web-animations-js' ]; then
      continue
    fi
    # format: - commit message ([commit](commit url on github))
    PRETTY="- %s ([commit](https://github.com/Polymer/$REPO/commit/%h))"
    pushd $REPO
    log "GEN CHANGELOG" "$REPO"
    echo "#### $REPO\n" >> "changelog.md"
    echo "`git log $OLD_VERSION..$VERSION --pretty=$PRETTY`" >> "changelog.md"
    popd
  done
  ok
}

build() {
  pushd polymer
  grunt test
  if [ $? -eq 0 ]; then
    # no version number on build file
    grunt
    # version number on build file
    grunt "version:$VERSION"
    ok
  else
    FAILED=(polymer)
    err "FAILED TO BUILD"
  fi
  popd
}

package() {
  # polymer build only
  zip -j -r polymer-build-$VERSION.zip polymer-$VERSION/{polymer/polymer,platform/platform}-$VERSION.min.js{,.map}
  polymer-$VERSION/polymer/{build.log,AUTHORS,PATENTS,LICENSE,CONTRIBUTING.md,README.md}
  # all repos build
  zip -x "*.git*" -r polymer-all-$VERSION.zip polymer-$VERSION
  ok
}

release() {
  mkdir polymer-$VERSION
  pushd polymer-$VERSION
  sync_repos
  tag_repos
  gen_changelog
  popd
  build
  package
}
