// @flow

import BigNumber from "bignumber.js";

import {
  currencyDecimalMap,
  currencySymbolMap,
  type CurrencyCode
} from "./currency-utils";
import { type Balances } from "../data/selectors";

import { SLP } from "./slp-sdk-utils";

const getHistoricalBchTransactions = async (
  address: string,
  addressSlp: string,
  latestBlock: number
) => {
  if (!address) {
    return [];
  }
  const query = {
    v: 3,
    q: {
      find: {
        $query: {
          $or: [
            {
              "in.e.a": address
            },
            {
              "out.e.a": address
            },
            {
              "in.e.a": addressSlp
            },
            {
              "out.e.a": addressSlp
            }
          ],
          "out.h1": {
            $ne: "534c5000"
          },
          "blk.i": {
            $not: {
              $lte: latestBlock
            }
          }
        },
        $orderby: {
          "blk.i": -1
        }
      },
      project: {
        _id: 0,
        "tx.h": 1,
        "in.i": 1,
        "in.e": 1,
        "out.i": 1,
        "out.e": 1,
        blk: 1
      },
      limit: 20
    }
  };
  try {
    const result = await SLP.BitDB.get(query);

    // combine confirmed and unconfirmed
    // errors = slpdb, error = REST rate limit
    let transactions = [];

    if (result.c) {
      transactions = [...transactions, ...result.c];
    }
    if (result.u) {
      transactions = [...transactions, ...result.u];
    }

    return transactions;
  } catch (e) {
    console.warn("Error while fetching from bitdb");
    console.warn(e);
    return [];
  }
};

const getHistoricalSlpTransactions = async (
  address: string,
  addressSlp: string,
  latestBlock: number
) => {
  if (!address) return [];
  const query = {
    v: 3,
    q: {
      find: {
        db: ["c", "u"],
        $query: {
          $or: [
            {
              "in.e.a": address
            },
            {
              "slp.detail.outputs.address": SLP.Address.toSLPAddress(address)
            },
            {
              "in.e.a": SLP.Address.toSLPAddress(addressSlp)
            },
            {
              "slp.detail.outputs.address": SLP.Address.toSLPAddress(addressSlp)
            }
          ],
          "slp.valid": true,
          "blk.i": {
            $not: {
              $lte: latestBlock
            }
          }
        },
        $orderby: {
          "blk.i": -1
        }
      },
      project: {
        _id: 0,
        "tx.h": 1,
        "in.i": 1,
        "in.e": 1,
        "out.e": 1,
        "out.a": 1,
        "slp.detail": 1,
        blk: 1
      },
      limit: 350
    }
  };

  let transactions = [];
  try {
    const result = await SLP.SLPDB.get(query);
    // combine confirmed and unconfirmed
    // errors = slpdb, error = REST rate limit

    if (result.c) {
      transactions = [...transactions, ...result.c];
    }
    if (result.u) {
      transactions = [...transactions, ...result.u];
    }
  } catch (e) {
    console.warn("Error while fetching from slpdb");
    console.warn(e);
  }

  return transactions;
};

const removeTrailingChars = (word: string, target: string) => {
  if (word.slice(-1) === target) {
    return removeTrailingChars(word.slice(0, -1), target);
  }
  return word;
};

const formatAmount = (
  amount: ?BigNumber,
  decimals: ?number,
  trimEnd?: boolean
): string => {
  if (decimals == null) {
    return "-.--------";
  }

  if (!amount) {
    return `-.`.padEnd(decimals + 2, "-");
  }

  let adjustDecimals = amount.shiftedBy(-1 * decimals).toFormat(decimals);
  if (trimEnd) {
    adjustDecimals = removeTrailingChars(adjustDecimals, "0");
    if (adjustDecimals.slice(-1) === ".") {
      adjustDecimals = adjustDecimals.slice(0, -1);
    }
  }
  return adjustDecimals;
};

const computeFiatAmount = (
  coinAmount: BigNumber,
  spotPrices: any,
  fiatCurrency: CurrencyCode,
  coin: string
): BigNumber => {
  const coinSpotPrice = spotPrices[coin];
  if (!coinSpotPrice) return null;
  const spotPrice = coinSpotPrice[fiatCurrency];
  if (!spotPrice) return null;
  const rate = spotPrice.rate;

  let amount = 0;
  if (coin === "bch") {
    const balance = coinAmount.shiftedBy(-1 * 8);
    amount = balance.times(rate);
  }
  return amount;
};

const formatFiatAmount = (
  amount: ?BigNumber,
  fiatCurrency: CurrencyCode,
  coin: string
) => {
  return amount && !amount.isNaN()
    ? `${currencySymbolMap[fiatCurrency]} ${amount.toFormat(
        currencyDecimalMap[fiatCurrency]
      )} ${fiatCurrency}`
    : `${currencySymbolMap[fiatCurrency]} -.-- ${fiatCurrency}`;
};

const formatAmountInput = (amount: string, maxDecimals: number): string => {
  const amountEnglish = amount.replace(",", ".");

  const validCharacters = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
  let decimalCount = 0;

  const valid = amountEnglish.split("").reduce((prev, curr, idx, array) => {
    // Only allow max 1 leading 0
    if (idx === 1 && curr === "0" && array[0] === "0") return prev;

    // Filter non-valid characters
    if (validCharacters.includes(curr)) return [...prev, curr];

    // Max of 1 decimal
    if (curr === "." && decimalCount === 0) {
      decimalCount++;
      return [...prev, curr];
    }
    return prev;
  }, []);

  // Add a 0 if first digit is a '.'
  const maybeZero = valid[0] && valid[0] === "." ? ["0", ...valid] : valid;

  // Restrict decimals
  const decimalIndex = maybeZero.indexOf(".");
  const decimalAdjusted =
    decimalIndex >= 0
      ? maybeZero.slice(0, decimalIndex + maxDecimals + 1)
      : maybeZero;

  return decimalAdjusted.join("");
};

export {
  computeFiatAmount,
  getHistoricalBchTransactions,
  getHistoricalSlpTransactions,
  formatAmount,
  formatAmountInput,
  formatFiatAmount
};
