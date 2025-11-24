class TournamentManager {
    constructor() {
        this.players = [];
        this.initEventListeners();
        this.rounds = [];
        this.currentRound = 0;
        this.pairHistory = new Set();
    }

    initEventListeners() {
        document.getElementById("addRow").addEventListener("click", () => {
            this.addPlayerRow();
            this.displayHalfByeSelection();
        });
        document.getElementById("cancelAll").addEventListener("click", () => this.resetTournament());
        document.getElementById("creaTurni").addEventListener("click", () => this.createTournament());
    }

    addPlayerRow() {
        const playerList = document.getElementById("playerList");
        const newRow = document.createElement("div");
        newRow.className = "playerRow";
        newRow.innerHTML = `
            <input type="text" placeholder="Player name" class="playerName">
            <input type="number" placeholder="Elo rating" class="playerElo">
        `;
        playerList.appendChild(newRow);
        this.displayHalfByeSelection();
    }

    resetTournament() {
        location.reload();
    }

    collectPlayersData() {
        const rows = document.querySelectorAll(".playerRow");
        const players = [];
        rows.forEach(row => {
            const name = row.querySelector(".playerName").value.trim();
            const elo = row.querySelector(".playerElo").value.trim();
            if (name && elo) {
                players.push({
                    name,
                    elo: Number(elo),
                    tournamentScore: 0,
                    tiebreakScore: 0,
                    receivedBye: false,
                    withdrawn: false,
                    halfByeNextRound: row.dataset.halfBye === "true",
                    colorHistory: []
                });
            }
        });
        return players;
    }

    sortPlayers(players) {
        return [...players].sort((a, b) => {
            if (b.tournamentScore !== a.tournamentScore) {
                return b.tournamentScore - a.tournamentScore;
            }
            if (b.tiebreakScore !== a.tiebreakScore) {
                return b.tiebreakScore - a.tiebreakScore;
            }
            return b.elo - a.elo;
        });
    }

    generateRounds(players) {
        const activePlayers = players.filter(p => !p.withdrawn);
        const halfByePlayers = activePlayers.filter(p => p.halfByeNextRound);
        halfByePlayers.forEach(p => {
            p.tournamentScore += 0.5;
            p.halfByeNextRound = false;
        });
        let sorted = this.sortPlayers(activePlayers.filter(p => !halfByePlayers.includes(p)));
        const groups = this.groupByScore(sorted);
        const rounds = [];
        const unpaired = [];
        const byeCandidates = sorted.filter(p => !p.receivedBye);
        const totalPlayers = sorted.length;
        if (totalPlayers % 2 !== 0) {
            const byePlayer = byeCandidates[byeCandidates.length - 1];
            rounds.push({
                white: byePlayer,
                black: { name: "BYE", elo: 0 },
                result: "1-0"
            });
            byePlayer.tournamentScore += 1;
            byePlayer.receivedBye = true;
            sorted.splice(sorted.indexOf(byePlayer), 1);
        }
        const updatedGroups = this.groupByScore(sorted);
        for (let scoreGroup of updatedGroups) {
            let group = [...scoreGroup];
            if (group.length % 2 !== 0) {
                const floater = group.pop();
                unpaired.push(floater);
            }
            const half = group.length / 2;
            const topHalf = group.slice(0, half);
            const bottomHalf = group.slice(half);
            const alternateWhiteStartsWhite = Math.random() < 0.5;
            for (let i = 0; i < topHalf.length; i++) {
                const p1 = topHalf[i];
                let paired = false;
                for (let j = 0; j < bottomHalf.length; j++) {
                    const p2 = bottomHalf[j];
                    if (!this.hasBeenPaired(p1, p2)) {
                        this.recordPairing(p1, p2);
                        const whiteCount1 = p1.colorHistory.filter(c => c === 'white').length;
                        const blackCount1 = p1.colorHistory.filter(c => c === 'black').length;
                        const whiteCount2 = p2.colorHistory.filter(c => c === 'white').length;
                        const blackCount2 = p2.colorHistory.filter(c => c === 'black').length;
                        const prefersWhite1 = blackCount1 > whiteCount1;
                        const prefersWhite2 = blackCount2 > whiteCount2;
                        let white, black;
                        if (prefersWhite1 && !prefersWhite2) {
                            white = p1;
                            black = p2;
                        } else if (prefersWhite2 && !prefersWhite1) {
                            white = p2;
                            black = p1;
                        } else {
                            if (Math.random() < 0.5) {
                                white = p1;
                                black = p2;
                            } else {
                                white = p2;
                                black = p1;
                            }
                        }
                        white.colorHistory.push("white");
                        black.colorHistory.push("black");
                        rounds.push({
                            white,
                            black,
                            result: null
                        });
                        bottomHalf.splice(j, 1);
                        paired = true;
                        break;
                    }
                }
                if (!paired) {
                    unpaired.push(p1);
                }
            }
            unpaired.push(...bottomHalf);
        }
        while (unpaired.length >= 2) {
            const p1 = unpaired.shift();
            let paired = false;
            for (let i = 0; i < unpaired.length; i++) {
                const p2 = unpaired[i];
                if (!this.hasBeenPaired(p1, p2)) {
                    this.recordPairing(p1, p2);
                    rounds.push({
                        white: p1,
                        black: p2,
                        result: null
                    });
                    unpaired.splice(i, 1);
                    paired = true;
                    break;
                }
            }
            if (!paired) {
                unpaired.push(p1);
                break;
            }
        }
        return rounds;
    }

    groupByScore(players) {
        const groups = new Map();
        for (const player of players) {
            const key = player.tournamentScore;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(player);
        }
        return [...groups.entries()]
            .sort((a, b) => b[0] - a[0])
            .map(([score, group]) => group.sort((a, b) => b.elo - a.elo));
    }

    displayRanking(players) {
        const sorted = this.sortPlayers(players);
        const resultsDiv = document.getElementById("results");
        resultsDiv.innerHTML = "";
        const table = document.createElement("table");
        const headerRow = document.createElement("tr");
        headerRow.innerHTML = `
            <th>Position</th>
            <th>Name</th>
            <th>Elo</th>
            <th>Points</th>
            <th>Tiebreak</th>
        `;
        table.appendChild(headerRow);
        sorted.forEach((player, index) => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${index + 1}</td>
                <td><a href="#" class="playerLink" data-name="${player.name}">${player.name}</a></td>
                <td>${player.elo}</td>
                <td>${player.tournamentScore}</td>
                <td>${player.tiebreakScore}</td>
            `;
            table.appendChild(row);
        });
        resultsDiv.appendChild(table);
        document.querySelectorAll(".playerLink").forEach(link => {
            link.addEventListener("click", (e) => {
                e.preventDefault();
                const playerName = e.target.dataset.name;
                this.showPlayerDetails(playerName);
            });
        });
    }

    displayHalfByeSelection() {
        const resultsDiv = document.getElementById("results");
        let old = document.getElementById("halfByeContainer");
        if (old) old.remove();
        const container = document.createElement("div");
        container.id = "halfByeContainer";
        container.className = "halfByeSelector";
        const title = document.createElement("h3");
        title.textContent = "Half bye and withdrawals:";
        container.appendChild(title);
        if (this.players.length > 0) {
            this.players.forEach((player, index) => {
                const line = document.createElement("div");
                const checkboxBye = document.createElement("input");
                checkboxBye.type = "checkbox";
                checkboxBye.id = `halfBye-${index}`;
                checkboxBye.checked = !!player.halfByeNextRound;
                checkboxBye.addEventListener("change", (e) => {
                    player.halfByeNextRound = e.target.checked;
                });
                const labelBye = document.createElement("label");
                labelBye.htmlFor = checkboxBye.id;
                labelBye.textContent = `½ ${player.name}`;
                const checkboxWith = document.createElement("input");
                checkboxWith.type = "checkbox";
                checkboxWith.id = `withdrawn-${index}`;
                checkboxWith.checked = !!player.withdrawn;
                checkboxWith.addEventListener("change", (e) => {
                    player.withdrawn = e.target.checked;
                });
                const labelWith = document.createElement("label");
                labelWith.htmlFor = checkboxWith.id;
                labelWith.textContent = `Withdrawn`;
                line.appendChild(checkboxBye);
                line.appendChild(labelBye);
                line.appendChild(document.createTextNode(" "));
                line.appendChild(checkboxWith);
                line.appendChild(labelWith);
                container.appendChild(line);
            });
        } else {
            const rows = document.querySelectorAll(".playerRow");
            rows.forEach((row, index) => {
                const nameInput = row.querySelector(".playerName");
                const name = nameInput.value.trim();
                if (!name) return;
                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.id = `halfBye-${index}`;
                checkbox.checked = row.dataset.halfBye === "true";
                checkbox.addEventListener("change", (e) => {
                    row.dataset.halfBye = e.target.checked ? "true" : "false";
                });
                const label = document.createElement("label");
                label.htmlFor = checkbox.id;
                label.textContent = name;
                const line = document.createElement("div");
                line.appendChild(checkbox);
                line.appendChild(label);
                container.appendChild(line);
            });
        }
        resultsDiv.appendChild(container);
    }

    displayRounds(rounds) {
        const resultsDiv = document.getElementById("results");
        const header = document.createElement("h2");
        header.textContent = `Round ${this.currentRound + 1}`;
        resultsDiv.appendChild(header);
        const roundContainer = document.createElement("div");
        roundContainer.className = "roundContainer";
        rounds.forEach((match, index) => {
            const matchCard = document.createElement("div");
            matchCard.className = "matchCard";
            if (match.black.name === "BYE") {
                matchCard.classList.add("byeCard");
                matchCard.textContent = `${match.white.name} has a BYE`;
            } else {
                matchCard.innerHTML = `
                    <div class="playerRowMatch">
                        <span class="whitePlayer">${match.white.name}</span>
                        <span class="vsText">vs</span>
                        <span class="blackPlayer">${match.black.name}</span>
                    </div>
                    <select data-index="${index}" class="resultSelect">
                        <option value="">Result</option>
                        <option value="1-0">${match.white.name} wins</option>
                        <option value="0-1">${match.black.name} wins</option>
                        <option value="½-½">Draw</option>
                    </select>
                `;
            }
            roundContainer.appendChild(matchCard);
        });
        resultsDiv.appendChild(roundContainer);
        const oldButton = document.getElementById("nextRoundButton");
        if (oldButton) oldButton.remove();
        const nextBtn = document.createElement("button");
        nextBtn.id = "nextRoundButton";
        nextBtn.className = "next-round-button";
        nextBtn.textContent = "Create next round";
        nextBtn.addEventListener("click", () => this.nextRound());
        resultsDiv.appendChild(nextBtn);
    }

    createTournament() {
        this.players = this.collectPlayersData();
        if (this.players.length === 0) {
            alert("Please enter at least one player to create the tournament.");
            return;
        }
        this.rounds = [];
        this.currentRound = 0;
        this.displayRanking(this.players);
        this.displayHalfByeSelection();
        const round = this.generateRounds(this.players);
        this.rounds.push(round);
        this.displayRounds(round);
    }

    showPlayerDetails(name) {
        const player = this.players.find(p => p.name === name);
        if (!player) return;
        let html = `<h2>${player.name}</h2>`;
        html += `<p><strong>Elo:</strong> ${player.elo}</p>`;
        html += `<p><strong>Tournament points:</strong> ${player.tournamentScore}</p>`;
        html += `<p><strong>Buchholz:</strong> ${player.tiebreakScore}</p>`;
        html += `<h3>Matches:</h3>`;
        if (!player.opponents || player.opponents.length === 0) {
            html += `<p>No matches yet.</p>`;
        } else {
            html += `<ul>`;
            player.opponents.forEach((opp, index) => {
                const round = this.rounds
                    .flat()
                    .find(m => (m.white === player && m.black === opp) || (m.black === player && m.white === opp));
                const color = round.white === player ? "White" : "Black";
                const result = round.result || "Not yet played";
                html += `<li>${color} vs ${opp.name} — <strong>${result}</strong></li>`;
            });
            html += `</ul>`;
        }
        document.getElementById("playerDetails").innerHTML = html;
        document.getElementById("playerModal").classList.remove("hidden");
        document.getElementById("closeModal").onclick = () => {
            document.getElementById("playerModal").classList.add("hidden");
        };
    }

    processResults() {
        const selects = document.querySelectorAll("select[data-index]");
        const currentRound = this.rounds[this.currentRound];
        selects.forEach(select => {
            const i = Number(select.dataset.index);
            const result = select.value;
            currentRound[i].result = result;
            const match = currentRound[i];
            const white = match.white;
            const black = match.black;
            if (result === "1-0") {
                white.tournamentScore += 1;
            } else if (result === "0-1") {
                black.tournamentScore += 1;
            } else if (result === "½-½") {
                white.tournamentScore += 0.5;
                black.tournamentScore += 0.5;
            }
            this.players.forEach(player => {
                player.tiebreakScore = 0;
                if (!player.opponents) player.opponents = [];
                for (const opp of player.opponents) {
                    player.tiebreakScore += opp.tournamentScore;
                }
            });
        });
    }

    nextRound() {
        this.processResults();
        this.displayRanking(this.players);
        this.currentRound++;
        const newRound = this.generateRounds(this.players);
        this.rounds.push(newRound);
        this.displayRounds(newRound);
        this.displayHalfByeSelection();
    }

    getPairKey(player1, player2) {
        const names = [player1.name, player2.name].sort();
        return `${names[0]}|${names[1]}`;
    }

    hasBeenPaired(p1, p2) {
        return this.pairHistory.has(this.getPairKey(p1, p2));
    }

    recordPairing(p1, p2) {
        this.pairHistory.add(this.getPairKey(p1, p2));
        if (!p1.opponents) p1.opponents = [];
        if (!p2.opponents) p2.opponents = [];
        p1.opponents.push(p2);
        p2.opponents.push(p1);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const tm = new TournamentManager();
    tm.displayHalfByeSelection();
});
