function getTimeString(seconds) {
    let date = new Date(0);
    date.setSeconds(seconds);
    return date.toISOString().substr(11, 8);
}

Vue.createApp({
        data() {
            return {
                //////////////////////
                //////////////////////
                //////////////////////
                startTS: 1622145578,//https://www.epochconverter.com/
                nick: 'bohdanz',
                year: '2021',
                month: '06',
                //////////////////////
                //////////////////////
                //////////////////////
                games: {
                    whiteCount: 0,
                    blackCount: 0,
                    win: 0,
                    count: 0,
                    draw: 0,
                    duration: 0,
                },
                lastGame: '',
                pgn: '',
                n: 0,
            };
        },
        mounted() {
            this.getGames();

            setInterval(() => {
                this.getGames();
            }, 1000);
        },
        computed: {
            gamesCount() {
                if (!this.games) {
                    return '-';
                }
                return this.games.length;
            }
        },
        methods: {
            getGames() {
                this.n++;
                const localN = this.n;
                axios
                    .get(`https://api.chess.com/pub/player/${this.nick}/games/${this.year}/${this.month}`)
                    .then(response => {
                        console.log('get');
                        if (localN !== this.n) {
                            console.log('n');

                            return;
                        }

                        const games = response.data.games;
                        this.games = games.filter((g) => {
                            return g.end_time > this.startTS;
                        }).filter((g) => {
                            return g.time_class === 'blitz';
                        }).reduce((acc, g) => {
                            acc.count += 1;
                            if (g.white.result === g.black.result) {
                                acc.draw += 1;
                            }
                            if (g.white.username === this.nick) {
                                acc.win += (g.white.result === 'win') ? 1 : 0;
                            }
                            if (g.black.username === this.nick) {
                                acc.win += (g.black.result === 'win') ? 1 : 0;
                            }
                            acc.whiteCount += (g.white.username === this.nick) ? 1 : 0;
                            acc.blackCount += (g.black.username === this.nick) ? 1 : 0;
                            const pgn = pgnParser.parse(g.pgn);
                            const times = pgn[0].headers.reduce((acc, h) => {
                                if (h.name === 'UTCDate') {
                                    acc.tUTCDate = h.value;
                                }
                                if (h.name === 'UTCTime') {
                                    acc.tUTCTime = h.value;
                                }
                                if (h.name === 'EndDate') {
                                    acc.tEndDate = h.value;
                                }
                                if (h.name === 'EndTime') {
                                    acc.tEndTime = h.value;
                                }
                                return acc;
                            }, {
                                tUTCDate: '',
                                tUTCTime: '',
                                tEndDate: '',
                                tEndTime: '',
                            });
                            const tStart = new Date(times.tUTCDate + ' ' + times.tUTCTime);
                            const tEnd = new Date(times.tEndDate + ' ' + times.tEndTime);
                            acc.duration += Math.round(tEnd.getTime() / 1000) - Math.round(tStart.getTime() / 1000);
                            return acc;
                        }, {
                            whiteCount: 0,
                            blackCount: 0,
                            win: 0,
                            count: 0,
                            draw: 0,
                            duration: 0,
                        });
                        this.games.timeString = getTimeString(this.games.duration);
                        this.lastGame = response.data.games[response.data.games.length - 1];
                        this.pgn = pgnParser.parse(this.lastGame.pgn);
                    });
            },
        },
    }
).mount('#app');