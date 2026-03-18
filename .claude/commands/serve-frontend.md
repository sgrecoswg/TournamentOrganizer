Start the Angular dev server with API proxy.

1. Run `npx ng serve --proxy-config proxy.conf.json` in `tournament-client/` in the background
2. The frontend runs at http://localhost:4200 and proxies /api to http://localhost:5021
3. Tell the user the dev server is running
4. Remind them the API backend must also be running (`/run`)
