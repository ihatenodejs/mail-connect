const express = require('express');
const Docker = require('dockerode');

const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const app = express();
app.use(express.json());

function listAccounts() {
  return new Promise((resolve, reject) => {      
    const container = docker.getContainer('mailserver');
    container.exec({
      Cmd: ['setup', 'email', 'list'],
      AttachStdout: true,
      AttachStderr: true,
    }, (err, exec) => {
      if (err) {
        return reject(err);
      }
      
      exec.start((err, stream) => {
        if (err) {
          return reject(err);
        }
        
        let output = '';
        stream.on('data', (chunk) => {
          output += chunk.toString();
        });
        
        stream.on('end', () => {
          // Remove control characters
          const cleanOutput = output.replace(/[\u0000-\u001F]+/g, '');
          const regex = /\*\s*(\S+)\s*\(\s*([^\s\/]+)\s*\/\s*([^)]+)\s*\)\s*\[(\d+)%]/g;
          const accounts = [];
          
          for (const match of cleanOutput.matchAll(regex)) {
            accounts.push({
              email: match[1],
              used: match[2].trim() === '~' ? 'Unlimited' : match[2].trim(),
              capacity: match[3].trim() === '~' ? 'Unlimited' : match[3].trim(),
              percentage: match[4]
            });
          }
          
          resolve(accounts);
        });
      });
    });
  });
}

app.get('/list', (req, res) => {
  listAccounts()
    .then(accounts => res.json({ accounts }))
    .catch(err => res.status(500).json({ error: err.message }));
});

app.post('/add', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }
  
  const container = docker.getContainer('mailserver');
  container.exec({
    Cmd: ['setup', 'email', 'add', email, password],
    AttachStdout: true,
    AttachStderr: true,
  }, (err, exec) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    exec.start((err, stream) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      let output = '';
      stream.on('data', (chunk) => {
        output += chunk.toString();
      });
      
      stream.on('end', async () => {
        const cleanOutput = output.replace(/[\u0000-\u001F]+/g, '').trim();
        if (cleanOutput === '') {
          return res.json({ success: true });
        }
        
        try {
          const accounts = await listAccounts();
          const accountFound = accounts.find(acc => acc.email === email);
          if (accountFound) {
            return res.json({ success: true });
          } else {
            return res.json({ success: false, message: "Account creation failed" });
          }
        } catch (error) {
          return res.status(500).json({ error: error.message });
        }
      });
    });
  });
});

app.listen(3000, () => {
  console.log(`API listening on port 3000`);
});