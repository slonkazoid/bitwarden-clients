#!/bin/sh

ulimit -c 0
APP_PATH=$(dirname "$0")
$APP_PATH/bitwarden-app