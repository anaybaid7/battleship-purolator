// current match state, shared by the other files

const state = {
  sid: "",
  myName: "",
  oppName: "",
  pidx: -1,
  roomId: "",

  boardDim: DEFAULT_BOARD_DIM,
  ships: [],          // ship list from the server: { name, size }
  placed: [],         // my ships: { name, cells }
  myBoard: [],        // null | "ship" | "hit" | "miss"
  enemyBoard: [],     // null | "hit" | "miss"
  enemySunk: [],      // names of their ships I've sunk
  mySunk: [],         // names of my ships they've sunk

  selShip: null,
  orient: "H",
  myTurn: false,
  over: false,

  shots: 0,
  hits: 0,
  myResults: [],    // "hit"/"miss" for each of my shots, in order
  theirResults: [], // same for theirs
};

function resetMatchState(newShips, boardDim) {
  if (boardDim) state.boardDim = boardDim;
  const size = state.boardDim * state.boardDim;
  state.ships = newShips;
  state.placed = [];
  state.myBoard = Array(size).fill(null);
  state.enemyBoard = Array(size).fill(null);
  state.enemySunk = [];
  state.mySunk = [];
  state.selShip = null;
  state.orient = "H";
  state.myTurn = false;
  state.over = false;
  state.shots = 0;
  state.hits = 0;
  state.myResults = [];
  state.theirResults = [];
}
