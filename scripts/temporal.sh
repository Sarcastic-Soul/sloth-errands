#!/bin/sh
# Local Temporal server. State is kept in .sloth/temporal.db, so held chores survive a restart.
mkdir -p "$(dirname "$0")/../.sloth"
exec "${TEMPORAL_BIN:-$HOME/.temporalio/bin/temporal}" server start-dev --db-filename "$(dirname "$0")/../.sloth/temporal.db" --ui-port 8233
