// GitHub Pages: Die Vorschau bekommt einen eigenen Unterpfad, lokal und live bleibt /valet.
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    baseUrl: process.env.VALET_BASE_URL || '/valet',
  },
});
