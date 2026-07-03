const PREFIX = 'secure.';

async function getItemAsync(key) {
  return localStorage.getItem(PREFIX + key);
}

async function setItemAsync(key, value) {
  localStorage.setItem(PREFIX + key, value);
}

async function deleteItemAsync(key) {
  localStorage.removeItem(PREFIX + key);
}

function getItem(key) {
  return localStorage.getItem(PREFIX + key);
}

module.exports = {
  getItemAsync,
  setItemAsync,
  deleteItemAsync,
  getItem,
  AFTER_FIRST_UNLOCK: 0,
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 0,
};
