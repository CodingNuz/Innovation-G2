#!/bin/zsh
# Run a command on the remote Mac over SSH with retries (the host rate-limits connections).
REMOTE=khang@100.107.98.17
OPTS=(-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null
      -o IdentitiesOnly=yes -o PreferredAuthentications=password
      -o NumberOfPasswordPrompts=1 -o ConnectTimeout=15 -o LogLevel=ERROR)

for attempt in {1..6}; do
  out=$(sshpass -p '1111' ssh "${OPTS[@]}" "$REMOTE" "$1" 2>&1)
  if [[ $? -eq 0 ]]; then
    print -r -- "$out"
    exit 0
  fi
  if [[ "$out" != *'Permission denied'* && "$out" != *'Too many authentication'* ]]; then
    print -r -- "$out"
    exit 1
  fi
  sleep 5
done
print -r -- "$out"
exit 1
