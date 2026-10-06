# Banana Quiz Challenge

Assignment 1 for CIS046-3 Software for Enterprise. A quiz game where the questions
come from the UoB Banana API (https://marcconrad.com/uob/banana/doc.php).

## Requirements

Node.js 18 or newer (built with Node 24). No npm packages needed.

## Run it

Two processes need to be running:

```
npm run start:leaderboard     # terminal 1 - leaderboard service on port 4000
npm run start                 # terminal 2 - game server on port 3000
```

Then open http://localhost:3000, register an account, log in and play.
