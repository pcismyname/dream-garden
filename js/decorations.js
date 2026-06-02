window.Garden = window.Garden || {};

// Cosmetic items placed in the 6-slot decoration zone below the garden grid.
// Decorations don't affect gameplay — purely self-expression and a coin sink.
window.Garden.DECORATIONS = [
  { id: "gnome",    name: "Garden Gnome",   levelReq: 1, cost: 50   },
  { id: "bush",     name: "Topiary Bush",   levelReq: 1, cost: 80   },
  { id: "mailbox",  name: "Mailbox",        levelReq: 2, cost: 150  },
  { id: "fountain", name: "Small Fountain", levelReq: 3, cost: 300  },
  { id: "bench",    name: "Garden Bench",   levelReq: 5, cost: 600  },
  { id: "sundial",  name: "Sundial",        levelReq: 8, cost: 1200 },
];

window.Garden.DECORATION_SLOTS = 6;
window.Garden.DECORATION_REFUND_PCT = 0.5;

window.Garden.decorationById = function (id) {
  return window.Garden.DECORATIONS.find(d => d.id === id) || null;
};
