# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## Unreleased

<!-- Add unreleased changes here. -->

## [v2.1.0] - 2018-01-12
- Update selenium-standalone to v6
- Update chalk to v2
- Remove overrides to selenium-standalone installation
- Add optional `browserArguments` setting to configuration
  - `browserArguments` is an object mapping browser name to an array of string arguments

## [v2.0.16] - 2017-11-16
- Update to cleankill@^2.0.0. This fixes an issue in WCT v6.4.0 where the tests would finish and the browsers would close, but the WCT process would not end. This was because the versions of cleankill diverged and so they used different event queues for handling cleanup.

## [v2.0.15] - 2017-05-09

- Update launchpad@v0.6.0


