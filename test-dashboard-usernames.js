/**
 * Test Dashboard Username Consistency for Multiple Accounts
 * Verifies that:
 * 1. Top navigation (.nav-user-name)
 * 2. Welcome greeting (#dashboardGreeting)
 * 3. Left sidebar (#sidebarUserName and .sidebar-user-name)
 * all display the currently logged-in user's actual name dynamically for different accounts.
 */

const fs = require('fs');
const path = require('path');

// Mock a lightweight browser DOM & LocalStorage environment
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

function runConsistencyTest() {
  console.log('========================================================');
  console.log(' TESTING DASHBOARD USERNAME CONSISTENCY');
  console.log('========================================================\n');

  // Read files
  const storageCode = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf-8');
  const mainCode = fs.readFileSync(path.join(__dirname, '../js/main.js'), 'utf-8');
  const dashboardCode = fs.readFileSync(path.join(__dirname, '../js/dashboard.js'), 'utf-8');
  const dashboardHtml = fs.readFileSync(path.join(__dirname, '../dashboard.html'), 'utf-8');

  const testAccounts = [
    {
      id: 101,
      full_name: 'Ram',
      email: 'ram@thiran.edu',
      expectedSidebar: 'Ram',
      expectedNav: 'Ram',
      expectedGreetingKeyword: 'Ram'
    },
    {
      id: 102,
      full_name: 'Priya Sharma',
      email: 'priya@thiran.edu',
      expectedSidebar: 'Priya Sharma',
      expectedNav: 'Priya',
      expectedGreetingKeyword: 'Priya'
    },
    {
      id: 103,
      full_name: 'Karthik Raja',
      email: 'karthik@thiran.edu',
      expectedSidebar: 'Karthik Raja',
      expectedNav: 'Karthik',
      expectedGreetingKeyword: 'Karthik'
    }
  ];

  let allPassed = true;

  testAccounts.forEach((account, idx) => {
    console.log(`--- Test Case ${idx + 1}: Account "${account.full_name}" ---`);

    // Setup DOM elements mock
    const elements = {};

    function getOrCreateElement(id, tagName = 'div') {
      if (!elements[id]) {
        elements[id] = {
          id,
          tagName,
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
          querySelector: () => null,
          querySelectorAll: () => []
        };
      }
      return elements[id];
    }

    const navActions = getOrCreateElement('nav-actions');
    const sidebarUserName = getOrCreateElement('sidebarUserName');
    const sidebarUserAvatar = getOrCreateElement('sidebarUserAvatar');
    const dashboardGreeting = getOrCreateElement('dashboardGreeting');
    const dashboardSubtitle = getOrCreateElement('dashboardSubtitle');
    const dashboardMainView = getOrCreateElement('dashboardMainView');
    const statEnrolledCount = getOrCreateElement('statEnrolledCount');
    const statCompletedCount = getOrCreateElement('statCompletedCount');
    const statHoursLearned = getOrCreateElement('statHoursLearned');
    const statAvgProgress = getOrCreateElement('statAvgProgress');

    const localStorage = new LocalStorageMock();

    // Log in this account
    const userToStore = {
      id: account.id,
      name: account.full_name,
      full_name: account.full_name,
      email: account.email,
      role: 'Student'
    };
    localStorage.setItem('thiran_current_user', JSON.stringify(userToStore));

    // Create sandbox context
    const context = {
      localStorage,
      document: {
        addEventListener: () => {},
        getElementById: (id) => elements[id] || null,
        querySelector: (sel) => {
          if (sel === '.nav-actions') return navActions;
          if (sel === '.dashboard-sidebar') return getOrCreateElement('dashboard-sidebar');
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
        location: { pathname: '/dashboard.html', search: '' }
      },
      encodeURIComponent,
      console: { log: () => {}, warn: () => {}, error: () => {} },
      setTimeout: () => {},
      Date
    };

    // Evaluate storage.js, main.js, dashboard.js in context
    const vm = require('vm');
    vm.createContext(context);
    vm.runInContext(storageCode, context);
    vm.runInContext(mainCode, context);
    vm.runInContext(dashboardCode, context);

    // Call initNavbarAuth and initDashboardView
    vm.runInContext('initNavbarAuth(); initDashboardView();', context);

    // Verify Nav Actions contains the expected nav name
    const navHtml = navActions.innerHTML;
    const navMatches = navHtml.includes(`<span class="nav-user-name">${account.expectedNav}</span>`);

    // Verify Sidebar user name
    const sidebarActual = sidebarUserName.textContent;
    const sidebarMatches = sidebarActual === account.expectedSidebar;

    // Verify Greeting
    const greetingHtml = dashboardGreeting.innerHTML;
    const greetingMatches = greetingHtml.includes(account.expectedGreetingKeyword);

    console.log(`  Top Navigation:    "${account.expectedNav}" -> ${navMatches ? 'PASS' : 'FAIL'} (Found in HTML: ${navMatches})`);
    console.log(`  Welcome Greeting:  "${account.expectedGreetingKeyword}" -> ${greetingMatches ? 'PASS' : 'FAIL'} ("${greetingHtml}")`);
    console.log(`  Left Sidebar Name: "${sidebarActual}" -> ${sidebarMatches ? 'PASS' : 'FAIL'} (Expected: "${account.expectedSidebar}")`);

    if (navMatches && sidebarMatches && greetingMatches) {
      console.log(`  >>> RESULT: SUCCESS for "${account.full_name}"\n`);
    } else {
      console.log(`  >>> RESULT: FAILED for "${account.full_name}"\n`);
      allPassed = false;
    }
  });

  console.log('========================================================');
  console.log(`OVERALL TEST STATUS: ${allPassed ? 'ALL TESTS PASSED (3/3)' : 'SOME TESTS FAILED'}`);
  console.log('========================================================');

  process.exit(allPassed ? 0 : 1);
}

runConsistencyTest();
