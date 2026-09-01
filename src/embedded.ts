import { ChildProcess, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer, get as httpGet } from 'node:http';
import { closeSync, existsSync, mkdirSync, openSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';

export interface EmbeddedCueMapOptions {
  /** Attach to an already-running engine instead of starting one. */
  url?: string;
  /** Explicit CueMap executable. CUEMAP_BIN is used when omitted. */
  binPath?: string;
  /** Preferred local port. A free port is selected if another service owns it. */
  port?: number;
  /** Capabilities that an attached or newly started engine must advertise. */
  requiredCapabilities?: string[];
  configPath?: string;
  apiKey?: string;
  startupTimeoutMs?: number;
  shutdownTimeoutMs?: number;
  env?: NodeJS.ProcessEnv;
  /** Engine stdout/stderr destination. Defaults to ~/.cuemap/server.log; false discards logs. */
  logPath?: string | false;
  logger?: (message: string) => void;
}

export interface EmbeddedCueMapConnection {
  url: string;
  owned: boolean;
}

const requireFromHere = createRequire(__filename);
const DEFAULT_PORT = 8735;
const DEFAULT_STARTUP_TIMEOUT_MS = 15_000;
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 5_000;

function defaultLogPath(options: EmbeddedCueMapOptions): string | undefined {
  if (options.logPath === false) return undefined;
  return options.logPath
    || options.env?.CUEMAP_LOG_PATH
    || process.env.CUEMAP_LOG_PATH
    || join(homedir(), '.cuemap', 'server.log');
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

interface EngineInspection {
  status: 'cuemap' | 'occupied' | 'closed';
  capabilities: string[];
}

async function inspectEngine(url: string, apiKey?: string): Promise<EngineInspection> {
  return await new Promise((resolve) => {
    const request = httpGet(
      `${normalizeUrl(url)}/`,
      { headers: apiKey ? { 'X-API-Key': apiKey } : undefined },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          if (body.length < 16_384) body += chunk;
        });
        response.on('end', () => {
          try {
            const value = JSON.parse(body) as { name?: unknown; capabilities?: unknown };
            resolve({
              status: value.name === 'CueMap Rust Engine' ? 'cuemap' : 'occupied',
              capabilities: Array.isArray(value.capabilities)
                ? value.capabilities.filter((item): item is string => typeof item === 'string')
                : [],
            });
          } catch {
            resolve({ status: 'occupied', capabilities: [] });
          }
        });
      }
    );
    request.setTimeout(750, () => request.destroy());
    request.on('error', () => resolve({ status: 'closed', capabilities: [] }));
  });
}

function requireCapabilities(
  url: string,
  inspection: EngineInspection,
  requiredCapabilities: string[] = []
): void {
  const missing = requiredCapabilities.filter(
    (capability) => !inspection.capabilities.includes(capability)
  );
  if (missing.length > 0) {
    throw new Error(
      `CueMap engine at ${url} is incompatible; missing capabilities: ${missing.join(', ')}. ` +
      'Stop the existing engine and restart it with the configured CueMap binary.'
    );
  }
}

async function findFreePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Could not allocate a local port for CueMap'));
        return;
      }
      const port = address.port;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

export function resolveCueMapBinary(explicitPath?: string): string {
  const configuredPath = explicitPath || process.env.CUEMAP_BIN;
  if (configuredPath) {
    if (!existsSync(configuredPath)) {
      throw new Error(`CueMap executable does not exist: ${configuredPath}`);
    }
    return configuredPath;
  }

  const packageName = `@cuemap-dev/engine-${process.platform}-${process.arch}`;
  try {
    const manifest = requireFromHere.resolve(`${packageName}/package.json`);
    const packageBin = join(dirname(manifest), 'bin');
    const candidates = process.platform === 'win32'
      ? [join(packageBin, 'cuemap'), join(packageBin, 'cuemap.exe')]
      : [join(packageBin, 'cuemap')];
    const binaryPath = candidates.find((candidate) => existsSync(candidate));
    if (binaryPath) return binaryPath;
  } catch {
    // The platform package is optional; PATH remains a valid installation mode.
  }

  const binaryName = process.platform === 'win32' ? 'cuemap.exe' : 'cuemap';
  const workspaceRoot = resolve(__dirname, '..', '..');
  const sourceBinaries = ['release', 'debug']
    .map((profile) => join(workspaceRoot, 'rust_engine', 'target', profile, binaryName))
    .filter((candidate) => existsSync(candidate))
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);
  if (sourceBinaries.length > 0) return sourceBinaries[0];

  return 'cuemap';
}

export class EmbeddedCueMap {
  private process?: ChildProcess;
  private readonly shutdownTimeoutMs: number;

