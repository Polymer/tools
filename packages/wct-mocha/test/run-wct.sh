#!/usr/bin/env bash

if [ "$WCT_SAUCE" = "true" ]; then
  npx wct -- --plugin sauce
elif [ "$SKIP_LOCAL_BROWSERS" != "true" ]; then
  npx wct -- --plugin local
fi
