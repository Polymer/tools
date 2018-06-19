#!/usr/bin/env bash

if [ "$WCT_SAUCE" = "true" ]; then
  npx wct --plugin local --plugin sauce
else
  npx wct --plugin local
fi
