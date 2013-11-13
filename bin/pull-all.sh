#!/bin/bash

dir="${0%[/\\]*}"
! [ -d components ] && mkdir components
pushd components
bash ../$dir/pull-all-polymer.sh $@
bash ../$dir/pull-all-elements.sh $@
popd
! [ -d projects ] && mkdir projects
pushd projects
bash ../$dir/pull-all-projects.sh $@
popd
