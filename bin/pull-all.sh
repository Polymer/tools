#!/bin/bash

# This script will check out all of the Polymer project's repositories
# Load repo configuration
. "`dirname $0`/../conf/repo_conf.sh"

# Synchronize repos
sync_repos
