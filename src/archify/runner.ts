import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import * as os from 'os';

export async function runArchify(ir: any, outPath: string): Promise<void> {
  // Write IR to a temporary JSON file
  const tempDir = os.tmpdir();
  const tempJsonPath = path.join(tempDir, `archify-ir-${Date.now()}.json`);
  fs.writeFileSync(tempJsonPath, JSON.stringify(ir, null, 2));

  // Determine path to vendored archify.mjs
  const archifyScriptPath = path.resolve(__dirname, '..', '..', 'vendor', 'archify', 'bin', 'archify.mjs');
  
  if (!fs.existsSync(archifyScriptPath)) {
    throw new Error(`Archify script not found at ${archifyScriptPath}. Did you run 'npm run setup-vendor'?`);
  }

  // We use `dataflow` because of our IR schema. 
  // Command: node bin/archify.mjs deliver architecture <in.json> <out.html> --quality showcase
  return new Promise((resolve, reject) => {
    const child = spawn('node', [
      archifyScriptPath,
      'deliver',
      'architecture',
      tempJsonPath,
      outPath,
      '--quality',
      'showcase'
    ], { stdio: 'inherit' });

    child.on('close', (code) => {
      // Clean up temp json
      if (fs.existsSync(tempJsonPath)) {
        fs.unlinkSync(tempJsonPath);
      }

      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Archify process exited with code ${code}`));
      }
    });
    
    child.on('error', (err) => {
      if (fs.existsSync(tempJsonPath)) {
        fs.unlinkSync(tempJsonPath);
      }
      reject(err);
    });
  });
}
