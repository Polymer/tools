# polyserve

A simple web server for using bower components locally. `polyserve` serves
project files under `/components/{bower-name}/`. The local component defined in
`bower.json` is served from the current directory, other component are served
from `./bower_components/`.

## Installation

    npm install polyserve -g

## Usage

### Run `polyserve`

    cd my-element/
    polyserve

### Browse files

Navigate to `localhost:8080/components/my-element/demo.html`

### Options

  * `-c` <component-dir> The component directory to use. Defaults to reading from the Bower config (usually bower_components/)
  * `-n` Package name. Defaults to reading from bower.json
  * `-p` The TCP port to use for the web server
  * `-o` Opens your default browser to an initial page, e.g. "demo" or "index.html"
  * `-b <browsername>` use this browser instead of default (ex: 'Google Chrome Canary')
  * `-H <hostname>` use this hostname instead of localhost

## Run Tests

```
npm test
```
