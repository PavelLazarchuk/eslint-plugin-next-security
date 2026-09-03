import prettier from 'prettier';

/** @type {import('eslint-doc-generator').GenerateOptions} */
export default {
    ignoreConfig: ['flat/recommended', 'flat/strict', 'strict'],
    ruleDocTitleFormat: 'prefix-name',
    urlConfigs: 'https://github.com/PavelLazarchuk/eslint-plugin-next-security#setup',
    postprocess: async (content, path) => {
        const { ignored } = await prettier.getFileInfo(path, { ignorePath: '.prettierignore' });
        if (ignored) return content;

        const options = await prettier.resolveConfig(path);
        return prettier.format(content, { ...options, filepath: path });
    },
};
