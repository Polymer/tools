#!/bin/bash

# This script will check out all of the Polymer project's repositories
# Load repo configuration
. ../conf/repo_conf.sh

for REPO in ${POLYMER_REPOS[@]}; do
  if [ -d $REPO ]; then
    pull $REPO
  else
    clone $REPO "master"
  fi
done

if [[ ${#FAILED[@]} -gt 0 ]]; then
  err
else
  ok
fi
