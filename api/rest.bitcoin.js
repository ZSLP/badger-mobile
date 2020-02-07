// @flow

// Communicate directly with the REST api.

const API = `https://rest.zslp.org/v2`;

const getBlockCountURL = `${API}/blockchain/getBlockCount`;

const getCurrentBlockheight = async () => {
  try {
    const req = await fetch(getBlockCountURL);
    const resp = await req.json();
    return resp;
  } catch (e) {
    console.warn(e);
    throw e;
  }
};

export { getCurrentBlockheight };
