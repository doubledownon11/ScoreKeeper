# Up & Down the River: Score Keeper

A browser score sheet for the card game *Up & Down the River*. It's a static site (HTML, CSS and JavaScript only, no server or build step), so any static web host can serve it.

## How it works

**Setup**
- Choose the top of the river (3–7 cards). The hands go up to that number, play it three times, then come back down:
  - 5 → `1 2 3 4 5 5 5 4 3 2 1`
  - 7 → `1 2 3 4 5 6 7 7 7 6 5 4 3 2 1`
  - The middle hand (the second of the three top hands) is a **no trump** deal. Its column has a gold outline and a ★ No trump label, and the status bar says so while it's being played.
- Add any number of players. Player 1 is always the score keeper (✎). List the rest in seating order around the table.
- When the game starts, a random player is picked to deal first. Before any scores are entered you can change the dealer or pick again.

**During the game**
- Players are listed down the left and hands run across the top, like a bowling sheet. The total is in the last column.
- Each cell has two boxes:
  - **B** is the bid, entered at the start of the hand.
  - **T** is the tricks taken, entered at the end of the hand.
- Points are worked out automatically:
  - If a player makes their bid exactly, they get **10 + tricks**.
  - If they miss it, they get **tricks** only.
- Each cell shows that hand's points in large type and the running total in small type.
- The status bar shows the current hand, the dealer, and whether the bids are over or under. It warns you if the tricks in a hand don't add up to the cards dealt.
- Press **Enter** or **Tab** to follow the seating order, starting with the player left of the dealer (marked **1st**). It goes through every bid, then every trick count, then on to the next hand's first bidder. Rows wrap from the bottom back to the top. **Shift+Enter** or **Shift+Tab** goes back.
- When the last trick count of a hand is entered, the cursor jumps to the next hand's bid box for the player after the new dealer.
- Each hand only allows numbers from 0 up to the cards dealt. A number that's too big turns red, isn't scored, and comes with a note explaining why.
- The tricks in a hand can't add up to more than the cards dealt. A trick count that would go over is refused, and the note says how many that player can have at most.
- A hand is scored only when every trick count is in and they add up exactly to the cards dealt. Until then the hand stays current and the status bar says what's wrong.
- The game is saved in the browser, so refreshing the page doesn't lose it.

## Run it locally

Double-click `index.html` to open it in any browser.

## Put it on a website

- **Netlify Drop (fastest):** go to https://app.netlify.com/drop and drag this folder onto the page. You get a public URL right away.
- **GitHub Pages:** push this folder to a GitHub repo, then go to Settings → Pages → Deploy from branch → `main` / root.
- **Cloudflare Pages or Vercel:** connect the repo, with no build command and the output directory set to `/`.
