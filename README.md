# deno-sshkit

A copycat of ruby's [sshkit](https://github.com/capistrano/sshkit) DSL for deno. Allows to run commands on remote servers with typescript.

## Requirements

This module uses unstable API [spawnSync](https://doc.deno.land/deno/unstable/~/Deno.spawnSync) so it requires `--unstable` flag.

## Example

```ts
import { on } from "https://deno.land/x/deno_sshkit/mod.ts";

on("example.com", ({ execute, test }) => {
  if (test("[ -f somefile.txt ]") {
    execute("rm -rf somefile.txt");
  }

  const files = execute("ls -l");

  console.log(files);
});
```
