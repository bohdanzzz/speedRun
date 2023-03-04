const DURATION_FOR_BAD_PGN = -1;
const DEFAULT_TIME_CLASS = "blitz";

const getFontSize = (length) => {
  if (length >= 11) {
    return 8;
  }
  if (length >= 13) {
    return 7;
  }
  if (length >= 14) {
    return 6;
  }
  if (length >= 16) {
    return 5;
  }

  return 9;
};

function getTimeString(secondsTotal) {
  var hours = Math.floor(secondsTotal / 3600);
  var minutes = Math.floor((secondsTotal - hours * 3600) / 60);
  var seconds = secondsTotal - hours * 3600 - minutes * 60;

  if (hours < 10) {
    hours = "0" + hours;
  }
  if (minutes < 10) {
    minutes = "0" + minutes;
  }
  if (seconds < 10) {
    seconds = "0" + seconds;
  }

  return hours + ":" + minutes + ":" + seconds;
}

const analyzeResponse = (
  gamesFromResponse,
  prevGames,
  startTS,
  nick,
  timeClass
) => {
  return gamesFromResponse
    .filter((g) => {
      return g.end_time > startTS;
    })
    .filter((g) => {
      return g.time_class === timeClass;
    })
    .reduce((acc, g) => {
      let rating;

      if (g.rules !== "chess"){
        return acc;
      }

      if (g.white.username.toLowerCase() === nick.toLowerCase()) {
        rating = g.white.rating;
        acc.win += g.white.result === "win" ? 1 : 0;
      } else if (g.black.username.toLowerCase() === nick.toLowerCase()) {
        rating = g.black.rating;
        acc.win += g.black.result === "win" ? 1 : 0;
      } else {
        return acc;
      }

      /*
                if (rating < 2000) {
                    debugger
                }
        */

      acc.count += 1;
      if (g.white.result === g.black.result) {
        acc.draw += 1;
      }

      const duration = getDurationFromPGN(g.pgn);

      if (duration === DURATION_FOR_BAD_PGN) {
        return acc;
      }

      acc.duration += duration;

      acc.graphData.push({ x: acc.duration, y: rating });

      return acc;
    }, prevGames);
};

const getDurationFromPGN = (pgnData) => {
  try {
    const pgn = pgnParser.parse(pgnData);

    const times = pgn[0].headers.reduce(
      (acc2, h) => {
        if (h.name === "UTCDate") {
          acc2.tUTCDate = h.value;
        }
        if (h.name === "UTCTime") {
          acc2.tUTCTime = h.value;
        }
        if (h.name === "EndDate") {
          acc2.tEndDate = h.value;
        }
        if (h.name === "EndTime") {
          acc2.tEndTime = h.value;
        }

        return acc2;
      },
      {
        tUTCDate: "",
        tUTCTime: "",
        tEndDate: "",
        tEndTime: "",
      }
    );

    const startDateString = times.tUTCDate + " " + times.tUTCTime;
    const tStart = new Date(startDateString.replaceAll(".", "-"));

    const endDateString = times.tEndDate + " " + times.tEndTime;
    const tEnd = new Date(endDateString.replaceAll(".", "-"));
    return (
      Math.round(tEnd.getTime() / 1000) - Math.round(tStart.getTime() / 1000)
    );
  } catch (e) {
    return DURATION_FOR_BAD_PGN;
  }
};

const parseOldGames = async (nick, startTS, timeClass) => {
  const now = new Date();
  let currentYear = now.getFullYear();
  let currentMonth = now.getMonth() + 1;
  if (currentMonth === 1) {
    currentYear -= 1;
    currentMonth = 12;
  } else {
    currentMonth -= 1;
  }

  const date = new Date(parseInt(startTS) * 1000);
  const startYear = date.getFullYear();
  const startMonth = date.getMonth() + 1;

  let year;
  let month;
  let prevGames = {
    win: 0,
    count: 0,
    draw: 0,
    duration: 0,
    graphData: [],
  };
  for (year = startYear; year <= currentYear; year += 1) {
    for (
      month = startYear === year ? startMonth : 1;
      month <= (year === currentYear ? currentMonth : 12);
      month += 1
    ) {
      let response;
      try {
        response = await axios.get(
          `https://api.chess.com/pub/player/${nick}/games/${year}/${
            month < 10 ? "0" + month : month
          }`
        );
      } catch (error) {
        throw new Error(
          `Can not fetch games data: ${year}.${month}; ${error.message}`
        );
      }

      prevGames = analyzeResponse(
        response.data.games,
        JSON.parse(JSON.stringify(prevGames)),
        startTS,
        nick,
        timeClass
      );
    }
  }

  return prevGames;
};

