// @flow

import * as React from "react";
import {
  SafeAreaView,
  ScrollView,
  Linking,
  TouchableOpacity
} from "react-native";
import styled from "styled-components";

import { T, Spacer } from "../atoms";

const ScreenWrapper = styled(ScrollView)`
  padding: 7px 16px;
`;

type FAQProps = {
  title: string,
  children: React.Node
};
const FAQItem = ({ title, children }: FAQProps) => (
  <>
    <Spacer />
    <T weight="bold">{title}</T>
    <Spacer tiny />
    {children}
  </>
);

type Props = {};
const FAQScreen = (props: Props) => {
  return (
    <SafeAreaView style={{ height: "100%" }}>
      <ScreenWrapper contentContainerStyle={{ flexGrow: 1 }}>
        <FAQItem title="What is Panda Crypto Wallet?">
          <T>
            Panda Crypto Wallet is a Zclassic (ZCL) and Simple Token (ZSLP)
            wallet, designed to prioritize simplicity for everyday use.
          </T>
          <TouchableOpacity
            onPress={() => Linking.openURL("https://panda.zslp.org")}
          >
            <T type="accent">panda.zslp.org</T>
          </TouchableOpacity>
        </FAQItem>
        <FAQItem title="Which currencies does Panda Crypto wallet support?">
          <T>
            Zclassic (ZCL) and Zclassic Simple Ledger Protocol (ZSLP) tokens
          </T>
        </FAQItem>
        <FAQItem title="What is Zclassic (ZCL)?">
          <T>
            Zclassic (ZCL) is a fork of Zcash which removes the 20% fee. Learn
            more at
          </T>
          <TouchableOpacity
            onPress={() => Linking.openURL("https://zclassic.org/")}
          >
            <T type="accent">zclassic.org</T>
          </TouchableOpacity>
        </FAQItem>

        <FAQItem title="What are Zclassic Simple Ledger Protocol (ZSLP) tokens?">
          <T>
            ZSLP tokens are tokens which follow the Simple Ledger Protocol
            specification which is built upon the Zclassic network. ZSLP tokens
            allow anyone to create, send, and receive tokens with anyone,
            easily.
          </T>
          <TouchableOpacity onPress={() => Linking.openURL("https://zslp.org")}>
            <T type="accent">zslp.org</T>
          </TouchableOpacity>
        </FAQItem>

        <FAQItem title="Why can't I send tokens?">
          <T>
            Receiving tokens is free, but sending requires a little bit of
            Zclassic (ZCL) to pay the transaction fee. Make sure your wallet has
            a little bit of ZCL before sending ZSLP tokens.
          </T>
        </FAQItem>
        <Spacer large />
      </ScreenWrapper>
    </SafeAreaView>
  );
};

export default FAQScreen;
