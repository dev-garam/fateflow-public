import fg from 'fast-glob';

const files = await fg(['samples/server/**/*'], {
  onlyFiles: true,
  ignore: ['node_modules/**'],
});

files.sort().forEach((file) => console.log(file));
