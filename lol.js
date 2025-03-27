// JavaScript equivalent of the Python matrix multiplication code

// Create matrices with random values
const n = 1024;

const a = Array(n).fill().map(() => Array(n).fill().map(() => Math.random()));

const b = Array(n).fill().map(() => Array(n).fill().map(() => Math.random()));

// Initialize result matrix with zeros
const c = Array(n).fill().map(() => Array(n).fill(0));

// Perform matrix multiplication and time it
const start = performance.now();

for (let i = 0; i < n; i++) {
  for (let j = 0; j < n; j++) {
    for (let k = 0; k < n; k++) {
      c[i][j] += a[i][k] * b[k][j];
    }
  }
}

const duration = (performance.now() - start) / 1000; // Convert to seconds
console.log(duration);
