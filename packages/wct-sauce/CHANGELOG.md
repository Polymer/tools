# Changelog

<!-- ## Unreleased -->

## 2.0.1 - 2018-04-27

- Update dependency on `request` to lastest version due to reported security vulnerability in earlier version.

## 2.0.0 - 2018-01-09

- Remove hardcoded Sauce Connect version

## 2.0.0-pre.4 - 2018-01-09

- Removed the Linux Chrome 'dev' version browser, which is not a thing that Sauce does.

## 2.0.0-pre.3 - 2017-11-27

- Added Edge 15 to Travis browser list.
- Added Safari 11 to default and Travis browser lists.

## 2.0.0-pre.2 - 2017-11-16

- Update to cleankill@^2.0.0

## 2.0.0-pre.1

- Updated default browsers list:

  - Added Edge 14 and Safari 10
  - Removed Safari 8, 9 and IE 10

  See default-sauce-browser.json for the current list.

- Added SKIP_WCT_SAUCE_POSTINSTALL_DOWNLOAD environment variable to skip
downloading the sauce connect binary at install time.
