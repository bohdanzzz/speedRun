function getTimeString(seconds) {
    let date = new Date(0);
    date.setSeconds(seconds);

    return date.toISOString().substr(11, 8);
}

new Vue({
    el: '#app',
    data: {
        nick: '',
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
        showResult: false,

        startDateTime: new Date(),
        startTS: null,

        loading: true,
    },

    mounted() {
        const searchParams = new URL(location.href).searchParams;
        const nick = searchParams.get('nick');
        if (nick) {
            this.nick = nick;

            const startTS = parseInt(searchParams.get('startTS'));
            if (startTS > 0) {
                this.startTS = parseInt(startTS);
            } else {
                const now = new Date();
                this.startTS = parseInt(now.getTime() / 1000);
            }

            this.showResult = true;
        }


        if (this.showResult) {
            this.doShowResult();
        }
    },

    computed: {
        gamesCount() {
            if (!this.games) {
                return '-';
            }

            return this.games.length;
        },

        year() {
            if (!this.startTS) {
                return '-'
            }

            const date = new Date(parseInt(this.startTS) * 1000);

            return date.getFullYear();
        },

        month() {
            if (!this.startTS) {
                return '-'
            }

            const date = new Date(parseInt(this.startTS) * 1000);

            const month = date.getMonth() + 1;

            if (month < 10) {
                return `0${month}`;
            }

            return month;
        },

        href() {
            const currentLocation = new URL(location.href);

            return `${currentLocation.origin}${currentLocation.pathname}?nick=${this.nick}&startTS=${parseInt(new Date(this.startDateTime) / 1000)}`;
        }
    },

    methods: {
        doShowResult() {
            this.getGames();
        },

        getGames() {
            axios
                .get(`https://api.chess.com/pub/player/${this.nick}/games/${this.year}/${this.month}`)
                .then(response => {
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
                        if (g.white.username.toLowerCase() === this.nick.toLowerCase()) {
                            acc.win += (g.white.result === 'win') ? 1 : 0;
                        }
                        if (g.black.username.toLowerCase() === this.nick.toLowerCase()) {
                            acc.win += (g.black.result === 'win') ? 1 : 0;
                        }
                        acc.whiteCount += (g.white.username.toLowerCase() === this.nick.toLowerCase()) ? 1 : 0;
                        acc.blackCount += (g.black.username.toLowerCase() === this.nick.toLowerCase()) ? 1 : 0;
                        const pgn = pgnParser.parse(g.pgn);
                        const times = pgn[0].headers.reduce((acc2, h) => {
                            if (h.name === 'UTCDate') {
                                acc2.tUTCDate = h.value;
                            }
                            if (h.name === 'UTCTime') {
                                acc2.tUTCTime = h.value;
                            }
                            if (h.name === 'EndDate') {
                                acc2.tEndDate = h.value;
                            }
                            if (h.name === 'EndTime') {
                                acc2.tEndTime = h.value;
                            }

                            return acc2;
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
                })
                .finally(() => {
                    this.loading = false;
                    setTimeout(() => {
                        this.getGames();
                    }, 1000);
                });
        },
    },
})
