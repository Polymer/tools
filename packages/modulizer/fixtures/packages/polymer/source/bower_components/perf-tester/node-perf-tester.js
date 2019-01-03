const path = require('path');

const CDP = require('chrome-remote-interface');

const argv = require('minimist')(process.argv.slice(2));

const NUMBER_OF_RUNS = argv.runs || 100;

(async function() {
  let port = argv.port;
  let chrome;

  if (!argv.port) {
    const chromeLauncher = require('chrome-launcher');
    chrome = await chromeLauncher.launch({
      chromeFlags:
          ['--headless', '--disable-gpu', '--remote-debugging-address=0.0.0.0'],
      port: 0
    });
    port = chrome.port;
  }

  const tab = await CDP.New({port});
  const client = await CDP({tab, port});

  const {Page, Network, Runtime} = client;

  const ONE_MB = 1024 * 1024 / 8;
  const throttling = {
    FAST_3G: {
      downloadThroughput: 1.6 * ONE_MB * .9,
      uploadThroughput: .75 * ONE_MB * .9
    },
    SLOW_3G: {
      downloadThroughput: .5 * ONE_MB * .8,
      uploadThroughput: .5 * ONE_MB * .8
    }
  };

  await Promise.all([
    Page.enable(),
    Network.enable(),
    port && argv.throttling &&
        Network.emulateNetworkConditions(Object.assign(
            {}, throttling[argv.throttling], {offline: false, latency: 10})),
    Network.clearBrowserCache(),
    Network.setCacheDisabled({cacheDisabled: true}),
    Network.setBypassServiceWorker({bypass: true}),
  ]);

  let loadEventPromise;

  Page.loadEventFired(() => {
    loadEventPromise();
  });

  const options = require(path.join(process.cwd(), argv.targets));

  const perfTimings = {};
  for (const [type] of options) {
    perfTimings[type] = [];
  }

  process.on('exit', async () => {
    for (const [type, timings] of Object.entries(perfTimings)) {
      const average = timings.reduce((a, b) => a + b) / timings.length;
      console.log(
          `Average gain for ${type} in ${timings.length} runs is ${average}`);
    }

    await CDP.Close({port, id: tab.id});
    await client.close();
    if (!argv.port) {
      await chrome.kill();
    }
  });

  for (let i = 0; i < NUMBER_OF_RUNS; i++) {
    for (const [type, url] of options) {
      requestType = type;

      Page.navigate({url});

      await new Promise(resolve => {
        loadEventPromise = resolve;
      });
      const {result: {value: perfTiming}} =
          await Runtime.evaluate({expression: 'window.perfTiming'});
      // const {result: {value: perfTiming}} = await
      // Runtime.evaluate({expression: 'window.performance.timing.loadEventEnd-
      // window.performance.timing.navigationStart'});
      perfTimings[type].push(perfTiming);
    }
    process.stdout.write(`${i + 1}/${NUMBER_OF_RUNS}\r`);
  }

  process.exit(0);
})()