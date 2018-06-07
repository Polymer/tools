#!/usr/bin/env bash

if [ -n "$WCT_SAUCE" ]; then
  npx wct --plugin local --plugin sauce
else
  npx wct --plugin local
fi
