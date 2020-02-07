// @flow

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { connect } from "react-redux";
import { NavigationEvents } from "react-navigation";
import styled from "styled-components";
import {
  Clipboard,
  Image,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from "react-native";
import BigNumber from "bignumber.js";

import useBlockheight from "../hooks/useBlockheight";

import {
  getAddressSelector,
  getAddressSlpSelector
} from "../data/accounts/selectors";
import {
  balancesSelector,
  transactionsActiveAccountSelector,
  type Balances
} from "../data/selectors";
import { spotPricesSelector, currencySelector } from "../data/prices/selectors";
import { tokensByIdSelector } from "../data/tokens/selectors";
import { isUpdatingTransactionsSelector } from "../data/transactions/selectors";

import { type Transaction } from "../data/transactions/reducer";
import { type TokenData } from "../data/tokens/reducer";

import { formatAmount } from "../utils/balance-utils";
import { addressToSlp } from "../utils/account-utils";
import { getTokenImage } from "../utils/token-utils";
import { type CurrencyCode } from "../utils/currency-utils";

import { T, H1, H2, Spacer, Button } from "../atoms";
import { TransactionRow } from "../components";

const TransactionArea = styled(View)`
  border-top-width: ${StyleSheet.hairlineWidth};
  border-top-color: ${props => props.theme.fg700};
  position: relative;
`;

const ButtonGroup = styled(View)`
  flex-direction: row;
  justify-content: space-around;
`;

const ExplorerRow = styled(View)`
  padding: 10px 16px;
`;

const IconImage = styled(Image)`
  width: 64;
  height: 64;
  border-radius: 32;
  overflow: hidden;
`;

const IconArea = styled(View)`
  align-items: center;
  justify-content: center;
`;

type Props = {
  address: string,
  addressSlp: string,
  balances: Balances,
  spotPrices: any,
  fiatCurrency: CurrencyCode,
  navigation: { navigate: Function, state: { params: any } },
  tokensById: { [tokenId: string]: TokenData },
  updateTransactions: Function,
  transactions: Transaction[],
  isUpdatingTransactions: boolean
};

const WalletDetailScreen = ({
  address,
  addressSlp,
  balances,
  navigation,
  tokensById,
  spotPrices,
  fiatCurrency,
  transactions,
  updateTransactions,
  isUpdatingTransactions
}: Props) => {
  const { tokenId } = navigation.state.params;
  const token = tokensById[tokenId];

  const [simpleledgerAddress, setSimpleledgerAddress] = useState(addressSlp);
  const [notifyCopyTokenId, setNotifyCopyTokenId] = useState(false);

  const blockheight = useBlockheight();

  const convertToSimpleLedger = useCallback(async targetAddress => {
    const simpleLedger = await addressToSlp(targetAddress);
    setSimpleledgerAddress(simpleLedger);
    return simpleLedger;
  }, []);

  useEffect(() => {
    convertToSimpleLedger(addressSlp);
  }, [addressSlp, convertToSimpleLedger]);

  const isBCH = !tokenId;
  const name = isBCH ? "Zclassic" : token ? token.name : "--------";
  const ticker = isBCH ? "ZCL" : token ? token.symbol : "---";
  const decimals = isBCH ? 8 : token ? token.decimals : null;
  const amount = isBCH
    ? balances.satoshisAvailable
    : balances.slpTokens[tokenId];

  const imageSource = useMemo(() => getTokenImage(tokenId), [tokenId]);

  // let fiatAmount = null;
  // if (isBCH) {
  //   fiatAmount = computeFiatAmount(amount, spotPrices, fiatCurrency, "bch");
  // } else {
  //   fiatAmount = computeFiatAmount(amount, spotPrices, fiatCurrency, tokenId);
  // }
  // const fiatDisplay = isBCH
  //   ? formatFiatAmount(fiatAmount, fiatCurrency, tokenId || "bch")
  //   : null;

  const explorerUrl = isBCH
    ? `https://explorer.zcl.zeltrez.io/address/${address}`
    : `https://explorer.zslp.org/#address/${simpleledgerAddress}`;

  const amountFormatted = formatAmount(amount, decimals);
  let [amountWhole, amountDecimal] = (amountFormatted &&
    amountFormatted.split(".")) || [null, null];

  amountDecimal =
    amountDecimal && [...amountDecimal].every(v => v === "0")
      ? null
      : amountDecimal;

  return (
    <SafeAreaView>
      <NavigationEvents
        onWillBlur={() => {
          setNotifyCopyTokenId(false);
        }}
      />
      <ScrollView style={{ height: "100%" }}>
        <View>
          <Spacer small />
          <H1 center>{name}</H1>
          {tokenId && (
            <TouchableOpacity
              onPress={() => {
                Clipboard.setString(tokenId);
                setNotifyCopyTokenId(true);
              }}
            >
              <T size="tiny" center>
                {tokenId}
              </T>
            </TouchableOpacity>
          )}
          {notifyCopyTokenId && (
            <>
              <Spacer minimal />
              <T center size="small" type="primary">
                Token ID copied to clipboard
              </T>
            </>
          )}
          <Spacer small />
          <IconArea>
            <IconImage source={imageSource} />
          </IconArea>

          <Spacer />
          <T center>Balance</T>
          <H1 center>
            {amountWhole}
            {amountDecimal ? <H2>.{amountDecimal}</H2> : null}
          </H1>
          {/* {fiatDisplay && (
            <T center type="muted">
              {fiatDisplay}
            </T>
          )} */}
          <Spacer />
          <ButtonGroup>
            <Button
              onPress={() =>
                navigation.navigate("RequestSetup", { symbol: ticker, tokenId })
              }
              text="Request"
            />
            <Button
              onPress={() => navigation.navigate("SendSetup", { tokenId })}
              text="Send"
            />
          </ButtonGroup>
          <Spacer />
        </View>
        <Spacer small />
        <T
          style={{ marginLeft: 16, marginBottom: 5 }}
          size="small"
          type="muted"
        >
          Transaction History (max 30)
        </T>
        <TransactionArea>
          {transactions.map(tx => {
            const { hash, txParams, time, block } = tx;
            const {
              to,
              from,
              toAddresses,
              fromAddresses,
              transactionType,
              value,
              valueBch,
              sendTokenData
            } = txParams;

            let txValue = tokenId
              ? sendTokenData && sendTokenData.valueToken
              : valueBch;

            // Fallback to previous value
            if (txValue == null) txValue = value;

            let txType = null;
            // Determine transaction type, consider moving this code to action.?
            if ([address, addressSlp].includes(to)) {
              if ([address, addressSlp].includes(from)) {
                txType = "interwallet";
              } else {
                if (toAddresses.length > 30) {
                  txType = "payout";
                } else {
                  txType = "receive";
                }
              }
            } else if ([address, addressSlp].includes(from)) {
              txType = "send";
            } else {
              txType = "unrecognized";
            }

            const valueBigNumber = new BigNumber(txValue);
            const valueAdjusted = tokenId
              ? valueBigNumber
              : valueBigNumber.shiftedBy(decimals * -1);

            return (
              <TransactionRow
                confirmations={
                  block === 0
                    ? 0
                    : blockheight === 0
                    ? null
                    : blockheight - block + 1
                }
                key={hash}
                txId={hash}
                type={txType}
                timestamp={time}
                toAddress={to}
                toAddresses={toAddresses}
                fromAddresses={fromAddresses}
                fromAddress={from}
                symbol={ticker}
                tokenId={tokenId}
                amount={valueAdjusted.toString(10)}
              />
            );
          })}
          {isUpdatingTransactions && (
            <>
              <Spacer small />
              <T size="small" type="muted" center>
                Transaction history updating...
              </T>
              <T size="xsmall" type="muted2" center>
                This may take a few minutes.
              </T>
              <Spacer small />
            </>
          )}
          <ExplorerRow>
            <Spacer small />
            <T
              center
              type="muted2"
              onPress={() => Linking.openURL(explorerUrl)}
            >
              Full History
            </T>
            <Spacer small />
          </ExplorerRow>
        </TransactionArea>
      </ScrollView>
    </SafeAreaView>
  );
};

const mapStateToProps = (state, props) => {
  const tokenId = props.navigation.state.params.tokenId;
  const address = getAddressSelector(state);
  const addressSlp = getAddressSlpSelector(state);
  const balances = balancesSelector(state, address);
  const tokensById = tokensByIdSelector(state);
  const spotPrices = spotPricesSelector(state);
  const fiatCurrency = currencySelector(state);
  const transactionsAll = transactionsActiveAccountSelector(state);

  const isUpdatingTransactions = isUpdatingTransactionsSelector(state);

  const transactions = transactionsAll
    .filter(tx => {
      const txTokenId =
        tx.txParams.sendTokenData && tx.txParams.sendTokenData.tokenId;
      if (tokenId) {
        return tokenId === txTokenId;
      }
      return !txTokenId || tx.txParams.valueBch;
    })
    .slice(0, 30);

  return {
    address,
    addressSlp,
    balances,
    tokensById,
    transactions,
    spotPrices,
    fiatCurrency,
    isUpdatingTransactions
  };
};

const mapDispatchToProps = {};

export default connect(mapStateToProps, mapDispatchToProps)(WalletDetailScreen);
