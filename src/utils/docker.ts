import Docker from "dockerode";

const docker = new Docker({ socketPath: "/var/run/docker.sock" });
const container = docker.getContainer("mailserver");

export interface Account {
  email: string;
  used: string;
  capacity: string;
  percentage: string;
  id?: number;
}

export const listAccountsFromDocker = async (): Promise<Account[]> => {
  return new Promise((resolve, reject) => {
    container.exec(
      {
        Cmd: ["setup", "email", "list"],
        AttachStdout: true,
        AttachStderr: true,
      },
      (err, exec) => {
        if (err || !exec) return reject(err || new Error("Exec is undefined"));
        exec.start({}, (err, stream) => {
          if (err || !stream) return reject(err || new Error("Exec stream is undefined"));
          let output = "";
          stream.on("data", (chunk: Buffer) => (output += chunk.toString()));
          stream.on("end", () => {
            const regex = /\*\s*(\S+)\s*\(\s*([^\/]+?)\s*\/\s*([^)]+?)\s*\)\s*\[(\d+)%]/g;
            const accounts = [...output.matchAll(regex)].map((match) => ({
              email: match[1],
              used: match[2].trim() === "~" ? "Unlimited" : match[2].trim(),
              capacity: match[3].trim() === "~" ? "Unlimited" : match[3].trim(),
              percentage: match[4],
            }));
            resolve(accounts);
          });
        });
      }
    );
  });
};

export const getExecStream = (exec: Docker.Exec): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    exec.start({}, (err, stream) => {
      if (err || !stream) {
        reject(err || new Error("Exec stream is undefined"));
      } else {
        let output = "";
        stream.on("data", (chunk: Buffer) => {
          output += chunk.toString();
        });
        stream.on("end", () => resolve(output));
      }
    });
  });
};

export const containerExec = async (cmd: string[]) => {
  const exec = await container.exec({
    Cmd: cmd,
    AttachStdout: true,
    AttachStderr: true,
  });
  return getExecStream(exec);
};