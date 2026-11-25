/* Up & Down the River — score keeper
 * Plain JavaScript, no build step. The game is saved in localStorage,
 * so a page refresh (or closing the tab) does not lose the scores.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'up-down-river:game:v1';
  var MIN_CARDS = 3;
  var MAX_CARDS = 7;
  var DECK_SIZE = 52;

  // ---------------------------------------------------------------------------
  // Game rules
  // ---------------------------------------------------------------------------

  /** Card counts for each round: up the river, the top three times, back down.
   *  buildRounds(5) -> [1,2,3,4,5,5,5,4,3,2,1] */
  function buildRounds(maxCards) {
    var up = [];
    for (var i = 1; i <= maxCards; i++) up.push(i);
    var down = up.slice(0, -1).reverse();
    return up.concat([maxCards, maxCards], down);
  }

  /** The middle hand of the river (the 2nd of the three top hands) is played with no trump. */
  function noTrumpIndex(maxCards) { return maxCards; }

  /** Making your bid exactly = 10 + tricks. Otherwise = tricks. */
  function scoreHand(bid, tricks) {
    if (bid === null || tricks === null) return null;
    return bid === tricks ? 10 + tricks : tricks;
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  var state = loadGame(); // null when no game is in progress
  var setup = { maxCards: 5, names: ['', '', ''] };

  function newGameState(maxCards, names) {
    var rounds = buildRounds(maxCards);
    function blank() { return rounds.map(function () { return names.map(function () { return null; }); }); }
    return {
      maxCards: maxCards, players: names, rounds: rounds, bids: blank(), tricks: blank(),
      // Player 1 (index 0) is always the score keeper; the first dealer is picked at random
      firstDealer: Math.floor(Math.random() * names.length)
    };
  }

  function saveGame() {
    try {
      if (state) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      else localStorage.removeItem(STORAGE_KEY);
    } catch (e) { /* storage unavailable — game still works for this session */ }
  }

  function loadGame() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var g = JSON.parse(raw);
      if (!g || !Array.isArray(g.players) || !Array.isArray(g.rounds)) return null;
      return g;
    } catch (e) { return null; }
  }

  /** A hand is complete when every trick count is in and they add up to the cards dealt. */
  function handComplete(r) {
    return state.tricks[r].every(function (t) { return t !== null; }) &&
           sum(state.tricks[r]) === state.rounds[r];
  }

  /** The first hand that isn't complete. Equals rounds.length when the game is over. */
  function currentRound() {
    for (var r = 0; r < state.rounds.length; r++) {
      if (!handComplete(r)) return r;
    }
    return state.rounds.length;
  }

  function allBidsIn(r) {
    return state.bids[r].every(function (b) { return b !== null; });
  }

  function sum(arr) {
    return arr.reduce(function (a, v) { return a + (v || 0); }, 0);
  }

  /** Dealer rotates one seat each hand, starting from the randomly chosen first dealer. */
  function dealerFor(r) {
    var n = state.players.length;
    var first = typeof state.firstDealer === 'number' ? state.firstDealer : n - 1; // older saved games
    return (first + r) % n;
  }

  /** Seats in bidding/play order for hand r: starts left of the dealer, goes around the table. */
  function playOrder(r) {
    var n = state.players.length;
    var d = dealerFor(r);
    var order = [];
    for (var i = 1; i <= n; i++) order.push((d + i) % n);
    return order;
  }

  /** Per player: array of {pts, cum} for each round, plus the total. */
  function computeScores() {
    return state.players.map(function (_, p) {
      var cum = 0;
      var cells = state.rounds.map(function (_, r) {
        // Only score a hand once its tricks add up, otherwise the points would be wrong
        var pts = handComplete(r) ? scoreHand(state.bids[r][p], state.tricks[r][p]) : null;
        if (pts !== null) cum += pts;
        return { pts: pts, cum: pts === null ? null : cum, made: pts !== null && state.bids[r][p] === state.tricks[r][p] };
      });
      return { cells: cells, total: cum };
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function $(id) { return document.getElementById(id); }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else node.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) {
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function show(view) {
    $('setupView').hidden = view !== 'setup';
    $('gameView').hidden = view !== 'game';
    $('newGameBtn').hidden = view !== 'game';
  }

  // ---------------------------------------------------------------------------
  // Setup screen
  // ---------------------------------------------------------------------------

  function renderSetup() {
    var picker = $('maxCardsPicker');
    picker.innerHTML = '';
    for (var n = MIN_CARDS; n <= MAX_CARDS; n++) {
      (function (n) {
        var b = el('button', { type: 'button', role: 'radio', 'aria-checked': String(setup.maxCards === n), text: String(n) });
        b.addEventListener('click', function () { setup.maxCards = n; renderSetup(); });
        picker.appendChild(b);
      })(n);
    }

    var seq = buildRounds(setup.maxCards);
    $('sequencePreview').innerHTML =
      '<b>' + seq.length + ' hands:</b> ' +
      seq.map(function (c, i) { return i === noTrumpIndex(setup.maxCards) ? '<span class="nt-mark" title="No trump">' + c + '★</span>' : c; }).join(' · ') +
      '<br><span class="nt-mark">★</span> Middle hand: no trump';

    renderPlayerList();
    validateSetup();
  }

  function renderPlayerList(focusIndex) {
    var list = $('playerList');
    list.innerHTML = '';
    setup.names.forEach(function (name, i) {
      var label = i === 0 ? 'Player 1 (score keeper)' : 'Player ' + (i + 1);
      var input = el('input', { type: 'text', placeholder: label, 'aria-label': label + ' name', maxlength: '24', autocomplete: 'off' });
      input.value = name;
      input.addEventListener('input', function () { setup.names[i] = input.value; validateSetup(); });
      input.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (i === setup.names.length - 1) addPlayer();
        else list.querySelectorAll('input')[i + 1].focus();
      });

      var remove = el('button', { type: 'button', class: 'btn btn-ghost', 'aria-label': 'Remove player ' + (i + 1), text: '✕' });
      remove.disabled = setup.names.length <= 2;
      remove.addEventListener('click', function () {
        setup.names.splice(i, 1);
        renderPlayerList();
        validateSetup();
      });

      list.appendChild(el('li', null, [el('div', { class: 'player-row' }, [input, remove])]));
    });
    if (focusIndex !== undefined) list.querySelectorAll('input')[focusIndex].focus();
  }

  function addPlayer() {
    setup.names.push('');
    renderPlayerList(setup.names.length - 1);
    validateSetup();
  }

  function cleanedNames() {
    return setup.names.map(function (n, i) { return n.trim() || 'Player ' + (i + 1); });
  }

  function validateSetup() {
    var warn = $('setupWarning');
    var names = cleanedNames();
    var messages = [];

    var seen = {};
    names.forEach(function (n) {
      var k = n.toLowerCase();
      if (seen[k]) messages.push('Two players are named "' + n + '". Give each player a different name.');
      seen[k] = true;
    });
    if (names.length * setup.maxCards > DECK_SIZE) {
      messages.push(names.length + ' players × ' + setup.maxCards + ' cards needs ' +
        names.length * setup.maxCards + ' cards, more than one 52-card deck. You can still play with a second deck.');
    }

    warn.hidden = messages.length === 0;
    warn.textContent = messages.join(' ');
    $('startBtn').disabled = names.length < 2 || Object.keys(seen).length !== names.length;
  }

  function startGame() {
    state = newGameState(setup.maxCards, cleanedNames());
    saveGame();
    renderGame();
    focusFirstBidder(0); // ready for the first bid
  }

  // ---------------------------------------------------------------------------
  // Game screen
  // ---------------------------------------------------------------------------

  function renderGame() {
    show('game');
    $('confirmBox').hidden = true;
    buildTable();
    refresh();
  }

  /** Builds the table once. refresh() then updates numbers and highlights
   *  without rebuilding the inputs, so typing never loses focus. */
  function buildTable() {
    var table = $('scoreTable');
    table.innerHTML = '';

    // Header: one column per round showing how many cards are dealt
    var headRow = el('tr', null, [el('th', { class: 'name-col', scope: 'col', text: 'Player' })]);
    state.rounds.forEach(function (cards, r) {
      var th = el('th', { scope: 'col', 'data-round': r }, [
        'Hand ' + (r + 1),
        el('span', { class: 'cards', text: cards + (cards === 1 ? ' card' : ' cards') })
      ]);
      if (r === noTrumpIndex(state.maxCards)) {
        th.classList.add('no-trump');
        th.appendChild(el('span', { class: 'nt-label', text: '★ No trump' }));
      }
      headRow.appendChild(th);
    });
    headRow.appendChild(el('th', { class: 'total-col', scope: 'col', text: 'Total' }));
    table.appendChild(el('thead', null, [headRow]));

    // Body: one row per player, bid + tricks inputs in every round cell
    var tbody = el('tbody');
    state.players.forEach(function (name, p) {
      var tr = el('tr', { 'data-player': p });
      tr.appendChild(el('th', { class: 'name-col', scope: 'row', title: name }, [
        el('span', { text: name }),
        p === 0 ? el('span', { class: 'chip chip-sk', text: '✎', title: 'Score keeper' }) : '',
        el('span', { class: 'chip dealer-chip', text: 'D', title: 'Dealer this hand', hidden: '' }),
        el('span', { class: 'chip first-chip', text: '1st', title: 'Bids first this hand', hidden: '' })
      ]));

      state.rounds.forEach(function (cards, r) {
        var bid = numberInput('bid', r, p, cards, 'Bid');
        var tricks = numberInput('tricks', r, p, cards, 'Tricks');
        var cell = el('div', { class: 'cell' }, [
          bid, tricks,
          el('div', { class: 'pts' }),
          el('div', { class: 'cum' })
        ]);
        tr.appendChild(el('td', { class: 'round-cell' + (r === noTrumpIndex(state.maxCards) ? ' no-trump' : ''), 'data-round': r }, [cell]));
      });

      tr.appendChild(el('td', { class: 'total-col' }));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    // Footer: bid and trick totals per hand, to catch entry mistakes
    var bidRow = el('tr', null, [el('th', { class: 'name-col', scope: 'row', text: 'Bids total' })]);
    var trickRow = el('tr', null, [el('th', { class: 'name-col', scope: 'row', text: 'Tricks total' })]);
    state.rounds.forEach(function (_, r) {
      var nt = r === noTrumpIndex(state.maxCards) ? ' no-trump' : '';
      bidRow.appendChild(el('td', { 'data-round': r, class: 'bid-sum' + nt }));
      trickRow.appendChild(el('td', { 'data-round': r, class: 'trick-sum' + nt }));
    });
    bidRow.appendChild(el('td', { class: 'total-col' }));
    trickRow.appendChild(el('td', { class: 'total-col' }));
    table.appendChild(el('tfoot', null, [bidRow, trickRow]));
  }

  function numberInput(kind, r, p, cards, label) {
    var input = el('input', {
      type: 'number', inputmode: 'numeric', min: '0', max: String(cards), step: '1',
      class: kind, 'data-round': r, 'data-player': p,
      placeholder: kind === 'bid' ? 'B' : 'T',
      'aria-label': label + ', ' + state.players[p] + ', hand ' + (r + 1)
    });
    var stored = state[kind === 'bid' ? 'bids' : 'tricks'][r][p];
    if (stored !== null) input.value = stored;

    input.addEventListener('input', function () {
      var raw = input.value.trim();
      var n = raw === '' ? null : Number(raw);
      var err = '';
      if (n !== null && !(Number.isInteger(n) && n >= 0 && n <= cards)) {
        err = 'Hand ' + (r + 1) + ' only deals ' + cards + (cards === 1 ? ' card' : ' cards') +
              ', so bids and tricks must be 0 to ' + cards + '.';
      } else if (n !== null && kind === 'tricks') {
        // Everyone else's tricks in this hand, plus this one, can't be more than the cards dealt
        var others = sum(state.tricks[r].filter(function (_, i) { return i !== p; }));
        if (others + n > cards) {
          var left = cards - others;
          err = 'Hand ' + (r + 1) + ' only has ' + cards + (cards === 1 ? ' trick' : ' tricks') + ' in total. ' +
                state.players[p] + ' can have at most ' + left + ' (' + others + ' already given to other players).';
        }
      }
      var valid = !err;
      input.classList.toggle('invalid', !valid);
      input.title = err;
      input.dataset.err = err;
      var before = currentRound();
      state[kind === 'bid' ? 'bids' : 'tricks'][r][p] = valid ? n : null;
      saveGame();
      refresh();
      // This entry finished the hand in play: jump to the next hand's first bidder
      // (the player after the dealer). Fixing an older hand doesn't move the cursor.
      if (kind === 'tricks' && before === r && currentRound() > r) focusFirstBidder(currentRound());
    });

    // Typing replaces what's in the box
    input.addEventListener('focus', function () { input.select(); });

    // Enter / Tab follow seating order starting left of the dealer: every bid, then every
    // trick count, then on to the next hand's first bidder. Shift+Enter / Shift+Tab go back.
    input.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== 'Tab') return;
      // Cursor just jumped here after the last trick count of the previous hand; a habitual
      // Enter press would otherwise skip past the first bidder.
      if (e.key === 'Enter' && input.dataset.autoFocused && input.value === '') {
        e.preventDefault();
        delete input.dataset.autoFocused;
        return;
      }
      delete input.dataset.autoFocused;
      if (moveFocus(kind, r, p, e.shiftKey ? -1 : 1)) e.preventDefault();
    });
    return input;
  }

  function focusFirstBidder(r) {
    if (r >= state.rounds.length) return; // game over
    var target = document.querySelector('input.bid[data-round="' + r + '"][data-player="' + playOrder(r)[0] + '"]');
    if (!target) return;
    target.dataset.autoFocused = '1';
    target.focus();
    target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }

  function moveFocus(kind, r, p, step) {
    var n = state.players.length;
    var idx = r * 2 * n + (kind === 'tricks' ? n : 0) + playOrder(r).indexOf(p) + step;
    if (idx < 0 || idx >= state.rounds.length * 2 * n) return false; // let Tab leave the table
    var nr = Math.floor(idx / (2 * n));
    var rest = idx % (2 * n);
    var nk = rest < n ? 'bid' : 'tricks';
    var np = playOrder(nr)[rest % n];
    var target = document.querySelector('input.' + nk + '[data-round="' + nr + '"][data-player="' + np + '"]');
    if (!target) return false;
    target.focus();
    target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    return true;
  }

  function refresh() {
    var scores = computeScores();
    var cur = currentRound();
    var finished = cur >= state.rounds.length;

    // Round cells
    state.players.forEach(function (_, p) {
      var row = document.querySelector('tr[data-player="' + p + '"]');
      scores[p].cells.forEach(function (c, r) {
        var td = row.querySelector('td[data-round="' + r + '"]');
        td.querySelector('.pts').textContent = c.pts === null ? '' : c.pts;
        td.querySelector('.cum').textContent = c.cum === null ? '' : c.cum;
        td.classList.toggle('made', c.pts !== null && c.made);
        td.classList.toggle('missed', c.pts !== null && !c.made);
        var hasError = !!td.querySelector('input.invalid');
        td.classList.toggle('has-error', hasError);
        if (hasError) {
          var tooMany = /in total/.test(td.querySelector('input.invalid').dataset.err || '');
          td.querySelector('.cum').textContent = tooMany ? 'too many' : '0–' + state.rounds[r] + ' only';
        }
      });
      row.querySelector('.total-col').textContent = scores[p].total;
      // Dealer marker for the hand in play
      row.querySelector('.dealer-chip').hidden = finished || dealerFor(cur) !== p;
      row.querySelector('.first-chip').hidden = finished || playOrder(cur)[0] !== p;
    });

    // Leader highlight
    var best = Math.max.apply(null, scores.map(function (s) { return s.total; }));
    var anyScored = scores.some(function (s) { return s.total > 0; });
    state.players.forEach(function (_, p) {
      document.querySelector('tr[data-player="' + p + '"]').classList.toggle('leader', anyScored && scores[p].total === best);
    });

    // Column highlight + footer sums
    document.querySelectorAll('#scoreTable [data-round]').forEach(function (node) {
      if (node.tagName === 'INPUT') return;
      var r = Number(node.getAttribute('data-round'));
      node.classList.toggle('current', r === cur);
      node.classList.toggle('future', r > cur);
    });
    state.rounds.forEach(function (cards, r) {
      var bidsIn = state.bids[r].filter(function (b) { return b !== null; }).length;
      var tricksIn = state.tricks[r].filter(function (t) { return t !== null; }).length;
      var bidSum = document.querySelector('.bid-sum[data-round="' + r + '"]');
      var trickSum = document.querySelector('.trick-sum[data-round="' + r + '"]');
      var tSum = sum(state.tricks[r]);
      bidSum.textContent = bidsIn ? sum(state.bids[r]) + ' / ' + cards : '';
      trickSum.textContent = tricksIn ? tSum + ' / ' + cards : '';
      // Tricks taken in a hand must add up to the cards dealt
      trickSum.classList.toggle('off', tricksIn === state.players.length && tSum !== cards);
    });

    renderStatus(scores, cur, finished);
  }

  function renderStatus(scores, cur, finished) {
    var bar = $('statusBar');
    bar.innerHTML = '';
    bar.classList.toggle('done', finished);

    if (finished) {
      var best = Math.max.apply(null, scores.map(function (s) { return s.total; }));
      var winners = state.players.filter(function (_, p) { return scores[p].total === best; });
      bar.appendChild(el('span', { class: 'big', text: (winners.length > 1 ? 'Tie: ' + winners.join(' & ') : winners[0] + ' wins!') + ' (' + best + ' points)' }));
      bar.appendChild(el('span', { class: 'muted', text: 'Game over. You can still fix any number in the table.' }));
      return;
    }

    var cards = state.rounds[cur];
    var dealer = state.players[dealerFor(cur)];
    var firstBidder = state.players[playOrder(cur)[0]];
    bar.appendChild(el('span', { class: 'big', text: 'Hand ' + (cur + 1) + ' of ' + state.rounds.length + ': ' + cards + (cards === 1 ? ' card' : ' cards') }));
    if (cur === noTrumpIndex(state.maxCards)) {
      bar.appendChild(el('span', { class: 'nt-badge', text: '★ No trump this hand' }));
    }
    bar.appendChild(el('span', { class: 'muted', text: 'Dealer: ' + dealer + ' · ' + firstBidder + ' bids first' }));

    // Before any bids in hand 1, announce the random dealer and allow changing it
    var untouched = state.bids[0].every(function (b) { return b === null; }) &&
                    state.tricks[0].every(function (t) { return t === null; });
    if (cur === 0 && untouched) {
      var select = el('select', { 'aria-label': 'First dealer' });
      state.players.forEach(function (name, p) {
        var opt = el('option', { value: String(p), text: name });
        if (p === dealerFor(0)) opt.selected = true;
        select.appendChild(opt);
      });
      select.addEventListener('change', function () {
        state.firstDealer = Number(select.value);
        saveGame();
        refresh();
      });
      var reroll = el('button', { type: 'button', class: 'btn btn-ghost', text: '🎲 Pick again' });
      reroll.addEventListener('click', function () {
        state.firstDealer = Math.floor(Math.random() * state.players.length);
        saveGame();
        refresh();
      });
      bar.appendChild(el('div', { class: 'dealer-pick' }, [
        el('span', { text: 'Randomly picked to deal first:' }), select, reroll
      ]));
    }

    if (!allBidsIn(cur)) {
      bar.appendChild(el('span', { class: 'phase', text: 'Bidding: enter each player’s bid (B)' }));
    } else {
      var bidTotal = sum(state.bids[cur]);
      bar.appendChild(el('span', { class: 'phase', text: 'Playing: enter tricks taken (T) when the hand ends' }));
      var diff = bidTotal - cards;
      bar.appendChild(el('span', { class: 'muted', text: 'Bids: ' + bidTotal + ' for ' + cards + (diff === 0 ? ' (even)' : diff > 0 ? ' (over by ' + diff + ')' : ' (under by ' + -diff + ')') }));

      var tricksIn = state.tricks[cur].filter(function (t) { return t !== null; }).length;
      var given = sum(state.tricks[cur]);
      if (tricksIn > 0 && tricksIn < state.players.length) {
        bar.appendChild(el('span', { class: 'muted', text: 'Tricks entered: ' + given + ' of ' + cards + ' (' + (cards - given) + ' left)' }));
      }
    }

    // Explain any rejected entry (too big for the hand, or more tricks than were dealt)
    var invalid = document.querySelector('#scoreTable input.invalid');
    if (invalid) {
      bar.appendChild(el('p', { class: 'warning', text: invalid.dataset.err + ' The red box was not saved.' }));
    }

    // All trick counts are in but they don't add up: the hand can't be scored yet
    if (state.tricks[cur].every(function (t) { return t !== null; }) && sum(state.tricks[cur]) !== cards) {
      bar.appendChild(el('p', { class: 'warning', text:
        'Hand ' + (cur + 1) + ': the tricks add up to ' + sum(state.tricks[cur]) + ' but ' + cards +
        (cards === 1 ? ' card was' : ' cards were') + ' dealt. Fix the trick counts. This hand isn’t scored until they add up.' }));
    }

    // Jump to the current hand's first bidder if nothing has focus
    if (!document.activeElement || document.activeElement === document.body) {
      var th = document.querySelector('#scoreTable thead th[data-round="' + cur + '"]');
      if (th) th.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
  }

  // ---------------------------------------------------------------------------
  // Wiring
  // ---------------------------------------------------------------------------

  $('addPlayerBtn').addEventListener('click', addPlayer);
  $('startBtn').addEventListener('click', startGame);
  $('newGameBtn').addEventListener('click', function () {
    $('confirmBox').hidden = false;
    $('confirmBox').scrollIntoView({ behavior: 'smooth' });
  });
  $('confirmNo').addEventListener('click', function () { $('confirmBox').hidden = true; });
  $('confirmYes').addEventListener('click', function () {
    // Keep the same players and river size as a starting point
    setup.maxCards = state.maxCards;
    setup.names = state.players.slice();
    state = null;
    saveGame();
    show('setup');
    renderSetup();
  });

  if (state) {
    renderGame();
  } else {
    show('setup');
    renderSetup();
  }

  // Exposed for quick checks in the browser console
  window.UDR = { buildRounds: buildRounds, scoreHand: scoreHand };
})();
