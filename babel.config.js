module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['module-resolver', {
        alias: { buffer: 'buffer' }
      }],
      'react-native-reanimated/plugin',
    ],
  };
};
