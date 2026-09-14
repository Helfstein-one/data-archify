const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);
  
  if (req.url === '/api/v1/dags/my_dag/tasks') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const data = fs.readFileSync(path.join(__dirname, 'airflow_mock.json'));
    res.end(data);
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(8080, () => {
  console.log('Mock Airflow API listening on port 8080');
});
