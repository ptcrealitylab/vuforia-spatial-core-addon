import js from '@eslint/js';
import globals from 'globals';

export default [
    {
        ignores: [
            '**/dropzone.js',
            'interfaces/MIR100/index_old.js',
            'interfaces/robot',
            '**/*.min.js',
            'tools/machine-gltf/resources',
            'tools/motion/assets',
            'tools/motion/js',
            'tools/pushMe/resources',
            'tools/spatialDraw/resources',
            'tools/spatialAnalytics/resources',
            'tools/spatialSensor/resources',
            'tools/sphere/resources',
            'tools/path/js/THREE.MeshLine.js',
            'tools/path/thirdPartyCode',
            'tools/pathPoint/resources',
            'tools/path/resources',
        ],
    },
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2018,
            globals: {
                ...globals.node,
                ...globals.browser,
                Atomics: 'readonly',
                THREE: 'readonly',
                SharedArrayBuffer: 'readonly',
                // Constants from server's objectDefaultFiles/object.js and
                // related files
                Envelope: 'readonly',
                EnvelopeContents: 'readonly',
                LanguageInterface: 'readonly',
                SpatialInterface: 'readonly',
                ThreejsInterface: 'readonly',
                spatialObject: 'readonly',
            },
        },
        rules: {
            'indent': [
                'warn',
                4
            ],
            'linebreak-style': [
                'error',
                'unix'
            ],
            'quotes': [
                'warn',
                'single'
            ],
            'semi': [
                'warn',
                'always'
            ],
            'comma-spacing': [
                'warn', {before: false, after: true}
            ],
            'key-spacing': 'warn',
            'keyword-spacing': 'warn',
            'no-trailing-spaces': 'warn',
            'brace-style': ['warn', '1tbs', {allowSingleLine: true}],
            'space-before-blocks': 'warn',
            'space-infix-ops': 'warn',
            'no-prototype-builtins': 'off',
            'no-unused-vars': ['warn', {argsIgnorePattern: '^_', varsIgnorePattern: '^_'}],
            'no-redeclare': 'warn',
            'no-inner-declarations': 'warn',
            'no-extra-semi': 'warn',
        },
    }
];
