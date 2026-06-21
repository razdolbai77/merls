const cp = require('child_process');
const server = cp.spawn('node', ['../dist/src/cli.js', '--stdio']);
server.stdout.on('data', data => console.log('OUT:', data.toString()));
server.stderr.on('data', data => console.log('ERR:', data.toString()));
server.on('exit', code => console.log('EXIT:', code));

const msg = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    processId: process.pid,
    rootUri: null,
    capabilities: {}
  }
};
const json = JSON.stringify(msg);
server.stdin.write(`Content-Length: ${json.length}\r\n\r\n${json}`);
