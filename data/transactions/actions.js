// @flow

import BigNumber from "bignumber.js";

import {
  GET_TRANSACTIONS_START,
  GET_TRANSACTIONS_SUCCESS,
  GET_TRANSACTIONS_FAIL
} from "./constants";

import {
  getHistoricalBchTransactions,
  getHistoricalSlpTransactions
} from "../../utils/balance-utils";

import { SLP } from "../../utils/slp-sdk-utils";

import { type Transaction } from "./reducer";
import { transactionsLatestBlockSelector } from "../selectors";
import { transactionsSelector } from "./selectors";

const getTransactionsStart = () => ({
  type: GET_TRANSACTIONS_START,
  payload: null
});

const getTransactionsSuccess = (transactions: any[], address: string) => ({
  type: GET_TRANSACTIONS_SUCCESS,
  payload: { transactions, address }
});

const getTransactionsFail = () => ({
  type: GET_TRANSACTIONS_FAIL,
  payload: null
});

const updateTransactions = (address: string, addressSlp: string) => {
  return async (dispatch: Function, getState: Function) => {
    if (!address || !addressSlp) return;

    const currentState = getState();
    const isUpdating = currentState.transactions.updating;
    const lastUpdate = currentState.transactions.lastUpdate || 0;

    const now = +new Date();

    // Short circuit if already processing, and it's been under 7 minutes
    if (isUpdating && now - lastUpdate < 1000 * 60 * 7) {
      return;
    }

    dispatch(getTransactionsStart());

    const latestBlock = transactionsLatestBlockSelector(currentState);
    const allTxIds = new Set(transactionsSelector(currentState).allIds);

    const transactionsBCH = getHistoricalBchTransactions(
      address,
      addressSlp,
      latestBlock
    );

    const transactionsSlp = getHistoricalSlpTransactions(
      address,
      addressSlp,
      latestBlock
    );

    const [bchHistory, slpHistory] = await Promise.all([
      transactionsBCH,
      transactionsSlp
    ]);

    const formattedTransactionsBCH: Transaction[] = [];

    for (let tx of bchHistory) {
      const block = tx.blk && tx.blk.i ? tx.blk.i : 0;
      const hash = tx.tx.h;

      // Unconfirmed and already parsed
      if (block === 0 && allTxIds.has(hash)) {
        continue;
      }

      const fromAddressesAll = tx.in
        .filter(input => input.e && input.e.a)
        .map(input => SLP.Address.toLegacyAddress(input.e.a));

      const fromAddresses = [...new Set(fromAddressesAll)];

      let fromAddress = fromAddresses.length === 1 ? fromAddresses[0] : null;

      // Prefer BCH address over SLP address
      if (!fromAddress) {
        if (fromAddresses.includes(address)) {
          fromAddress = address;
        } else if (fromAddresses.includes(addressSlp)) {
          fromAddress = addressSlp;
        }
      }

      const toAddressesAll = tx.out
        .filter(output => output.e && output.e.a)
        .map(output => SLP.Address.toLegacyAddress(output.e.a));

      const toAddresses = [...new Set(toAddressesAll)];

      // If one to address, use that.
      let toAddress = toAddresses.length === 1 ? toAddresses[0] : null;

      // Detect if it's from this wallet
      const fromUser =
        fromAddresses.includes(address) || fromAddresses.includes(addressSlp);

      // if from us, search for an external address
      if (fromUser) {
        toAddress = toAddresses.reduce((acc, curr) => {
          if (acc) return acc;
          return [address, addressSlp].includes(curr) ? null : curr;
        }, null);
      }

      if (!toAddress) {
        // else search for one of our addresses
        toAddress = toAddresses.includes(address)
          ? address
          : toAddresses.includes(addressSlp) && addressSlp;
      }

      const valueAddresses = toAddresses.filter(target => {
        return fromUser
          ? ![address, addressSlp].includes(target)
          : [address, addressSlp].includes(target);
      });

      // Determine value
      let value = 0;
      if (toAddress && fromAddress !== toAddress) {
        value = tx.out.reduce((accumulator, currentTx) => {
          if (
            currentTx.e &&
            currentTx.e.v &&
            valueAddresses.includes(SLP.Address.toLegacyAddress(currentTx.e.a))
          ) {
            accumulator += currentTx.e.v;
          }
          return accumulator;
        }, 0);
      }

      const formattedTx = {
        hash,
        txParams: {
          from: fromAddress,
          to: toAddress,
          fromAddresses,
          toAddresses,
          valueBch: value
        },
        time: tx.blk && tx.blk.t ? tx.blk.t * 1000 : new Date().getTime(),
        block,
        status: "confirmed",
        networkId: "mainnet"
      };

      formattedTx && formattedTransactionsBCH.push(formattedTx);

      // Allow the UI to render after each item computes.
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    const formattedTransactionsSLP: Transaction[] = [];
    for (let tx of slpHistory) {
      const block = tx.blk && tx.blk.i ? tx.blk.i : 0;
      const hash = tx.tx.h;

      // Unconfirmed and already parsed
      if (block === 0 && allTxIds.has(hash)) {
        continue;
      }

      const { slp } = tx;
      const inputs = tx.in;

      const { outputs, tokenIdHex, transactionType, decimals } = slp.detail;

      // All from addresses in cashaddr format
      const fromAddresses = inputs
        .filter(input => input.e && input.e.a)
        .map(input => {
          const addr = SLP.Address.toCashAddress(input.e.a);
          return addr;
        });

      // All to addresses in cashaddr format
      const toAddressesSLP = outputs
        .filter(output => output.address)
        .map(output => {
          const addr = SLP.Address.toCashAddress(output.address);
          return addr;
        });

      const toAddressesBCHAll = tx.out
        .filter(output => output.e && output.e.a)
        .map(output => SLP.Address.toLegacyAddress(output.e.a));

      const toAddressesBCH = [...new Set(toAddressesBCHAll)];

      const toAddresses = [...toAddressesSLP, ...toAddressesBCH];

      // Detect if it's from this wallet
      let fromUser = fromAddresses.reduce((acc, curr) => {
        if (acc) return acc;
        return [address, addressSlp].includes(curr);
      }, false);

      let fromAddress = fromAddresses.length === 1 ? fromAddresses[0] : null;

      // If sending SLP, show from SLP address over the BCH address
      if (!fromAddress) {
        if (fromAddresses.includes(addressSlp)) {
          fromAddress = addressSlp;
        } else if (fromAddresses.includes(address)) {
          fromAddress = address;
        }
      }

      let toAddress = null;

      // if from us, search for an external address
      if (fromUser) {
        toAddress = toAddresses.reduce((acc, curr) => {
          if (acc) return acc;
          return [address, addressSlp].includes(curr) ? null : curr;
        }, null);
      } else {
        // else search for one of our addresses
        toAddress = toAddresses.includes(addressSlp)
          ? addressSlp
          : toAddresses.includes(address) && address;
      }

      // Else from and to us?
      if (fromUser && !toAddress) {
        // Change to false so these appear as received
        fromUser = false;
        toAddress = toAddresses.includes(addressSlp)
          ? addressSlp
          : toAddresses.includes(address) && address;
      }

      // Determine SLP value
      let value = new BigNumber(0);
      if (toAddress && fromAddress !== toAddress) {
        value = outputs.reduce((accumulator, currentValue) => {
          if (currentValue.address && currentValue.amount) {
            const outputAddress = SLP.Address.toCashAddress(
              currentValue.address
            );
            if (outputAddress === toAddress) {
              accumulator = accumulator.plus(
                new BigNumber(currentValue.amount)
              );
            }
          }
          return accumulator;
        }, new BigNumber(0));
      }

      const valueAddresses = fromUser
        ? toAddresses.filter(target => ![address, addressSlp].includes(target))
        : toAddresses.filter(target => [address, addressSlp].includes(target));

      // Determine BCH value
      let bchValue = 0;
      if (toAddress && fromAddress !== toAddress) {
        bchValue = tx.out.reduce((accumulator, currentTx) => {
          if (
            currentTx.e &&
            currentTx.e.v &&
            valueAddresses.includes(
              SLP.Address.toLegacyAddress(currentTx.e.a)
            ) &&
            currentTx.e.v !== 546
          ) {
            accumulator += currentTx.e.v;
          }
          return accumulator;
        }, 0);
      }

      const formattedTx = {
        hash,
        txParams: {
          from: fromAddress,
          to: toAddress,
          fromAddresses,
          toAddresses,
          valueBch: bchValue,
          transactionType,
          sendTokenData: {
            tokenProtocol: "slp",
            tokenId: tokenIdHex,
            valueToken: value.toFixed(decimals)
          }
        },
        time: tx.blk && tx.blk.t ? tx.blk.t * 1000 : new Date().getTime(),
        block,
        status: "confirmed",
        networkId: "mainnet"
      };

      formattedTx && formattedTransactionsSLP.push(formattedTx);

      // Allow the UI to render after each item computes.
      await new Promise(resolve => setTimeout(resolve, 60));
    }

    const formattedTransactionsNew = [
      ...formattedTransactionsBCH,
      ...formattedTransactionsSLP
    ];

    dispatch(getTransactionsSuccess(formattedTransactionsNew, address));
  };
};

export { updateTransactions };
