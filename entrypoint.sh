#!/bin/sh
# Fix ownership of the uploads volume (mounted by Railway as root)
if [ -d /data/uploads ]; then
  chown -R nextjs:nodejs /data/uploads 2>/dev/null || true
fi

# Switch to nextjs user and start the server
exec su -s /bin/sh nextjs -c "NODE_OPTIONS='--max-old-space-size=2048' node server.js"
