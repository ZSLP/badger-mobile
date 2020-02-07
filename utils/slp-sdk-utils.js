// @flow

import SLPSDK from "slp-sdk";

// const SLP = new SLPSDK();

// Uncomment for local version
const SLP = new SLPSDK({ restURL: "https://rest.zslp.org/v2/" });

export { SLP };
