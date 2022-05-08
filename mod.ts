import { nanoid } from "https://deno.land/x/nanoid@v3.0.0/mod.ts";

const decoder = new TextDecoder();

interface ExecuteResult {
  success: boolean;
  code: number;
  stdout: string;
  stderr: string;
}

class Connection {
  host: string;
  id: string;
  sshOptions: string[];

  constructor(host: string) {
    this.host = host;
    this.id = nanoid();
    this.sshOptions = [
      "-o",
      "ControlMaster=auto",
      "-o",
      `ControlPath=/tmp/${this.id}.sock`,
    ];
  }

  async preconnect(): Promise<void> {
    await Deno.run({
      cmd: ["ssh", ...this.sshOptions, this.host, "-fNT"],
    }).status();

    await this._findPID();
  }

  execute(command: string): ExecuteResult {
    const {
      stdout: rawStdout,
      stderr: rawStderr,
      status,
    } = Deno.spawnSync("ssh", {
      args: [...this.sshOptions, this.host, command],
    });

    const stdout = decoder.decode(rawStdout);
    const stderr = decoder.decode(rawStderr);
    const code = status.code;
    const success = status.success;

    return { stdout, stderr, code, success };
  }

  upload(from: string, to: string): boolean {
    const { status } = Deno.spawnSync("scp", {
      args: [...this.sshOptions, from, `${this.host}:${to}`],
    });

    return status.success
  }

  download(from: string, to: string): boolean {
    const { status } = Deno.spawnSync("scp", {
      args: [...this.sshOptions, `${this.host}:${to}`, from],
    });

    return status.success
  }

  test(cond: string): boolean {
    const { status } = Deno.spawnSync("ssh", {
      args: [
        ...this.sshOptions,
        this.host,
        "/bin/sh",
        "-c",
        JSON.stringify(cond),
      ],
    });

    const { success } = status;

    return success;
  }

  async _findPID(): Promise<number | undefined> {
    const cmd = Deno.run({ cmd: ["pgrep", "-f", this.id], stdout: "piped" });

    const status = await cmd.status();

    if (!status.success) {
      console.log(status);
      return;
    }

    return Number(decoder.decode(await cmd.output()));
  }

  async close() {
    const pid = await this._findPID();

    if (!pid) {
      return;
    }

    Deno.kill(pid, "SIGKILL");
  }
}

interface OnCallbackParameters {
  execute: (cmd: string) => ExecuteResult;
  download: (from: string, to: string) => void;
  upload: (from: string, to: string) => void;
  test: (cond: string) => boolean;
  sshOptions: string[];
}

export const on = async (
  host: string,
  cb: (params: OnCallbackParameters) => Promise<void>,
  sshOptions?: string[],
) => {
  const conn = new Connection(host);

  if (sshOptions) {
    conn.sshOptions = sshOptions;
  }

  await conn.preconnect();

  await Promise.resolve(cb({
    execute: conn.execute.bind(conn),
    upload: conn.upload.bind(conn),
    download: conn.download.bind(conn),
    test: conn.test.bind(conn),
    sshOptions: conn.sshOptions,
  }));

  await conn.close();
};
