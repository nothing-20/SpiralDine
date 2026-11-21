async function verifyProduction() {
  const base = 'https://dine.spiralworld.in';
  console.log(`Auditing Live Production Platform: ${base}`);

  const routes = [
    { path: '/', label: 'Landing Page' },
    { path: '/login', label: 'Owner Login' },
    { path: '/register', label: 'Owner Registration' },
    { path: '/reset-password', label: 'Password Reset' },
    { path: '/customer/login', label: 'Customer Login' },
    { path: '/customer/register', label: 'Customer Registration' },
  ];

  for (const route of routes) {
    const res = await fetch(base + route.path);
    const html = await res.text();
    console.log(`[ROUTE] ${route.label} (${route.path}): HTTP ${res.status}, Length: ${html.length} bytes`);
  }

  // Inspect the live /login HTML
  const loginRes = await fetch(base + '/login');
  const loginHtml = await loginRes.text();

  // Find all bundled script tags
  const scripts = [...loginHtml.matchAll(/src="([^"]+\.js)"/g)].map(m => m[1]);
  console.log(`\nDiscovered ${scripts.length} bundled scripts on live production login page:`, scripts);

  let targetsProductionFirebase = false;
  let hasGoogleProvider = false;
  let hasAccountLinking = false;

  for (const s of scripts) {
    const scriptUrl = s.startsWith('http') ? s : base + s;
    const jsRes = await fetch(scriptUrl);
    if (!jsRes.ok) continue;
    const js = await jsRes.text();

    if (js.includes('spiral-restaurant-saas-v1')) {
      targetsProductionFirebase = true;
      console.log(`  [CONFIRMED] Script "${s}" strictly binds to production Firebase project: "spiral-restaurant-saas-v1"`);
    }
    if (js.includes('Continue with Google') || js.includes('google.com') || js.includes('GoogleAuthProvider')) {
      hasGoogleProvider = true;
      console.log(`  [CONFIRMED] Script "${s}" includes Google Sign-In provider and components`);
    }
    if (js.includes('linkWithCredential') || js.includes('account-exists-with-different-credential')) {
      hasAccountLinking = true;
      console.log(`  [CONFIRMED] Script "${s}" includes account-linking handlers`);
    }
  }

  // Verify backend serverless function
  const apiRes = await fetch(base + '/api/auth/send-password-reset', { method: 'GET' });
  console.log(`\n[API] /api/auth/send-password-reset: HTTP ${apiRes.status}`);

  console.log('\n======================================================');
  console.log('LIVE PRODUCTION VERIFICATION SUMMARY:');
  console.log(`1. Target Firebase Project: ${targetsProductionFirebase ? 'spiral-restaurant-saas-v1 (CONFIRMED)' : 'NOT FOUND'}`);
  console.log(`2. Google Sign-In Provider: ${hasGoogleProvider ? 'ACTIVE (CONFIRMED)' : 'NOT FOUND'}`);
  console.log(`3. Account-Linking Logic:   ${hasAccountLinking ? 'ACTIVE (CONFIRMED)' : 'NOT FOUND'}`);
  console.log('======================================================\n');
}

verifyProduction().catch(console.error);