  private constructor(
    public readonly connection: EmbeddedCueMapConnection,
    shutdownTimeoutMs: number,
    process?: ChildProcess
  ) {
    this.process = process;
    this.shutdownTimeoutMs = shutdownTimeoutMs;
  }

  get url(): string {
    return this.connection.url;
  }

  get owned(): boolean {
    return this.connection.owned;
  }

  static async start(options: EmbeddedCueMapOptions = {}): Promise<EmbeddedCueMap> {
    const startupTimeoutMs = options.startupTimeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS;
    const shutdownTimeoutMs = options.shutdownTimeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS;
    const logger = options.logger ?? (() => undefined);

    if (options.url) {
      const url = normalizeUrl(options.url);
      const inspection = await inspectEngine(url, options.apiKey);
      if (inspection.status !== 'cuemap') {
        throw new Error(`No CueMap engine is reachable at ${url}`);
      }
      requireCapabilities(url, inspection, options.requiredCapabilities);
      logger(`Attached to CueMap at ${url}`);
      return new EmbeddedCueMap({ url, owned: false }, shutdownTimeoutMs);
    }

    const preferredPort = options.port ?? DEFAULT_PORT;
    const preferredUrl = `http://127.0.0.1:${preferredPort}`;
    const preferredInspection = await inspectEngine(preferredUrl, options.apiKey);
    if (preferredInspection.status === 'cuemap') {
      requireCapabilities(preferredUrl, preferredInspection, options.requiredCapabilities);
      logger(`Attached to CueMap at ${preferredUrl}`);
      return new EmbeddedCueMap({ url: preferredUrl, owned: false }, shutdownTimeoutMs);
    }

    const port = preferredInspection.status === 'occupied' ? await findFreePort() : preferredPort;
    const url = `http://127.0.0.1:${port}`;
    const executable = resolveCueMapBinary(options.binPath);
    const args = ['start', '--port', String(port)];
    if (options.configPath) args.push('--config', options.configPath);

    logger(`Starting CueMap at ${url}`);
    const logPath = defaultLogPath(options);
    let logFileDescriptor: number | undefined;
    let stdio: 'ignore' | ['ignore', number, number] = 'ignore';
    if (logPath) {
      try {
        mkdirSync(dirname(logPath), { recursive: true });
        logFileDescriptor = openSync(logPath, 'a');
        stdio = ['ignore', logFileDescriptor, logFileDescriptor];
        logger(`CueMap engine logs: ${logPath}`);
      } catch (error) {
        logger(
          `Could not open CueMap engine log at ${logPath}; engine logs will be discarded: ${String(error)}`
        );
      }
    }

    let child: ChildProcess;
    try {
      // The Windows native package exposes a shebang Node wrapper next to the
      // .exe. Windows cannot spawn that wrapper directly, so invoke it via the
      // current Node runtime. A real .exe or PATH-resolved binary stays direct.
      const runThroughNode = process.platform === 'win32'
        && existsSync(executable)
        && extname(executable).toLowerCase() !== '.exe';
      const spawnExecutable = runThroughNode ? process.execPath : executable;
      const spawnArgs = runThroughNode ? [executable, ...args] : args;
      child = spawn(spawnExecutable, spawnArgs, {
        stdio,
        env: { ...process.env, ...options.env, CUEMAP_PORT: String(port) },
      });
    } finally {
      if (logFileDescriptor !== undefined) closeSync(logFileDescriptor);
    }
    let exitError: Error | undefined;
    child.once('error', (error) => {
      exitError = error;
    });
    child.once('exit', (code, signal) => {
      exitError ??= new Error(`CueMap exited before it became ready (code=${code}, signal=${signal})`);
    });

    const deadline = Date.now() + startupTimeoutMs;
    while (Date.now() < deadline) {
      if (exitError) throw exitError;
      const inspection = await inspectEngine(url, options.apiKey);
      if (inspection.status === 'cuemap') {
        try {
          requireCapabilities(url, inspection, options.requiredCapabilities);
        } catch (error) {
          child.kill('SIGTERM');
          throw error;
        }
        logger(`CueMap is ready at ${url}`);
        return new EmbeddedCueMap({ url, owned: true }, shutdownTimeoutMs, child);
      }
      await sleep(100);
    }

    child.kill('SIGTERM');
    throw new Error(`CueMap did not become ready within ${startupTimeoutMs}ms`);
  }

  async stop(): Promise<void> {
    const child = this.process;
    this.process = undefined;
    if (!child || child.exitCode !== null || child.signalCode !== null) return;

    child.kill('SIGTERM');
    const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
    const timedOut = sleep(this.shutdownTimeoutMs).then(() => 'timeout' as const);
    if (await Promise.race([exited.then(() => 'exited' as const), timedOut]) === 'timeout') {
      child.kill('SIGKILL');
      await exited;
    }
  }
}
