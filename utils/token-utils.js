// @flow

import makeBlockie from "ethereum-blockies-base64";

import WhoopassStew from "../assets/images/token-icons/aad4f100e82f2b5c842827f20b20d2ec9d62d155ca7ee75c3e4fed9f62ef0ad7.png";

import BitcoinCashImage from "../assets/images/icon.png";

const tokenIdImageMap = {
  aad4f100e82f2b5c842827f20b20d2ec9d62d155ca7ee75c3e4fed9f62ef0ad7: WhoopassStew
};

let blockieCache = {};

const getTokenImage = (tokenId: ?string) => {
  if (!tokenId) {
    return BitcoinCashImage;
  }
  if (tokenIdImageMap[tokenId]) {
    return tokenIdImageMap[tokenId];
  }

  let blockie = blockieCache[tokenId];
  if (!blockie) {
    const newBlockie = makeBlockie(tokenId);
    blockieCache = { ...blockieCache, [tokenId]: newBlockie };
    blockie = newBlockie;
  }
  const imageSource = { uri: blockie };

  return imageSource;
};
export { tokenIdImageMap, getTokenImage };
