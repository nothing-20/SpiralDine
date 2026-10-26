import fs from 'fs';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';

const env = fs.readFileSync('.env', 'utf-8');
const envVars = {};
env.split('\n').forEach(l => {
  const m = l.match(/^([^=]+)=(.*)$/);
  if (m) envVars[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
});

const app = getApps().length ? getApps()[0] : initializeApp({
  apiKey: envVars.VITE_FIREBASE_API_KEY,
  projectId: envVars.VITE_FIREBASE_PROJECT_ID
});
const db = getFirestore(app);

async function run() {
  const uDoc = await getDoc(doc(db, 'users', 'Wj0Yh4RYsQcH9FrVToP8BScZKEE3'));
  console.log('User doc Wj0Yh4RYsQcH9FrVToP8BScZKEE3:', uDoc.exists() ? uDoc.data() : 'NOT FOUND');
  const restUsers = await getDocs(collection(db, 'restaurants', 'spiral-restaurant-ilpc', 'users'));
  console.log('restUsers size:', restUsers.size);
  restUsers.forEach(d => console.log('restUser:', d.id, d.data()));
  const allUsers = await getDocs(collection(db, 'users'));
  console.log('all users:');
  allUsers.forEach(d => console.log(d.id, 'email:', d.data().email, 'name:', d.data().name, 'role:', d.data().role, 'tenantId:', d.data().tenantId));
}
run().catch(console.error);
