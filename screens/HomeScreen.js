// @flow

import React, { useEffect, useMemo } from "react";
import styled from "styled-components";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  SectionList,
  View,
  TouchableOpacity
} from "react-native";
import uuidv5 from "uuid/v5";

import { connect } from "react-redux";

import { T, H1, Spacer } from "../atoms";

import { CoinRowHeader, CoinRow } from "../components";

import { balancesSelector, type Balances } from "../data/selectors";
import {
  getAddressSelector,
  getAddressSlpSelector,
  getSeedViewedSelector
} from "../data/accounts/selectors";
import { tokensByIdSelector } from "../data/tokens/selectors";
import { spotPricesSelector, currencySelector } from "../data/prices/selectors";
import { doneInitialLoadSelector } from "../data/utxos/selectors";

import { type TokenData } from "../data/tokens/reducer";

import { updateTransactions } from "../data/transactions/actions";
import { updateUtxos } from "../data/utxos/actions";
import { updateTokensMeta } from "../data/tokens/actions";
import { updateSpotPrice } from "../data/prices/actions";

import {
  formatAmount,
  formatFiatAmount,
  computeFiatAmount
} from "../utils/balance-utils";
import { type CurrencyCode } from "../utils/currency-utils";

const SECOND = 1000;

// Same as the Panda namespace for now.  doesn't need to be unique here.
const HASH_UUID_NAMESPACE = "9fcd327c-41df-412f-ba45-3cc90970e680";

const BackupNotice = styled(TouchableOpacity)`
  border-color: ${props => props.theme.accent500};
  border-width: ${StyleSheet.hairlineWidth};
  border-radius: 4px;
  padding: 8px;
  background-color: ${props => props.theme.accent900};
  margin: 8px 16px;
`;

const NoTokensRow = styled(View)`
  padding: 10px 16px;
`;

const NoTokensFound = () => (
  <NoTokensRow>
    <T size="small" type="muted2">
      No ZSLP tokens in the vault yet
    </T>
  </NoTokensRow>
);

const InitialLoadCover = styled(View)`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  left: 0;
  background-color: ${props => props.theme.coverBg};
  height: 100%;
  width: 100%;
  z-index: 1;
  align-items: center;
  justify-content: center;
`;

type Props = {
  address: string,
  addressSlp: string,
  balances: Balances,
  initialLoadingDone: boolean,
  latestTransactionHistoryBlock: number,
  navigation: { navigate: Function },
  seedViewed: boolean,
  spotPrices: any,
  fiatCurrency: CurrencyCode,
  tokensById: { [tokenId: string]: TokenData },
  updateSpotPrice: Function,
  updateTokensMeta: Function,
  updateTransactions: Function,
  updateUtxos: Function
};

