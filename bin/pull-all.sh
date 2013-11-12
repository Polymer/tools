#!/bin/bash

dir="${0%[/\\]*}"
bash $dir/pull-all-polymer.sh $@
bash $dir/pull-all-elements.sh $@
bash $dir/pull-all-projects.sh $@
