module.exports = {
    'extends': '../../.eslintrc-web.js',
    'overrides': [
        {
            'files': ['SimpleCubeWorker.js'],
            'parserOptions':
            {
                'sourceType': 'module'
            }
        }
    ],
};
