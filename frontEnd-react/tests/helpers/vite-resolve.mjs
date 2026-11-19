// The app is bundled by Vite, so its sources import siblings without an
// extension ('./useWalletStore'). Node needs the extension spelled out.
// Import this module before importing any app source that relies on that.
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && context.parentURL?.includes('/frontEnd-react/src/')) {
      const candidate = new URL(specifier + '.js', context.parentURL);
      if (!/\.\w+$/.test(specifier) && existsSync(fileURLToPath(candidate))) {
        return nextResolve(candidate.href, context);
      }
    }
    return nextResolve(specifier, context);
  }
});
