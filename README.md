# polyserve

[![Build Status](https://travis-ci.org/Polymer/polyserve.svg?branch=master)](https://travis-ci.org/Polymer/polyserve)

A simple development server for web projects.

`polyserve` serves project files from a URL root that allows relative URLs
that reach out of the project, like those starting with `../`, to work. This is
necessary for referencing other packages by path when stored as a flat directory
such as how Bower works.

The local package is served at the URL `/components/{bower-name}/`, with files
served from the current directory. Other packages are served at
`/components/{packageName}` with files served from their directory under
`./bower_components/`.

## Installation

    $ npm install polyserve -g

## Usage

### Run `polyserve`

    $ cd my-element/
    $ polyserve

### Browse files

Navigate to `localhost:8080/components/my-element/demo.html`

### Options

  * `-c` <component-dir> The component directory to use. Defaults to reading from the Bower config (usually bower_components/)
  * `-n` Package name. Defaults to reading from bower.json
  * `-p` The TCP port to use for the web server
  * `-o` Opens your default browser to an initial page, e.g. "demo" or "index.html"
  * `-b <browsername>` use this browser instead of default (ex: 'Google Chrome Canary')
  * `-H <hostname>` use this hostname instead of localhost
  * `-P <protocol>` The server protocol to use {`h2`, `https/1.1`, `http/1.1`}. **`h2` requires Node 5+.**
  * `-key <path>` Path to TLS certificate private key file for https. Defaults to "key.pem".
  * `-cert <path>` Path to TLS certificate file for https. Defaults to "cert.pem".
  * `-manifest <path>` Path to h2-push manifest

## Compiling from Source

    $ npm install
    $ npm run build

You can compile and run polyserve from source by cloning the repo from Github and then running `npm run build`. Make sure you have already run `npm install` before building.

### Run Tests

    $ npm test
