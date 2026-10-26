import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {getAuth,signInWithEmailAndPassword,onAuthStateChanged,signOut} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {getFirestore,doc,getDoc,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import {firebaseConfig,usernames,editorUid} from './editor-config.js';
import {validateEdits} from './content-store.js';

const app = initializeApp(firebaseConfig, 'vexel-editor');
const auth = getAuth(app);
const db = getFirestore(app);
const siteDoc = doc(db, 'vexel', 'site');
const $ = (id) => document.getElementById(id);
const SETUP_GUIDE = 'https://github.com/techmaster2013/vexel/blob/main/docs/EDITOR.md';

let dirty = false;

function status(text, kind = '') {
  $('status').textContent = text;
  $('status').className = kind;
}

// Turn Firebase error codes into something a person can act on.
function explain(error) {
  const code = error?.code || '';
  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'].includes(code)) return 'Wrong email or password.';
  if (code === 'auth/too-many-requests') return 'Too many tries. Wait a minute and try again.';
  if (code === 'auth/unauthorized-domain') return `This website isn't allowed to sign in yet. In Firebase, add "${location.hostname}" under Authentication → Settings → Authorized domains.`;
  if (code === 'auth/network-request-failed' || code === 'unavailable') return "Couldn't reach Firebase. Check your internet (some school networks block it).";
  if (code === 'permission-denied') return 'Firebase refused the request. The editor rules are probably not added yet (step 2 of the setup guide).';
  return error?.message || String(error);
}

function showSetupHelp(show) {
  $('setup-help').hidden = !show;
}

function markDirty() {
  dirty = true;
  $('publish').textContent = 'Publish changes •';
}

function markClean() {
  dirty = false;
  $('publish').textContent = 'Publish changes';
}

function updateCounts() {
  $('games-count').textContent = $('games').children.length;
  $('movies-count').textContent = $('movies').children.length;
}

// One editable entry. `kind` is "games" or "movies".
function addRow(kind, item = {}) {
  const row = document.createElement('div');
  row.className = 'editor-entry';
  const urlLabel = kind === 'games' ? 'Game link (https://…)' : 'Video link (https://…, .mp4 or .webm)';
  const fields = [
    ['title', 'Title', item.title],
    ['url', urlLabel, item.url || (kind === 'games' ? item.launchUrl : item.stream)],
    ['description', 'Short description (optional)', item.description],
  ];
  for (const [name, label, value] of fields) {
    const wrap = document.createElement('label');
    const input = document.createElement('input');
    wrap.textContent = label;
    input.name = name;
    input.value = value || '';
    if (name === 'url') {
      input.type = 'url';
      input.placeholder = 'https://';
    }
    input.oninput = () => {
      markDirty();
      if (name === 'url') checkUrl(input);
    };
    wrap.append(input);
    row.append(wrap);
  }
  const buttons = document.createElement('div');
  buttons.className = 'actions';
  const test = document.createElement('button');
  test.type = 'button';
  test.textContent = 'Test link ↗';
  test.onclick = () => {
    const url = row.querySelector('[name=url]').value.trim();
    if (url.startsWith('https://')) window.open(url, '_blank', 'noopener');
    else status('Enter an https:// link first.', 'error');
  };
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.textContent = 'Remove';
  remove.onclick = () => {
    row.remove();
    markDirty();
    updateCounts();
  };
  buttons.append(test, remove);
  row.append(buttons);
  $(kind).append(row);
  updateCounts();
  return row;
}

function checkUrl(input) {
  const value = input.value.trim();
  input.classList.toggle('invalid', value !== '' && !value.startsWith('https://'));
}

function readRows(kind) {
  return [...$(kind).children].map((row) =>
    Object.fromEntries([...row.querySelectorAll('input')].map((input) => [input.name, input.value.trim()])));
}

async function loadSite() {
  status('Loading the current site…');
  const snapshot = await getDoc(siteDoc);
  const data = snapshot.exists()
    ? validateEdits(JSON.parse(snapshot.data().payload))
    : {games: [], movies: [], wispUrl: ''};
  $('games').replaceChildren();
  $('movies').replaceChildren();
  data.games.forEach((item) => addRow('games', item));
  data.movies.forEach((item) => addRow('movies', item));
  $('wisp').value = data.wispUrl;
  updateCounts();
  markClean();
  status(snapshot.exists() ? 'Ready. Make your changes, then press Publish.' : 'Ready. Nothing published yet — add your first game.', 'ok');
}

$('login-form').onsubmit = async (event) => {
  event.preventDefault();
  status('Signing in…');
  try {
    let identifier = $('username').value.trim();
    identifier = usernames[identifier.toLowerCase()] || identifier;
    if (!identifier.includes('@')) throw Error('Use the email address of your GamePlaza admin account.');
    await signInWithEmailAndPassword(auth, identifier, $('password').value);
    $('password').value = '';
  } catch (error) {
    status(explain(error), 'error');
  }
};

onAuthStateChanged(auth, async (user) => {
  $('login').hidden = !!user;
  $('editor').hidden = !user;
  showSetupHelp(false);
  if (!user) {
    status('');
    return;
  }
  $('who').textContent = user.email || 'admin';
  try {
    const token = await user.getIdTokenResult(true);
    if (user.uid !== editorUid && token.claims.vexelAdmin !== true) {
      $('editor').hidden = true;
      $('login').hidden = false;
      status(`Signed in as ${user.email}, but this account isn't allowed to edit Vexel.`, 'error');
      await signOut(auth);
      return;
    }
    await loadSite();
  } catch (error) {
    status(explain(error), 'error');
    if (error?.code === 'permission-denied') showSetupHelp(true);
  }
});

$('add-game').onclick = () => {
  addRow('games').querySelector('input').focus();
  markDirty();
};
$('add-movie').onclick = () => {
  addRow('movies').querySelector('input').focus();
  markDirty();
};
$('wisp').oninput = markDirty;
$('logout').onclick = async () => {
  if (dirty && !confirm('You have unpublished changes. Sign out anyway?')) return;
  markClean();
  await signOut(auth);
};

$('publish').onclick = async () => {
  $('publish').disabled = true;
  status('Publishing…');
  try {
    const data = validateEdits({games: readRows('games'), movies: readRows('movies'), wispUrl: $('wisp').value.trim()});
    const payload = JSON.stringify(data);
    if (payload.length > 150000) throw Error('The lists are too long. Remove a few entries and try again.');
    await setDoc(siteDoc, {payload, updatedAt: serverTimestamp()});
    markClean();
    status(`Published ${data.games.length} games and ${data.movies.length} movies. Visitors see them after reloading Vexel.`, 'ok');
  } catch (error) {
    status('Could not publish: ' + explain(error), 'error');
    if (error?.code === 'permission-denied') showSetupHelp(true);
  } finally {
    $('publish').disabled = false;
  }
};

window.addEventListener('beforeunload', (event) => {
  if (dirty) event.preventDefault();
});

$('setup-link').href = SETUP_GUIDE;
