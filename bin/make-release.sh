#!/bin/bash

# ssh auth, easier to script
POLYMER_PATH="git@github.com:Polymer"

# import functions from pull-all, must be in same folder as make-release
. "`dirname $0`/pull-all.sh"

# If -f flag is given, actually push the tags
PUSHTAGS=false
while getopts ":fv:" opt; do
  case $opt in
    f)
      PUSHTAGS=true
      ;;
    v)
      BRANCH="$OPTARG"
      ;;
    :)
      die "Option -$OPTARG requires an argument";
  esac
done

# version number
## TODO(dfreedman): date stamped for now, follow polymer/package.json in the future
## make sure to update polymer/package.json to reflect this value
VERSION=`date "+v0.0.%Y%m%d"`

tag_repos() {
  FAILED=()
  for REPO in "${REPOS[@]}"; do
    # skip web animations repo
    if [ $REPO = 'web-animations-js' ]; then
      continue
    fi
    pushd $REPO >/dev/null
    log "TAGGING" "$REPO"
    git tag -f "$VERSION"
    popd >/dev/null
  done
  status_report "TAG"
}

push_tags() {
  FAILED=()
  for REPO in "${REPOS[@]}"; do
    # skip web animations repo
    if [ $REPO = 'web-animations-js' ]; then
      continue
    fi
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
  for REPO in ${REPOS[@]}; do
    # skip web animations repo
    if [ $REPO = 'web-animations-js' ]; then
      continue
    fi
    pushd $REPO >/dev/null
    # Changelog format: - commit message ([commit](commit url on github))
    PRETTY="- %s ([commit](https://github.com/Polymer/$REPO/commit/%h))"
    log "GEN CHANGELOG" "$REPO"
    # find slightly older tag, sorted alphabetically
    OLD_VERSION="`git tag -l | tail -n 2 | head -n 1`"
    if [[ -n $OLD_VERSION ]]; then
      echo "#### $REPO" >> "../changelog.md"
      git log $OLD_VERSION..$VERSION --pretty="$PRETTY" >> "../changelog.md"
      echo "" >> "../changelog.md"
    fi
    popd >/dev/null
  done
  ok
}

build() {
  # build platform
  pushd platform >/dev/null
  log "INSTALLING" "node modules"
  npm --silent install
  log "TESTING" "platform"
  grunt test
  if [ $? -ne 0 ]; then
    die "platform FAILED TESTING"
  fi
  grunt
  # version number on build file
  cp platform.min.js platform-${VERSION}.min.js
  cp platform.min.js.map platform-${VERSION}.min.js.map
  sed -i '' -e "s|\(//# sourceMappingURL=\)platform.min.js|\1platform-${VERSION}.min.js|" platform-${VERSION}.min.js
  mv platform{,-$VERSION}.min.js{,.map} ../
  ok
  popd >/dev/null

  # build polymer
  pushd polymer >/dev/null
  log "INSTALLING" "node modules"
  npm --silent install
  log "TESTING" "polymer"
  grunt test
  if [ $? -ne 0 ]; then
    die "polymer FAILED TESTING"
  fi
  log "BUILDING" "polymer"
  grunt
  # version number on build file
  cp polymer.min.js polymer-${VERSION}.min.js
  cp polymer.min.js.map polymer-${VERSION}.min.js.map
  sed -i '' -e "s|\(//# sourceMappingURL=\)polymer.min.js|\1polymer-${VERSION}.min.js|" polymer-${VERSION}.min.js
  mv build.log polymer{,-$VERSION}.min.js{,.map} ../
  ok
  popd >/dev/null
}

package() {
  log "ZIPPING" "ALL REPOS"
  rm -f polymer-all-$VERSION.zip
  zip -q -x "polymer-$VERSION/polymer/polymer.concat.js*" -x "*.git*" -x "*node_modules/*" -r polymer-all-$VERSION.zip polymer-$VERSION
  ok
}

release() {
  mkdir -p polymer-$VERSION
  pushd polymer-$VERSION >/dev/null
  if $PUSHTAGS; then
    push_tags
    popd >/dev/null
  else
    sync_repos
    build
    tag_repos
    gen_changelog
    popd >/dev/null
    package
  fi
}

release
