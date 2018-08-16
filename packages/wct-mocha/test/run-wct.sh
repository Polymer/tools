#!/usr/bin/env bash

if [ "$WCT_SAUCE" = "true" ]; then
  npx wct --npm --wct-package-name wct-mocha --plugin sauce
else
  npx wct --npm --wct-package-name wct-mocha --plugin local
fi