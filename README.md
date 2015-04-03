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

  * `-p` The TCP port to use for the web server
