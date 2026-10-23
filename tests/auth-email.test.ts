import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST as signup } from "../src/app/api/auth/signup/route";
import { POST as login } from "../src/app/api/auth/login/route";
import { POST as forgot } from "../src/app/api/auth/forgot-password/route";
import { POST as reset } from "../src/app/api/auth/reset-password/route";
import { POST as verify } from "../src/app/api/auth/verify-email/route";
import { POST as resend } from "../src/app/api/auth/verify-email/resend/route";
import { createResetToken, createSession } from "../src/lib/session";
import { hashPassword } from "../src/lib/password";
import { store } from "../src/lib/store";
import {POST as enroll} from '../src/app/api/auth/verify-email/enroll/route';
import {checkEmailDomain,localAuthLinks,requireEmailDelivery} from '../src/lib/signup-policy';
import {AWSNotifier} from '../src/lib/notifications';
import {sendVerificationEmail} from '../src/lib/email-verification';

process.env.AUTOVISION_DEPLOYMENT_MODE = "saas";
process.env.AUTOVISION_SESSION_SECRET = "test-secret-test-secret-test-secret";
const secret = process.env.AUTOVISION_SESSION_SECRET;
const post = (path: string, body: unknown, cookie?: string) => new NextRequest(`http://localhost${path}`, { method: "POST", headers: { "content-type": "application/json", host: "localhost", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
const password = "long-enough-pass";
const tokenOf = (link: string) => new URL(link).searchParams.get("token");
const account = (username: string, email: string, next?: string) => signup(post("/api/auth/signup", { username, displayName: username, email, password, next }));

test("signup requires an email, stores it normalized and unverified, and starts no session", async () => {
  assert.equal((await signup(post("/api/auth/signup", { username: "noemail", displayName: "No Email", password }))).status, 400);
  const res = await account("withemail", " Person@Example.COM ");
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.status, "verification-sent");
  assert.match(body.verifyLink, /^http:\/\/localhost\/login\/verify-email\?token=/);
  assert.equal(res.cookies.get("autovision_session"), undefined);
  const user = await store.userByName("withemail");
  assert.equal(user?.email, "person@example.com");
  assert.equal(user?.emailVerified, false);
});

test("an email can be claimed once, also when signups race", async () => {
  assert.equal((await account("dupe-a", "PERSON@example.com")).status, 409, "case-insensitive duplicate");
  const raced = await Promise.all(["race-a", "race-b", "race-c"].map(name => account(name, "race@example.com")));
  assert.deepEqual(raced.map(r => r.status).sort(), [201, 409, 409]);
  assert.equal((await Promise.all(["race-a", "race-b", "race-c"].map(n => store.userByName(n)))).filter(Boolean).length, 1, "losers leave no account behind");
  const winner = (await Promise.all(["race-a", "race-b", "race-c"].map(n => store.userByName(n)))).find(Boolean)!;
  await store.deleteUser(winner.id);
  assert.equal((await account("race-after-delete", "race@example.com")).status, 201, "deleting the account releases the address");
});

test("unverified accounts cannot sign in; opening the link signs them in once and returns to their page", async () => {
  const { verifyLink } = await (await account("fromdevice", "d@example.com", "/settings/billing")).json();
  assert.equal(new URL(verifyLink).searchParams.get("next"), "/settings/billing");
  const blocked = await login(post("/api/auth/login", { username: "fromdevice", password }));
  assert.equal(blocked.status, 403);
  assert.equal((await blocked.json()).unverified, true);
  assert.equal((await login(post("/api/auth/login", { username: "fromdevice", password: "wrong-password!" }))).status, 401, "the hint only follows a correct password");

  const first = await verify(post("/api/auth/verify-email", { token: tokenOf(verifyLink), next: "/settings/billing" }));
  assert.deepEqual(await first.json(), { redirect: "/settings/billing" });
  assert.ok(first.cookies.get("autovision_session")?.value, "verifying signs the user in");
  assert.equal((await store.userByName("fromdevice"))?.emailVerified, true);
  assert.equal((await login(post("/api/auth/login", { username: "fromdevice", password }))).status, 200);

  const again = await verify(post("/api/auth/verify-email", { token: tokenOf(verifyLink), next: "/settings/billing" }));
  assert.deepEqual(await again.json(), { redirect: "/login?verify=done&next=%2Fsettings%2Fbilling" });
  assert.equal(again.cookies.get("autovision_session"), undefined, "an old link is not a reusable login");
});

test("hostile destinations are dropped and another user's open session is kept", async () => {
  const { verifyLink } = await (await account("hostile", "h@example.com", "https://evil.example")).json();
  assert.equal(new URL(verifyLink).searchParams.get("next"), null);
  const other = await createSession({ id: "someone-else", username: "someone", role: "admin", orgId: "x", expiresAt: Date.now() + 60000 }, secret);
  const res = await verify(post("/api/auth/verify-email", { token: tokenOf(verifyLink), next: "//evil.example" }, `autovision_session=${other}`));
  assert.deepEqual(await res.json(), { redirect: "/dashboard" });
  assert.equal(res.cookies.get("autovision_session"), undefined);
  assert.equal((await store.userByName("hostile"))?.emailVerified, true);
});

test("resend waits out Osirus's cooldown with the remaining time, and answers the same for unknown or verified accounts", async () => {
  await account("throttled", "t@example.com");
  const early = await resend(post("/api/auth/verify-email/resend", { username: "throttled" }));
  assert.equal(early.status, 409);
  assert.match((await early.json()).error, /^Please wait\. We can send the email again in 25 minutes$/);
  const user = (await store.userByName("throttled"))!;
  await store.putUser({ ...user, verificationSentAt: new Date(Date.now() - 26 * 60000).toISOString() });
  assert.match((await (await resend(post("/api/auth/verify-email/resend", { username: "throttled" }))).json()).verifyLink, /verify-email\?token=/);
  for (const username of ["nobody-here", "fromdevice"]) assert.deepEqual(await (await resend(post("/api/auth/verify-email/resend", { username }))).json(), { status: "ok" });
});

test("verification links are bound to the address and cannot be swapped with reset links", async () => {
  const { verifyLink } = await (await account("rebound", "old@example.com")).json();
  const user = (await store.userByName("rebound"))!;
  await store.putUser({ ...user, email: "new@example.com" });
  assert.equal((await verify(post("/api/auth/verify-email", { token: tokenOf(verifyLink) }))).status, 400);
  assert.equal((await store.userByName("rebound"))?.emailVerified, false);
  assert.equal((await reset(post("/api/auth/reset-password", { token: tokenOf(verifyLink), password: "another-long-pass" }))).status, 400);
  assert.equal((await verify(post("/api/auth/verify-email", { token: await createResetToken(user.id, secret) }))).status, 400);
});

test("accounts without explicit email verification cannot sign in", async () => {
  const org = await store.createOrganization({ name: "Legacy (Personal)", ownerId: "legacy-id", orgType: "personal" });
  const now = new Date().toISOString();
  await store.putUser({ id: "legacy-id", username: "legacy", displayName: "Legacy", status: "active", createdAt: now, updatedAt: now }, hashPassword(password));
  await store.putMembership({ id: "legacy-membership", orgId: org.id, userId: "legacy-id", role: "admin", status: "active", createdAt: now, updatedAt: now });
  assert.equal((await login(post("/api/auth/login", { username: "legacy", password }))).status, 403);
});

test("password reset mails the account email, not the username", async () => {
  const logs: string[] = [], log = console.log;
  console.log = (m: string) => { logs.push(m); };
  try {
    const res = await forgot(post("/api/auth/forgot-password", { username: "withemail" }));
    assert.match((await res.json()).resetLink, /\/login\/reset-password\?token=/);
  } finally { console.log = log; }
  assert.ok(logs.some(m => m.includes("Reset your AutoVision password")));
});

test('legacy accounts can attach an email only with the correct password and then must verify',async()=>{
 const loginResponse=await login(post('/api/auth/login',{username:'legacy',password}));
 assert.equal((await loginResponse.json()).emailRequired,true);
 assert.equal((await enroll(post('/api/auth/verify-email/enroll',{username:'legacy',password:'wrong',email:'legacy@example.com'}))).status,401);
 assert.equal((await store.userByName('legacy'))?.email,undefined);
 const response=await enroll(post('/api/auth/verify-email/enroll',{username:'legacy',password,email:'legacy@example.com'}));
 assert.equal(response.status,200);assert.equal(response.cookies.get('autovision_session'),undefined);
 const {verifyLink}=await response.json();
 assert.equal((await login(post('/api/auth/login',{username:'legacy',password}))).status,403);
 assert.equal((await verify(post('/api/auth/verify-email',{token:tokenOf(verifyLink)}))).status,200);
 assert.equal((await login(post('/api/auth/login',{username:'legacy',password}))).status,200);
 assert.equal((await enroll(post('/api/auth/verify-email/enroll',{username:'legacy',password,email:'other@example.com'}))).status,409);
});

test('domain blocking is optional and production SaaS cannot expose auth links or use mock delivery',()=>{
 process.env.AUTOVISION_BLOCKED_SIGNUP_DOMAINS='gmail.com,googlemail.com';
 assert.throws(()=>checkEmailDomain('a@gmail.com'));assert.throws(()=>checkEmailDomain('a@sub.gmail.com'));
 assert.doesNotThrow(()=>checkEmailDomain('a@example.com'));delete process.env.AUTOVISION_BLOCKED_SIGNUP_DOMAINS;
 assert.doesNotThrow(()=>checkEmailDomain('judge@gmail.com'));
 const previous=process.env.NODE_ENV;
 Object.assign(process.env,{NODE_ENV:'production',AUTOVISION_LOCAL_REPLAY:'true',AUTOVISION_NOTIFICATION_MODE:'log'});
 assert.equal(localAuthLinks(),false);assert.throws(requireEmailDelivery);
 if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;
 delete process.env.AUTOVISION_LOCAL_REPLAY;delete process.env.AUTOVISION_NOTIFICATION_MODE;
});

test('delivery failure keeps the account unverified and releases the send reservation for retry',async()=>{
 const now=new Date().toISOString(),user={id:'failed-delivery',username:'failed-delivery',displayName:'Failed delivery',email:'delivery@example.com',emailVerified:false,status:'active' as const,createdAt:now,updatedAt:now};
 await store.createUser(user,hashPassword(password));
 const previous=AWSNotifier.prototype.send;
 process.env.AUTOVISION_NOTIFICATION_MODE='aws';
 AWSNotifier.prototype.send=async()=>{throw Error('Synthetic delivery failure');};
 try{await assert.rejects(sendVerificationEmail(post('/api/auth/signup',{}),user),/Unable to send verification email/);assert.equal((await store.userById(user.id))?.emailVerified,false);assert.equal((await store.userById(user.id))?.verificationSentAt,undefined);}
 finally{AWSNotifier.prototype.send=previous;delete process.env.AUTOVISION_NOTIFICATION_MODE;}
});

test('plain signup accepts the browser null destination and sends a verification email without logging in',async()=>{
 const response=await signup(post('/api/auth/signup',{username:'plain-signup',displayName:'Plain signup',email:'plain-signup@example.com',password,next:null}));
 assert.equal(response.status,201);assert.equal(response.cookies.get('autovision_session'),undefined);
 assert.equal((await response.json()).status,'verification-sent');
 assert.equal((await store.userByName('plain-signup'))?.emailVerified,false);
});
