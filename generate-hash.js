// generate-hash.js
import { hash as _hash } from 'bcryptjs';

async function generateHash() {
  const password = 'admin123';
  const hash = await _hash(password, 10);
  
  console.log('Password:', password);
  console.log('Hash:', hash);
  console.log('\n✅ Copy hash di atas dan paste ke SQL query');
}

generateHash();