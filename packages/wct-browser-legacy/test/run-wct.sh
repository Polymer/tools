#!/usr/bin/env bash

if [ "$WCT_SAUCE" = "true" ]; then
  npx wct --npm --wct-package-name wct-browser-legacy --plugin sauce
else
  npx wct --npm --wct-package-name wct-browser-legacy --plugin local
fi
