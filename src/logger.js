export default {
  info: (...args) => {
    try {
      console.log(new Date().toISOString(), "[INFO]", ...args);
    } catch {}
  },
  warn: (...args) => {
    try {
      console.warn(new Date().toISOString(), "[WARN]", ...args);
    } catch {}
  },
  error: (...args) => {
    try {
      console.error(new Date().toISOString(), "[ERROR]", ...args);
    } catch {}
  },
  debug: (...args) => {
    try {
      if (process.env.DEBUG && process.env.DEBUG !== "0") console.debug(new Date().toISOString(), "[DEBUG]", ...args);
    } catch {}
  }
};