const HomeScreen = ({
  address,
  addressSlp,
  balances,
  initialLoadingDone,
  navigation,
  seedViewed,
  spotPrices,
  fiatCurrency,
  tokensById,
  updateSpotPrice,
  updateTokensMeta,
  updateTransactions,
  updateUtxos
}: Props) => {
  useEffect(() => {
    if (!address) return;
    // Update UTXOs on an interval
    updateUtxos(address, addressSlp);
    const utxoInterval = setInterval(
      () => updateUtxos(address, addressSlp),
      15 * SECOND
    );
    return () => {
      clearInterval(utxoInterval);
    };
  }, [address, addressSlp, updateUtxos]);

  // Update transaction history initial
  useEffect(() => {
    if (!address || !addressSlp) return;
    updateTransactions(address, addressSlp);
  }, [address, addressSlp, updateTransactions]);

  // Update transaction history interval
  useEffect(() => {
    const transactionInterval = setInterval(() => {
      updateTransactions(address, addressSlp);
    }, 30 * 1000);
    return () => {
      clearInterval(transactionInterval);
    };
  }, [address, addressSlp, updateTransactions]);

  const tokenIds = Object.keys(balances.slpTokens);
  const tokenIdsHash = uuidv5(tokenIds.join(""), HASH_UUID_NAMESPACE);

  useEffect(() => {
    // Fetch token metadata if any are missing
    const missingTokenIds = tokenIds.filter(tokenId => !tokensById[tokenId]);
    updateTokensMeta(missingTokenIds);
  }, [tokenIdsHash]);

  useEffect(() => {
    updateSpotPrice(fiatCurrency);
    const spotPriceInterval = setInterval(
      () => updateSpotPrice(fiatCurrency),
      60 * 1000
    );
    return () => clearInterval(spotPriceInterval);
  }, [fiatCurrency, updateSpotPrice]);

  const tokenData = useMemo(() => {
    //[[tokenId, amount]]
    const slpTokensDisplay = Object.keys(balances.slpTokens).map(key => [
      key,
      balances.slpTokens[key]
    ]);

    const tokensWithBalance = slpTokensDisplay.filter(
      ([tokenId, amount]) => amount.toNumber() !== 0
    );
    const tokensFormatted = tokensWithBalance.map(([tokenId, amount]) => {
      const token = tokensById[tokenId];
      const symbol = token ? token.symbol : "---";
      const name = token ? token.name : "--------";
      const decimals = token ? token.decimals : null;
      const amountFormatted = formatAmount(amount, decimals);
      return {
        symbol,
        name,
        amount: amountFormatted,
        extra: "Simple Token",
        tokenId
      };
    });
    const tokensSorted = tokensFormatted.sort((a, b) => {
      const symbolA = a.symbol.toUpperCase();
      const symbolB = b.symbol.toUpperCase();
      if (symbolA < symbolB) return -1;
      if (symbolA > symbolB) return 1;
      return 0;
    });
    return tokensSorted;
  }, [balances.slpTokens, tokensById]);

  // const BCHFiatDisplay = useMemo(() => {
  //   const BCHFiatAmount = computeFiatAmount(
  //     balances.satoshisAvailable,
  //     spotPrices,
  //     fiatCurrency,
  //     "bch"
  //   );

  //   return formatFiatAmount(BCHFiatAmount, fiatCurrency, "bch");
  // }, [balances.satoshisAvailable, fiatCurrency, spotPrices]);

  const walletSections = useMemo(() => {
    return [
      {
        title: "Zclassic Wallet",
        data: [
          {
            symbol: "ZCL",
            name: "Zclassic",
            amount: formatAmount(balances.satoshisAvailable, 8)
            // valueDisplay: BCHFiatDisplay
          }
        ]
      },
      {
        title: "Simple Token Vault",
        data: tokenData
      }
    ];
  }, [balances.satoshisAvailable, tokenData]);

  return (
    <SafeAreaView>
      <View style={{ height: "100%" }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
          {!seedViewed ? (
            <>
              <BackupNotice
                onPress={() => navigation.navigate("ViewSeedPhrase")}
              >
                <T center size="small" type="accent">
                  Please backup your Seed Phrase
                </T>
              </BackupNotice>
              <Spacer small />
            </>
          ) : (
            <Spacer large />
          )}
          <H1 center spacing="loose" weight="bold">
            Panda
          </H1>
          <Spacer tiny />
          <T center type="muted2">
            ZCL and ZSLP wallet
          </T>
          <Spacer />
          <View style={{ position: "relative" }}>
            <SectionList
              sections={walletSections}
              renderSectionHeader={({ section }) => (
                <CoinRowHeader>{section.title}</CoinRowHeader>
              )}
              renderSectionFooter={({ section }) =>
                !section.data.length ? <NoTokensFound /> : null
              }
              renderItem={({ item }) =>
                item && (
                  <CoinRow
                    amount={item.amount}
                    extra={item.extra}
                    name={item.name}
                    ticker={item.symbol}
                    tokenId={item.tokenId}
                    valueDisplay={item.valueDisplay}
                    onPress={() =>
                      navigation.navigate("WalletDetailScreen", {
                        symbol: item.symbol,
                        tokenId: item.tokenId
                      })
                    }
                  />
                )
              }
              keyExtractor={(item, index) => `${index}`}
            />
            {!initialLoadingDone && (
              <InitialLoadCover>
                <ActivityIndicator />
                <Spacer small />
                <T>Initial Setup...</T>
              </InitialLoadCover>
            )}
          </View>
          <Spacer small />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const mapStateToProps = (state, props) => {
  const address = getAddressSelector(state);
  const addressSlp = getAddressSlpSelector(state);
  const balances = balancesSelector(state, address);
  const tokensById = tokensByIdSelector(state);
  const spotPrices = spotPricesSelector(state);
  const seedViewed = getSeedViewedSelector(state);
  const initialLoadingDone = doneInitialLoadSelector(state, address);
  const fiatCurrency = currencySelector(state);

  return {
    address,
    addressSlp,
    seedViewed,
    balances,
    spotPrices,
    fiatCurrency,
    tokensById,
    initialLoadingDone
  };
};

const mapDispatchToProps = {
  updateSpotPrice,
  updateTokensMeta,
  updateTransactions,
  updateUtxos
};

export default connect(mapStateToProps, mapDispatchToProps)(HomeScreen);
