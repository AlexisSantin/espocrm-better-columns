import {buildGeneral} from 'espo-extension-tools';
import {rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

buildGeneral({
    extensionHook: () => {
        rmSync(fileURLToPath(new URL('./build/tmp/tests', import.meta.url)), {
            recursive: true,
            force: true,
        });
    },
});
