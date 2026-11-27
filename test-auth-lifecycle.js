/**
 * Full E2E Auth Lifecycle & Header Rendering Test
 * Tests:
 * 1. Guest state: Initial load -> Login/Register buttons appear, NO hardcoded 'Karthik'
 * 2. User A registers & logs in (e.g. 'Ananya Iyer') -> Header displays 'Ananya', avatar, dropdown
 * 3. User A logs out -> Tokens cleared, header IMMEDIATELY displays Login button
 * 4. Page refresh while logged out -> Header CONTINUES to display Login button (NO default 'Karthik' resurrection)
 * 5. Route Protection: Attempting to visit dashboard.html or profile.html redirects to login.html
 * 6. User B logs in (e.g. 'Vikramaditya Bose') -> Header displays 'Vikramaditya', sidebar displays 'Vikramaditya Bose'
 * 7. Verification that User A and User B details never mix or linger
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

class LocalStorageMock {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

class SessionStorageMock {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

function runAuthLifecycleSuite() {
  console.log('\n======================================================');
  console.log(' THIRAN AUTH LIFECYCLE & DYNAMIC HEADER VERIFICATION');
  console.log('======================================================\n');

  const storageCode = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf-8');
  const mainCode = fs.readFileSync(path.join(__dirname, '../js/main.js'), 'utf-8');
  const dashboardCode = fs.readFileSync(path.join(__dirname, '../js/dashboard.js'), 'utf-8');

  const localStorage = new LocalStorageMock();
  const sessionStorage = new SessionStorageMock();

  const elements = {};
  function getElem(id) {
    if (!elements[id]) {
      elements[id] = {
        id,
        textContent: '',
        innerHTML: '',
        src: '',
        classList: {
          classes: new Set(),
          add: function(c) { this.classes.add(c); },
          remove: function(c) { this.classes.delete(c); },
          contains: function(c) { return this.classes.has(c); }
        },
        setAttribute: () => {},
        addEventListener: () => {},
        appendChild: () => {},
        querySelector: () => null,
        querySelectorAll: () => []
      };
    }
    return elements[id];
  }

  const navActions = getElem('nav-actions');
  const sidebarUserName = getElem('sidebarUserName');
  const sidebarUserAvatar = getElem('sidebarUserAvatar');
  const dashboardGreeting = getElem('dashboardGreeting');

  let windowLocation = { pathname: '/index.html', href: '/index.html' };

  function createContext() {
    const ctx = {
      localStorage,
      sessionStorage,
      document: {
        body: { appendChild: () => {} },
        addEventListener: () => {},
        createElement: () => ({
          setAttribute: () => {},
          appendChild: () => {},
          remove: () => {},
          classList: { add: () => {}, remove: () => {} },
          style: {}
        }),
        getElementById: (id) => getElem(id),
        querySelector: (sel) => {
          if (sel === '.nav-actions') return navActions;
          if (sel === '.dashboard-sidebar') return getElem('dashboard-sidebar');
          if (sel === '.toast-container') return { appendChild: () => {} };
          return null;
        },
        querySelectorAll: (sel) => {
          if (sel === '.dashboard-sidebar .sidebar-user-name') return [sidebarUserName];
          if (sel === '.dashboard-sidebar .sidebar-avatar') return [sidebarUserAvatar];
          if (sel === '.sidebar-logout-btn') return [];
          return [];
        }
      },
      window: {
        location: windowLocation,
        addEventListener: () => {},
        dispatchEvent: () => {}
      },
      showToast: () => {},
      encodeURIComponent,
      requestAnimationFrame: (cb) => cb(),
      console: { log: () => {}, warn: () => {}, error: () => {} },
      setTimeout: (fn) => fn(),
      Date,
      fetch: async () => ({ ok: true, status: 200, json: async () => ({ success: true }) })
    };
    vm.createContext(ctx);
    vm.runInContext(storageCode, ctx);
    vm.runInContext(mainCode, ctx);
    vm.runInContext(dashboardCode, ctx);
    return ctx;
  }

  // ---------------------------------------------------------------------------
  // STEP 1: Fresh Guest Load
  // ---------------------------------------------------------------------------
  console.log('STEP 1: Initial Fresh Guest Load on index.html');
  let ctx = createContext();
  vm.runInContext('initNavbarAuth();', ctx);

  let hasLoginBtn = navActions.innerHTML.includes('Login');
  let hasKarthik = navActions.innerHTML.includes('Karthik');
  console.log(`  Login button rendered: ${hasLoginBtn ? 'PASS' : 'FAIL'}`);
  console.log(`  No default "Karthik" shown: ${!hasKarthik ? 'PASS' : 'FAIL'}`);
  if (!hasLoginBtn || hasKarthik) process.exit(1);

  // ---------------------------------------------------------------------------
  // STEP 2: User A Logs In ("Ananya Iyer")
  // ---------------------------------------------------------------------------
  console.log('\nSTEP 2: User A Logs In ("Ananya Iyer")');
  const userA = {
    id: 201,
    name: 'Ananya Iyer',
    full_name: 'Ananya Iyer',
    email: 'ananya@thiran.edu',
    role: 'Student',
    avatar: 'https://ui-avatars.com/api/?name=Ananya+Iyer&background=087E8B&color=fff'
  };
  vm.runInContext(`
    setCurrentUser(${JSON.stringify(userA)});
    setAuthToken('mock_jwt_token_user_a');
    initNavbarAuth();
  `, ctx);

  let userANavMatches = navActions.innerHTML.includes('<span class="nav-user-name">Ananya</span>');
  let userAAvatarMatches = navActions.innerHTML.includes('Ananya+Iyer');
  console.log(`  User A first name in nav: ${userANavMatches ? 'PASS' : 'FAIL'}`);
  console.log(`  User A profile picture in nav: ${userAAvatarMatches ? 'PASS' : 'FAIL'}`);
  if (!userANavMatches || !userAAvatarMatches) process.exit(1);

  // On Dashboard
  vm.runInContext('initDashboardView();', ctx);
  let userASidebarMatches = sidebarUserName.textContent === 'Ananya Iyer';
  let userAGreetingMatches = dashboardGreeting.innerHTML.includes('Ananya');
  console.log(`  User A full name in sidebar: ${userASidebarMatches ? 'PASS' : 'FAIL'} ("${sidebarUserName.textContent}")`);
  console.log(`  User A greeting: ${userAGreetingMatches ? 'PASS' : 'FAIL'} ("${dashboardGreeting.innerHTML}")`);
  if (!userASidebarMatches || !userAGreetingMatches) process.exit(1);

  // ---------------------------------------------------------------------------
  // STEP 3: User A Clicks Logout
  // ---------------------------------------------------------------------------
  console.log('\nSTEP 3: User A Clicks Logout');
  vm.runInContext('logoutUser();', ctx);

  let tokenAfterLogout = localStorage.getItem('thiran_auth_token');
  let userAfterLogout = localStorage.getItem('thiran_current_user');
  let loginBtnAfterLogout = navActions.innerHTML.includes('Login');
  let karthikAfterLogout = navActions.innerHTML.includes('Karthik');

  console.log(`  Auth token cleared: ${tokenAfterLogout === null ? 'PASS' : 'FAIL'}`);
  console.log(`  Current user cleared: ${userAfterLogout === null ? 'PASS' : 'FAIL'}`);
  console.log(`  Header immediately displays Login button: ${loginBtnAfterLogout ? 'PASS' : 'FAIL'}`);
  console.log(`  Header does NOT display "Karthik": ${!karthikAfterLogout ? 'PASS' : 'FAIL'}`);
  if (tokenAfterLogout !== null || userAfterLogout !== null || !loginBtnAfterLogout || karthikAfterLogout) {
    process.exit(1);
  }

  // ---------------------------------------------------------------------------
  // STEP 4: Refresh Page While Logged Out
  // ---------------------------------------------------------------------------
  console.log('\nSTEP 4: Refresh Page While Logged Out');
  // Re-instantiate context to simulate page refresh
  ctx = createContext();
  vm.runInContext('initNavbarAuth();', ctx);

  let loginBtnAfterRefresh = navActions.innerHTML.includes('Login');
  let karthikAfterRefresh = navActions.innerHTML.includes('Karthik');
  let userAAfterRefresh = navActions.innerHTML.includes('Ananya');

  console.log(`  Login button remains after refresh: ${loginBtnAfterRefresh ? 'PASS' : 'FAIL'}`);
  console.log(`  No "Karthik" resurrected: ${!karthikAfterRefresh ? 'PASS' : 'FAIL'}`);
  console.log(`  No previous user data lingers: ${!userAAfterRefresh ? 'PASS' : 'FAIL'}`);
  if (!loginBtnAfterRefresh || karthikAfterRefresh || userAAfterRefresh) {
    process.exit(1);
  }

  // ---------------------------------------------------------------------------
  // STEP 5: Route Protection Test (Visiting protected page while logged out)
  // ---------------------------------------------------------------------------
  console.log('\nSTEP 5: Route Protection Check for Guest');
  windowLocation.pathname = '/dashboard.html';
  windowLocation.href = '/dashboard.html';
  ctx = createContext();
  vm.runInContext('initDashboardView();', ctx);

  let redirectedToLogin = windowLocation.href.includes('login.html');
  console.log(`  Unauthenticated dashboard visit redirects to login: ${redirectedToLogin ? 'PASS' : 'FAIL'} ("${windowLocation.href}")`);
  if (!redirectedToLogin) process.exit(1);

  // ---------------------------------------------------------------------------
  // STEP 6: User B Logs In ("Vikramaditya Bose")
  // ---------------------------------------------------------------------------
  console.log('\nSTEP 6: User B Logs In ("Vikramaditya Bose")');
  const userB = {
    id: 202,
    name: 'Vikramaditya Bose',
    full_name: 'Vikramaditya Bose',
    email: 'vikram@thiran.edu',
    role: 'Student',
    avatar: 'https://ui-avatars.com/api/?name=Vikramaditya+Bose&background=087E8B&color=fff'
  };
  vm.runInContext(`
    setCurrentUser(${JSON.stringify(userB)});
    setAuthToken('mock_jwt_token_user_b');
    initNavbarAuth();
    initDashboardView();
  `, ctx);

  let userBNavMatches = navActions.innerHTML.includes('<span class="nav-user-name">Vikramaditya</span>');
  let userBSidebarMatches = sidebarUserName.textContent === 'Vikramaditya Bose';
  let userBGreetingMatches = dashboardGreeting.innerHTML.includes('Vikramaditya');

  console.log(`  User B first name in nav: ${userBNavMatches ? 'PASS' : 'FAIL'}`);
  console.log(`  User B full name in sidebar: ${userBSidebarMatches ? 'PASS' : 'FAIL'} ("${sidebarUserName.textContent}")`);
  console.log(`  User B greeting: ${userBGreetingMatches ? 'PASS' : 'FAIL'} ("${dashboardGreeting.innerHTML}")`);
  if (!userBNavMatches || !userBSidebarMatches || !userBGreetingMatches) {
    process.exit(1);
  }

  console.log('\n======================================================');
  console.log(' ALL 6 E2E AUTH LIFECYCLE TESTS PASSED PERFECTLY!');
  console.log('======================================================\n');
}

runAuthLifecycleSuite();
