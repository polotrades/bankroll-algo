// api/verify-password.js
// Checks if entered password is member or admin level

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'No password provided' });

  if (password === process.env.ADMIN_PASSWORD) {
    return res.status(200).json({ role: 'admin' });
  }

  if (password === process.env.MEMBER_PASSWORD) {
    return res.status(200).json({ role: 'member' });
  }

  return res.status(401).json({ error: 'Invalid password' });
}
