const FIREFOX_ERROR_NAME = 'NS_ERROR_DOM_QUOTA_REACHED';
const IE8_ERROR_MAGIC_NUMBER = -2147024882;
const SCHEME_VERSION_FIELD_NAME = '__schemeVersion';

class Storage {
  constructor({ type, namespace, schemeVersion, clearOnExceed }) {
    const storage = window[type];
    try {
      const test = 'test';
      storage.setItem(test, test);
      storage.removeItem(test);
    } catch (e) {
      throw new Error(`No storage of type ${type} available in this environment.`);
    }
    this._storage = storage;
    this._prefix = namespace ? `${namespace}.` : '';
    this._clearOnExceed = clearOnExceed;
    this._schemeVersion = this.getItem(SCHEME_VERSION_FIELD_NAME);
    this.setSchemeVersion(schemeVersion);
  }
  setSchemeVersion(version) {
    if (this._schemeVersion !== version) {
      this.clear();
      this.setItem(SCHEME_VERSION_FIELD_NAME, version);
    }
  }
  static isQuotaExceeded(e) {
    if (e) {
      if (e.code) {
        switch (e.code) {
        case 22:
          return true;
        case 1014:
          // Firefox
          return e.name === FIREFOX_ERROR_NAME;
        default:
          return false;
        }
      } else if (e.number === IE8_ERROR_MAGIC_NUMBER) {
        // Internet Explorer 8
        return true;
      }
    }
    return false;
  }
  clear() {
    try {
      this._storage.clear();
    } catch (e) {
      console.warn(e);
    }
  }
  prefixName(name) {
    return `${this._prefix}${name}`;
  }
  getItem(field) {
    try {
      return JSON.parse(this._storage.getItem(this.prefixName(field)));
    } catch (e) {
      console.warn(e);
      return {};
    }
  }
  removeItem(field) {
    try {
      JSON.parse(this._storage.removeItem(this.prefixName(field)));
    } catch (e) {
      console.warn(e);
    }
  }
  setItem(field, data) {
    try {
      this._storage.setItem(this.prefixName(field), JSON.stringify(data));
      return data;
    } catch (e) {
      if (this.isQuotaExceeded(e)) {
        console.warn('Quote is exceeded.');
        if (this._clearOnExceed) {
          console.warn('Clearing storage.');
          this.clear();
          this._storage.setItem(this.prefixName(field), JSON.stringify(data));
          return data;
        }
      }
    }
  }
}

function createStorage({ type = 'localStorage', namespace = null, schemeVersion = null, clearOnExceed = true }) {
  return new Storage({ type, schemeVersion, namespace, clearOnExceed });
}

export default createStorage;