var chart = null;
let chartData = null;

new Vue({
  el: "#app",
  data: {
    nick: "",
    games: null,
    lastGame: "",
    pgn: "",
    showResult: false,

    startDateTime: new Date(),
    startTS: null,

    loading: true,

    prevGames: null,

    graphDataLengthOld: 0,

    timeClass: "blitz",

    resultText: "",

    resultTextFontSize: 10,
  },

  async mounted() {
    const searchParams = new URL(location.href).searchParams;
    const nick = searchParams.get("nick");
    if (nick) {
      this.nick = nick;

      const startTS = parseInt(searchParams.get("startTS"));
      if (startTS > 0) {
        this.startTS = parseInt(startTS);
      } else {
        this.startTS = parseInt(new Date().getTime() / 1000);
      }

      const timeClass = searchParams.get("timeClass");
      if (timeClass) {
        this.timeClass = timeClass;
      } else {
        this.timeClass = DEFAULT_TIME_CLASS;
      }

      this.showResult = true;
    }

    if (!this.showResult) {
      return;
    }

    this.prevGames = await parseOldGames(
      this.nick,
      this.startTS,
      this.timeClass
    );

    this.$nextTick(() => {
      this.doShowResult();
    });
  },

  computed: {
    href() {
      const currentLocation = new URL(location.href);

      return `${currentLocation.origin}${currentLocation.pathname}?nick=${
        this.nick
      }&startTS=${parseInt(new Date(this.startDateTime) / 1000)}&timeClass=${
        this.timeClass
      }`;
    },
  },

  methods: {
    doShowResult() {
      this.getGames();
    },

    getGames() {
      const now = new Date();
      const currentYear = now.getUTCFullYear();
      let currentMonth = now.getUTCMonth() + 1;
      currentMonth = currentMonth < 10 ? "0" + currentMonth : currentMonth;
      axios
        .get(
          `https://api.chess.com/pub/player/${this.nick}/games/${currentYear}/${currentMonth}`
        )
        .then((response) => {
          this.games = analyzeResponse(
            response.data.games,
            JSON.parse(JSON.stringify(this.prevGames)),
            this.startTS,
            this.nick,
            this.timeClass
          );

          const loss = this.games.count - this.games.win - this.games.draw;
          this.resultText =
            "+" + this.games.win + " -" + loss + " =" + this.games.draw;

          this.resultTextFontSize = getFontSize(this.resultText.length);

          this.games.timeString = getTimeString(this.games.duration);

          const data = () => {
            return [
              {
                values: this.games.graphData,
                key: "rating",
                color: "#ff0000",
              },
            ];
          };

          if (this.games.graphData.length > 0) {
            if (!chartData) {
              nv.addGraph(function () {
                chart = nv.models.lineChart().showLegend(false);

                chart.xAxis
                  .axisLabel("Time")
                  .tickFormat((d) => getTimeString(d));

                chart.yAxis.axisLabel("rating");

                chartData = d3.select("#chart svg").datum(data());
                chartData.transition().duration(500).call(chart);

                nv.utils.windowResize(chart.update);

                return chart;
              });
            } else {
              if (this.graphDataLengthOld === this.games.graphData.length) {
                return;
              }

              chartData.datum(data()).transition().duration(500).call(chart);
              nv.utils.windowResize(chart.update);
              this.graphDataLengthOld = this.games.graphData.length;
            }
          }
        })
        .finally(() => {
          this.loading = false;
          setTimeout(() => {
            this.getGames();
          }, 1000);
        });
    },
  },
});
