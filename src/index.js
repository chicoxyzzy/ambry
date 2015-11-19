const FIREFOX_ERROR_NAME = 'NS_ERROR_DOM_QUOTA_REACHED';
const IE8_ERROR_MAGIC_NUMBER = -2147024882;
const SCHEME_VERSION_FIELD_NAME = '__schemeVersion';

class StorageDummy {
  static isQuotaExceeded() {}
  setSchemeVersion() {}
  clear() {}
  prefixName() {}
  getItem() {}
  removeItem() {}
  setItem() {}
}

const subscribes = {};

class Storage extends StorageDummy {
  constructor({ storage, namespace, schemeVersion, clearOnExceed }) {
    super();
    this._storage = storage;
    this._prefix = namespace ? `${namespace}.` : '';
    this._clearOnExceed = clearOnExceed;
    this._schemeVersion = this.getItem(SCHEME_VERSION_FIELD_NAME);
    this.setSchemeVersion(schemeVersion);
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
  setSchemeVersion(version) {
    if (this._schemeVersion !== version) {
      this.clear();
      this.setItem(SCHEME_VERSION_FIELD_NAME, version);
    }
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
      this._storage.removeItem(this.prefixName(field));
    } catch (e) {
      console.warn(e);
    }
  }
  setItem(field, data) {
    try {
      this._storage.setItem(this.prefixName(field), JSON.stringify(data));
      return data;
    } catch (e) {
      if (Storage.isQuotaExceeded(e)) {
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
  // TODO make it possible to do multiple subscribes
  subscribe(fn) {
    subscribes[this._prefix] = fn;
  }
  unsubscribe() {
    delete subscribes[this._prefix];
  }
}

function isStorageAvailable(storage) {
  try {
    const test = 'test';
    storage.setItem(test, test);
    storage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
}

window.addEventListener('storage', ({ key, oldValue, newValue }) => {
  Object.keys(subscribes).forEach(prefix => {
    if (key.indexOf(prefix) === 0) {
      subscribes[prefix](
        key.replace(prefix, ''),
        // TODO warn if parsing fails
        JSON.parse(oldValue),
        JSON.parse(newValue)
      );
    }
  });
}, false);

export function createStorage({
  type = 'localStorage',
  namespace = null,
  schemeVersion = null,
  clearOnExceed = true,
  doNotThrow = true,
}) {
  const storage = window[type];
  if (storage && isStorageAvailable(storage)) {
    return new Storage({storage, schemeVersion, namespace, clearOnExceed});
  }
  if (doNotThrow) {
    console.warn(`WebStorages are not available in current environment.`);
    return new StorageDummy();
  }
  throw new Error(`WebStorages are not available in current environment.`);
}
