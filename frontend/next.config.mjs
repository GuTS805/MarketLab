export default {
  // An alternate dev port needs its own cache/lock when an old dev server is still open.
  distDir: process.env.MARKETLAB_NEXT_DIST_DIR || '.next',
  agentRules: false,
};
