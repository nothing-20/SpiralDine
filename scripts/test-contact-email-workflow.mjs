/**
 * Automated Verification Suite: GoDaddy Professional Email Contact Workflow
 *
 * Compiles api/contact.ts + api/_lib/email/*.ts using TypeScript (strict + NodeNext)
 * into a temporary cache folder under node_modules/.cache/sd-contact-test, exercises
 * every validation, security, template, guard, handler, and real Nodemailer socket
 * failure path cleanly, and removes the temporary build folder afterward.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');
const TEMP_OUT_DIR = path.join(ROOT_DIR, 'node_modules', '.cache', 'sd-contact-test');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err instanceof Error ? err.stack || err.message : String(err)}`);
  }
}

function compileApiModules() {
  fs.rmSync(TEMP_OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEMP_OUT_DIR, { recursive: true });

  const tscJs = path.join(ROOT_DIR, 'node_modules', 'typescript', 'bin', 'tsc');

  execFileSync(
    process.execPath,
    [
      tscJs,
      '--target',
      'ES2022',
      '--module',
      'NodeNext',
      '--moduleResolution',
      'NodeNext',
      '--esModuleInterop',
      '--strict',
      '--skipLibCheck',
      '--outDir',
      TEMP_OUT_DIR,
      path.join(ROOT_DIR, 'api', 'contact.ts'),
    ],
    {
      cwd: ROOT_DIR,
      stdio: 'pipe',
    }
  );
}

function getClosedLocalPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      server.close((closeErr) => {
        if (closeErr) reject(closeErr);
        else resolve(port);
      });
    });
    server.on('error', reject);
  });
}

function walkFiles(dir, exts, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, exts, out);
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

const VALID_BASE_ENV = {
  SMTP_HOST: 'smtp.example.invalid',
  SMTP_PORT: '465',
  SMTP_SECURE: 'true',
  SMTP_USER: 'support@spiralworld.in',
  SMTP_PASS: 'unit-test-secret-do-not-leak',
  CONTACT_FROM_EMAIL: 'support@spiralworld.in',
  CONTACT_FROM_NAME: 'SpiralDine',
  CONTACT_TO_EMAIL: 'support@spiralworld.in',
  CONTACT_SEND_ACK: 'true',
};

const VALID_PAYLOAD = {
  name: 'Alex Sharma',
  email: 'Alex.Sharma@BistroExample.com',
  phone: '+91 98765 43210',
  restaurantName: 'Royal Spice Kitchen',
  category: 'Restaurant Onboarding',
  subject: 'Interested in POS + KDS setup for 18 tables',
  message: 'Hello SpiralDine team, we would like a walkthrough for our 18-table restaurant next week.',
};

async function run() {
  console.log('\nSpiralDine Official Email (GoDaddy SMTP) Verification Suite\n');
  compileApiModules();

  try {
    const loadModule = (relPath) =>
      import(pathToFileURL(path.join(TEMP_OUT_DIR, relPath)).href);

    const { resolveSmtpContactConfig, classifySmtpError } = await loadModule(
      'api/_lib/email/smtpConfig.js'
    );
    const { validateContactSubmission } = await loadModule(
      'api/_lib/email/contactValidation.js'
    );
    const { ContactSubmissionGuard } = await loadModule(
      'api/_lib/email/contactGuard.js'
    );
    const {
      buildSupportEnquiryEmail,
      buildCustomerAcknowledgementEmail,
    } = await loadModule('api/_lib/email/contactTemplates.js');
    const { processContactSubmission } = await loadModule(
      'api/_lib/email/contactService.js'
    );
    const { default: contactHandler } = await loadModule('api/contact.js');

    // -----------------------------------------------------------------
    // Suite 1: Configuration & Security Hygiene
    // -----------------------------------------------------------------
    console.log('1. Configuration & Frontend Secret Hygiene');

    await test('Missing SMTP configuration fails cleanly without inventing values', () => {
      const res = resolveSmtpContactConfig({});
      assert.equal(res.ok, false);
      assert.deepEqual(res.missingKeys, [
        'SMTP_HOST',
        'SMTP_PORT',
        'SMTP_SECURE',
        'SMTP_USER',
        'SMTP_PASS',
      ]);
    });

    await test('Non-secret contact defaults use SpiralDine / support@spiralworld.in when SMTP is provided', () => {
      const res = resolveSmtpContactConfig({
        SMTP_HOST: 'mail.example.invalid',
        SMTP_PORT: '587',
        SMTP_SECURE: 'false',
        SMTP_USER: 'support@spiralworld.in',
        SMTP_PASS: 'example-pass',
      });
      assert.equal(res.ok, true);
      assert.equal(res.config.fromEmail, 'support@spiralworld.in');
      assert.equal(res.config.fromName, 'SpiralDine');
      assert.equal(res.config.toEmail, 'support@spiralworld.in');
      assert.equal(res.config.sendAck, false);
      assert.equal(res.config.smtpSecure, false);
    });

    await test('Invalid SMTP_PORT or SMTP_SECURE flags are rejected', () => {
      const badPort = resolveSmtpContactConfig({
        ...VALID_BASE_ENV,
        SMTP_PORT: '99999',
      });
      assert.equal(badPort.ok, false);
      assert.ok(badPort.invalidKeys.includes('SMTP_PORT'));

      const badSecure = resolveSmtpContactConfig({
        ...VALID_BASE_ENV,
        SMTP_SECURE: 'maybe',
      });
      assert.equal(badSecure.ok, false);
      assert.ok(badSecure.invalidKeys.includes('SMTP_SECURE'));
    });

    await test('Frontend src/ contains zero SMTP secrets or VITE_SMTP_ variables', () => {
      const srcFiles = walkFiles(path.join(ROOT_DIR, 'src'), ['.ts', '.tsx', '.js', '.jsx']);
      for (const file of srcFiles) {
        const content = fs.readFileSync(file, 'utf8');
        assert.ok(
          !/VITE_SMTP_|SMTP_PASS|SMTP_HOST|SMTP_USER|nodemailer/i.test(content),
          `Secret or SMTP reference found in frontend file: ${path.relative(ROOT_DIR, file)}`
        );
      }
    });

    await test('ContactPage.tsx and PublicFooter.tsx display official support@spiralworld.in and required fields', () => {
      const contactSrc = fs.readFileSync(
        path.join(ROOT_DIR, 'src', 'features', 'public-pages', 'ContactPage.tsx'),
        'utf8'
      );
      const footerSrc = fs.readFileSync(
        path.join(ROOT_DIR, 'src', 'features', 'public-pages', 'components', 'PublicFooter.tsx'),
        'utf8'
      );

      assert.ok(!contactSrc.includes('kumbhageethakrishna143@gmail.com'));
      assert.ok(!footerSrc.includes('kumbhageethakrishna143@gmail.com'));
      assert.ok(contactSrc.includes('OFFICIAL_SUPPORT_EMAIL'));
      assert.ok(footerSrc.includes('OFFICIAL_SUPPORT_EMAIL'));
      assert.ok(contactSrc.includes('contact-category'));
      assert.ok(contactSrc.includes('contact-subject'));
      assert.ok(contactSrc.includes('contact-website'));
      assert.ok(contactSrc.includes('grid-cols-1 lg:grid-cols-12'));
      assert.ok(contactSrc.includes('grid-cols-1 sm:grid-cols-2'));
    });

    // -----------------------------------------------------------------
    // Suite 2: Validation & Anti-Spam
    // -----------------------------------------------------------------
    console.log('\n2. Input Validation, Header Injection & Anti-Spam');

    await test('Valid payload passes validation and normalizes fields cleanly', () => {
      const res = validateContactSubmission({
        ...VALID_PAYLOAD,
        to: 'attacker@evil.example',
        bcc: 'leak@evil.example',
      });
      assert.equal(res.ok, true);
      assert.equal(res.data.email, 'alex.sharma@bistroexample.com');
      assert.equal(res.data.name, 'Alex Sharma');
      assert.equal('to' in res.data, false);
    });

    await test('Invalid email addresses are rejected', () => {
      for (const badEmail of [
        '',
        'not-an-email',
        'user@',
        '@domain.com',
        'user@localhost',
        'user..name@domain.com',
        'user@domain.com\r\nBcc: evil@attacker.com',
      ]) {
        const res = validateContactSubmission({ ...VALID_PAYLOAD, email: badEmail });
        assert.equal(res.ok, false, `Expected invalid email to fail: ${JSON.stringify(badEmail)}`);
      }
    });

    await test('Missing required fields and empty message are rejected', () => {
      const missingName = validateContactSubmission({ ...VALID_PAYLOAD, name: '' });
      assert.equal(missingName.ok, false);
      assert.ok(missingName.fieldErrors.name);

      const emptyMsg = validateContactSubmission({ ...VALID_PAYLOAD, message: '   \n\t  ' });
      assert.equal(emptyMsg.ok, false);
      assert.ok(emptyMsg.fieldErrors.message);

      const shortMsg = validateContactSubmission({ ...VALID_PAYLOAD, message: 'hi' });
      assert.equal(shortMsg.ok, false);
      assert.ok(shortMsg.fieldErrors.message);

      const badCat = validateContactSubmission({ ...VALID_PAYLOAD, category: 'Free Spam' });
      assert.equal(badCat.ok, false);
      assert.ok(badCat.fieldErrors.category);

      const badPhone = validateContactSubmission({ ...VALID_PAYLOAD, phone: 'not-a-phone!' });
      assert.equal(badPhone.ok, false);
      assert.ok(badPhone.fieldErrors.phone);
    });

    await test('Honeypot, header injection, and multi-URL spam are blocked before SMTP', async () => {
      let smtpCalls = 0;
      const transportFactory = () => ({
        sendMail: async () => {
          smtpCalls += 1;
          return { accepted: ['support@spiralworld.in'], rejected: [] };
        },
      });

      const honeypotRes = await processContactSubmission(
        { ...VALID_PAYLOAD, website: 'https://bot-promo.example' },
        '203.0.113.10',
        { env: VALID_BASE_ENV, guard: new ContactSubmissionGuard(), createTransport: transportFactory }
      );
      assert.equal(honeypotRes.httpStatus, 400);
      assert.equal(honeypotRes.body.code, 'SPAM_DETECTED');

      const headerRes = await processContactSubmission(
        { ...VALID_PAYLOAD, subject: 'Hello\r\nBcc: attacker@evil.example' },
        '203.0.113.11',
        { env: VALID_BASE_ENV, guard: new ContactSubmissionGuard(), createTransport: transportFactory }
      );
      assert.equal(headerRes.httpStatus, 400);
      assert.equal(headerRes.body.code, 'VALIDATION_ERROR');

      const urlFloodRes = await processContactSubmission(
        {
          ...VALID_PAYLOAD,
          message: 'Visit https://a.example https://b.example https://c.example https://d.example now!',
        },
        '203.0.113.12',
        { env: VALID_BASE_ENV, guard: new ContactSubmissionGuard(), createTransport: transportFactory }
      );
      assert.equal(urlFloodRes.httpStatus, 400);
      assert.equal(urlFloodRes.body.code, 'SPAM_DETECTED');
      assert.equal(smtpCalls, 0);
    });

    // -----------------------------------------------------------------
    // Suite 3: Email Templates & Branding
    // -----------------------------------------------------------------
    console.log('\n3. SpiralDine Email Design, Escaping & Acknowledgement Rules');

    await test('Support notification & customer acknowledgement templates include SpiralDine/Spiral World branding and escape HTML', () => {
      const xssSubmission = {
        name: 'Asha <script>alert(1)</script>',
        email: 'asha@cafe.example',
        phone: '',
        restaurantName: 'Cafe <b>Lotus</b>',
        category: 'Technical Support',
        subject: 'Printer setup & KDS sync',
        message: 'Line 1 & <img src=x onerror=alert(1)>',
      };
      const meta = {
        referenceId: 'SD-20261111-ABC123',
        submittedAtIso: '2026-11-11T13:30:00.000Z',
        supportEmail: 'support@spiralworld.in',
      };

      const supportMail = buildSupportEnquiryEmail(xssSubmission, meta);
      assert.ok(supportMail.subject.includes('[SpiralDine Enquiry] Technical Support'));
      assert.ok(supportMail.html.includes('SpiralDine'));
      assert.ok(supportMail.html.includes('Spiral World'));
      assert.ok(supportMail.html.includes('https://dine.spiralworld.in'));
      assert.ok(!supportMail.html.includes('<script>alert(1)</script>'));
      assert.ok(supportMail.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
      assert.ok(supportMail.text.includes('Technical Support'));
      assert.ok(supportMail.text.includes('SD-20261111-ABC123'));

      const ackMail = buildCustomerAcknowledgementEmail(xssSubmission, meta);
      assert.equal(ackMail.subject, 'We received your enquiry — SpiralDine');
      assert.ok(ackMail.html.includes('Enquiry Received'));
      assert.ok(ackMail.html.includes('support@spiralworld.in'));
      assert.ok(!/resolved|issue has been fixed|closed/i.test(ackMail.text));
      assert.ok(ackMail.text.includes('received your enquiry'));
    });

    // -----------------------------------------------------------------
    // Suite 4: End-to-End Service Delivery, Failures & Acknowledgement
    // -----------------------------------------------------------------
    console.log('\n4. Delivery Flow, Acknowledgement, SMTP Auth & Connection Failures');

    await test('Valid submission sends support notification with Reply-To + customer ack when CONTACT_SEND_ACK=true', async () => {
      const sentMails = [];
      let closed = false;

      const res = await processContactSubmission(
        { ...VALID_PAYLOAD, to: 'hijack@evil.example' },
        '198.51.100.20',
        {
          env: VALID_BASE_ENV,
          guard: new ContactSubmissionGuard(),
          createTransport: () => ({
            sendMail: async (mail) => {
              sentMails.push(mail);
              return { messageId: `<msg-${sentMails.length}@spiralworld.in>`, accepted: [mail.to], rejected: [] };
            },
            close: () => {
              closed = true;
            },
          }),
        }
      );

      assert.equal(res.httpStatus, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.acknowledgementSent, true);
      assert.ok(res.body.referenceId.startsWith('SD-'));
      assert.equal(sentMails.length, 2);
      assert.equal(closed, true);

      // Mail 1: support@spiralworld.in notification with Reply-To = customer email
      assert.deepEqual(sentMails[0].from, { name: 'SpiralDine', address: 'support@spiralworld.in' });
      assert.equal(sentMails[0].to, 'support@spiralworld.in');
      assert.deepEqual(sentMails[0].replyTo, {
        name: 'Alex Sharma',
        address: 'alex.sharma@bistroexample.com',
      });

      // Mail 2: customer acknowledgement
      assert.equal(sentMails[1].to, 'alex.sharma@bistroexample.com');
      assert.equal(sentMails[1].subject, 'We received your enquiry — SpiralDine');
      assert.deepEqual(sentMails[1].replyTo, {
        name: 'SpiralDine',
        address: 'support@spiralworld.in',
      });
    });

    await test('When CONTACT_SEND_ACK=false, only support notification is dispatched', async () => {
      const sentMails = [];
      const res = await processContactSubmission(VALID_PAYLOAD, '198.51.100.21', {
        env: { ...VALID_BASE_ENV, CONTACT_SEND_ACK: 'false' },
        guard: new ContactSubmissionGuard(),
        createTransport: () => ({
          sendMail: async (mail) => {
            sentMails.push(mail);
            return { accepted: [mail.to], rejected: [] };
          },
        }),
      });

      assert.equal(res.httpStatus, 200);
      assert.equal(res.body.acknowledgementSent, false);
      assert.equal(sentMails.length, 1);
      assert.equal(sentMails[0].to, 'support@spiralworld.in');
    });

    await test('SMTP authentication failure returns 502 without leaking secrets and releases duplicate lock', async () => {
      const guard = new ContactSubmissionGuard();
      const res = await processContactSubmission(VALID_PAYLOAD, '198.51.100.22', {
        env: VALID_BASE_ENV,
        guard,
        createTransport: () => ({
          sendMail: async () => {
            const err = new Error('535 5.7.8 Error: authentication failed');
            err.code = 'EAUTH';
            err.responseCode = 535;
            throw err;
          },
        }),
      });

      assert.equal(res.httpStatus, 502);
      assert.equal(res.body.success, false);
      assert.equal(res.body.code, 'SMTP_AUTH_FAILED');
      assert.ok(!JSON.stringify(res).includes(VALID_BASE_ENV.SMTP_PASS));

      // Immediate retry should NOT be blocked by duplicate lock after SMTP failure
      const retryRes = await processContactSubmission(VALID_PAYLOAD, '198.51.100.22', {
        env: VALID_BASE_ENV,
        guard,
        createTransport: () => ({
          sendMail: async (mail) => ({ accepted: [mail.to], rejected: [] }),
        }),
      });
      assert.equal(retryRes.httpStatus, 200);
      assert.equal(retryRes.body.success, true);
    });

    await test('SMTP connection failure via real Nodemailer against unreachable local port returns 504', async () => {
      const closedPort = await getClosedLocalPort();
      const guard = new ContactSubmissionGuard();
      const res = await processContactSubmission(VALID_PAYLOAD, '198.51.100.23', {
        env: {
          ...VALID_BASE_ENV,
          SMTP_HOST: '127.0.0.1',
          SMTP_PORT: String(closedPort),
          SMTP_SECURE: 'false',
        },
        guard,
      });

      assert.equal(res.httpStatus, 504);
      assert.equal(res.body.success, false);
      assert.equal(res.body.code, 'SMTP_CONNECTION_FAILED');
    });

    await test('SMTP timeout classification and recipient rejection do not return false 200 success', async () => {
      const classifiedTimeout = classifySmtpError({ code: 'ETIMEDOUT', message: 'Connection timeout' });
      assert.equal(classifiedTimeout.httpStatus, 504);
      assert.equal(classifiedTimeout.errorCode, 'SMTP_CONNECTION_FAILED');

      const rejectedRes = await processContactSubmission(VALID_PAYLOAD, '198.51.100.24', {
        env: VALID_BASE_ENV,
        guard: new ContactSubmissionGuard(),
        createTransport: () => ({
          sendMail: async () => ({
            accepted: [],
            rejected: ['support@spiralworld.in'],
          }),
        }),
      });
      assert.equal(rejectedRes.httpStatus, 502);
      assert.equal(rejectedRes.body.success, false);
      assert.equal(rejectedRes.body.code, 'SMTP_DELIVERY_REJECTED');
    });

    await test('Partial customer acknowledgement failure still confirms support receipt honestly (acknowledgementSent=false)', async () => {
      let callCount = 0;
      const res = await processContactSubmission(VALID_PAYLOAD, '198.51.100.25', {
        env: VALID_BASE_ENV,
        guard: new ContactSubmissionGuard(),
        createTransport: () => ({
          sendMail: async (mail) => {
            callCount += 1;
            if (callCount === 1) {
              return { accepted: [mail.to], rejected: [] };
            }
            const err = new Error('550 No such user here');
            err.responseCode = 550;
            throw err;
          },
        }),
      });

      assert.equal(res.httpStatus, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.acknowledgementSent, false);
      assert.ok(!res.body.message.includes('confirmation email has been sent'));
    });

    // -----------------------------------------------------------------
    // Suite 5: Duplicate Submission & Rate Limiting
    // -----------------------------------------------------------------
    console.log('\n5. Duplicate Submission & Rate-Limit Protection');

    await test('Concurrent double-submit and repeat submit within 120s return 409; allowed after window', async () => {
      let fakeNow = 1_700_000_000_000;
      const guard = new ContactSubmissionGuard({ now: () => fakeNow });

      let resolveSlowSend;
      const slowSendPromise = new Promise((resolve) => {
        resolveSlowSend = resolve;
      });

      const firstPromise = processContactSubmission(VALID_PAYLOAD, '198.51.100.30', {
        env: { ...VALID_BASE_ENV, CONTACT_SEND_ACK: 'false' },
        guard,
        createTransport: () => ({
          sendMail: async (mail) => {
            await slowSendPromise;
            return { accepted: [mail.to], rejected: [] };
          },
        }),
      });

      // Wait microtask so firstPromise enters SMTP send
      await new Promise((r) => setTimeout(r, 10));

      const concurrentDup = await processContactSubmission(VALID_PAYLOAD, '198.51.100.31', {
        env: VALID_BASE_ENV,
        guard,
        createTransport: () => ({
          sendMail: async (mail) => ({ accepted: [mail.to], rejected: [] }),
        }),
      });
      assert.equal(concurrentDup.httpStatus, 409);
      assert.equal(concurrentDup.body.code, 'DUPLICATE_SUBMISSION');

      resolveSlowSend();
      const firstRes = await firstPromise;
      assert.equal(firstRes.httpStatus, 200);

      // Sequential repeat within cooldown
      const repeatDup = await processContactSubmission(VALID_PAYLOAD, '198.51.100.32', {
        env: VALID_BASE_ENV,
        guard,
        createTransport: () => ({
          sendMail: async (mail) => ({ accepted: [mail.to], rejected: [] }),
        }),
      });
      assert.equal(repeatDup.httpStatus, 409);
      assert.equal(repeatDup.body.code, 'DUPLICATE_SUBMISSION');

      // Advance clock past 120s window
      fakeNow += 121_000;
      const afterCooldown = await processContactSubmission(VALID_PAYLOAD, '198.51.100.33', {
        env: { ...VALID_BASE_ENV, CONTACT_SEND_ACK: 'false' },
        guard,
        createTransport: () => ({
          sendMail: async (mail) => ({ accepted: [mail.to], rejected: [] }),
        }),
      });
      assert.equal(afterCooldown.httpStatus, 200);
    });

    await test('IP rate limit blocks 6th request with 429 and Retry-After', async () => {
      const guard = new ContactSubmissionGuard();
      const fastTransport = () => ({
        sendMail: async (mail) => ({ accepted: [mail.to], rejected: [] }),
      });

      for (let i = 1; i <= 5; i += 1) {
        const res = await processContactSubmission(
          {
            ...VALID_PAYLOAD,
            email: `user${i}@example.com`,
            subject: `Subject ${i}`,
          },
          '198.51.100.50',
          { env: { ...VALID_BASE_ENV, CONTACT_SEND_ACK: 'false' }, guard, createTransport: fastTransport }
        );
        assert.equal(res.httpStatus, 200);
      }

      const sixth = await processContactSubmission(
        {
          ...VALID_PAYLOAD,
          email: 'user6@example.com',
          subject: 'Subject 6',
        },
        '198.51.100.50',
        { env: VALID_BASE_ENV, guard, createTransport: fastTransport }
      );
      assert.equal(sixth.httpStatus, 429);
      assert.equal(sixth.body.code, 'RATE_LIMITED');
      assert.ok(sixth.retryAfterSeconds > 0);
    });

    await test('Per-email rate limit blocks 4th enquiry from same email across different IPs', async () => {
      const guard = new ContactSubmissionGuard();
      const fastTransport = () => ({
        sendMail: async (mail) => ({ accepted: [mail.to], rejected: [] }),
      });

      for (let i = 1; i <= 3; i += 1) {
        const res = await processContactSubmission(
          {
            ...VALID_PAYLOAD,
            subject: `Distinct inquiry ${i}`,
          },
          `198.51.100.${60 + i}`,
          { env: { ...VALID_BASE_ENV, CONTACT_SEND_ACK: 'false' }, guard, createTransport: fastTransport }
        );
        assert.equal(res.httpStatus, 200);
      }

      const fourth = await processContactSubmission(
        {
          ...VALID_PAYLOAD,
          subject: 'Distinct inquiry 4',
        },
        '198.51.100.69',
        { env: VALID_BASE_ENV, guard, createTransport: fastTransport }
      );
      assert.equal(fourth.httpStatus, 429);
      assert.equal(fourth.body.code, 'RATE_LIMITED');
    });

    // -----------------------------------------------------------------
    // Suite 6: Vercel API Handler Wrapper
    // -----------------------------------------------------------------
    console.log('\n6. Vercel /api/contact HTTP Handler Behavior');

    await test('Handler rejects GET with 405, supports OPTIONS 200, and returns 503 when SMTP env is unset', async () => {
      const createMockRes = () => {
        const state = { status: 0, headers: {}, body: null, ended: false };
        return {
          state,
          setHeader(k, v) {
            state.headers[k] = v;
          },
          status(code) {
            state.status = code;
            return {
              json(payload) {
                state.body = payload;
                return state;
              },
              end() {
                state.ended = true;
                return state;
              },
            };
          },
        };
      };

      const getRes = createMockRes();
      await contactHandler({ method: 'GET', headers: {} }, getRes);
      assert.equal(getRes.state.status, 405);
      assert.equal(getRes.state.headers['X-Content-Type-Options'], 'nosniff');

      const optRes = createMockRes();
      await contactHandler({ method: 'OPTIONS', headers: {} }, optRes);
      assert.equal(optRes.state.status, 200);
      assert.equal(optRes.state.ended, true);

      // Ensure local process.env does not hold SMTP creds for unconfigured test
      const savedEnv = {
        SMTP_HOST: process.env.SMTP_HOST,
        SMTP_PORT: process.env.SMTP_PORT,
        SMTP_SECURE: process.env.SMTP_SECURE,
        SMTP_USER: process.env.SMTP_USER,
        SMTP_PASS: process.env.SMTP_PASS,
      };
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_PORT;
      delete process.env.SMTP_SECURE;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;

      try {
        const postRes = createMockRes();
        await contactHandler(
          {
            method: 'POST',
            headers: { 'x-forwarded-for': '203.0.113.99' },
            body: VALID_PAYLOAD,
          },
          postRes
        );
        assert.equal(postRes.state.status, 503);
        assert.equal(postRes.state.body.code, 'SMTP_NOT_CONFIGURED');
        assert.equal(postRes.state.body.fallbackEmail, 'support@spiralworld.in');
      } finally {
        for (const [k, v] of Object.entries(savedEnv)) {
          if (v !== undefined) process.env[k] = v;
        }
      }
    });
  } finally {
    fs.rmSync(TEMP_OUT_DIR, { recursive: true, force: true });
  }

  console.log(`\nSummary: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error('Fatal test suite error:', err);
  fs.rmSync(TEMP_OUT_DIR, { recursive: true, force: true });
  process.exit(1);
});
