// Node's Windows shutdown can race pending fetch handles after prerendering.
// Yield briefly before the CLI's explicit exit; retain its exact exit status.
// https://github.com/nodejs/node/issues/58091
if (process.platform === 'win32') {
  const exit = process.exit.bind(process);
  process.exit = code => {
    const status = code ?? process.exitCode ?? 0;
    setTimeout(() => exit(status), 300);
  };
}
process.argv = [process.argv[0], 'vinext', 'build'];
await import('../node_modules/vinext/dist/cli.js');
