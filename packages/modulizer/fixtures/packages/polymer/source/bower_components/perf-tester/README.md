# perf-tester
An element to help performance test other elements.

## How to use

The perf-tester element accepts an array of `tests` which are html files containing perf tests to run. A simple "runner.html" as is shown in `/demo` can be created to display output.

Each test file should load `perf.js` and call `console.perf()` to start the test and `console.perfEnd()` to finish it.

### Node script

Run the node-script with

    node node-perf-tester.js

The available options are:

    --runs Number of runs to measure on
    --targets The file location of a JSON-structured file with the following format:

            [
                ["<type>", "<url>"]
            ]

        where type is the name of the type you are testing and the url the location of the target under test

    --port The port number to connect the protocol to. Use this when you are connecting to a separate device. If this argument is not provided, chrome-headless is used.
    --throttling one of [FAST_3G, SLOW_3G] If not running in Chrome headless, you can enable throttling with one of the two options.
