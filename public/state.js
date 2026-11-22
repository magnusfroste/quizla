// What every screen shares: who is signed in, whether the AI is switched on, and how to move.

export const state = {
  user: null,            // { id, username, display_name } or null
  ai: false,             // false: the server answers with example content
  router: null,          // set by app.js
  wantAuth: false,       // a visitor on a public quiz asked to sign in
};

/** Go to another screen. */
export const go = (path, options) => state.router(path, options);

/** The friendly note shown wherever example answers are used. */
export const DEMO_NOTE = 'Exempelläge: AI:n är inte påslagen än. Du får ett färdigt exempel om fotosyntesen i stället för dina egna sidor.';
