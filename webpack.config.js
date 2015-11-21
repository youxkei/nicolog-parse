module.exports = {
    entry: './src/main.js',
    output: {
        filename: 'cloud/main.js',
    },
    module: {
        loaders: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                loader: 'babel',
                query: {
                    presets: ['es2015'],
                },
            },
        ],
    },
}
