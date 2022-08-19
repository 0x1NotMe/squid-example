import { ethers, Contract, constants } from "ethers";
import { defaultAbiCoder } from "@ethersproject/abi";
import Erc20Abi from "../abi/erc20.json";
import SquidExecutable from "../abi/squidExecutable.json";
/* eslint-disable @typescript-eslint/no-var-requires */
import PangolinRouter from "../abi/pangolinRouter.json";
import * as dotenv from "dotenv";
import * as assert from "assert";
dotenv.config();

const { AddressZero } = constants;
// load environment
const privateKey = process.env.privateKey as string;
const ethereumRpc = process.env.ethereumRpcEndPoint as string;
const avalanceRpc = process.env.avalanceRpcEndPoint as string;
const moonbeamRpc = process.env.moonbeamRpcEndPoint as string;
const targetAddress = process.env.targetAddress as string;

// avalance local setup
// const WAVAX = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7";
// const aUSDC = "0xfaB550568C688d5D8A52C7d794cb93Edc26eC0eC";
// const squidAddress = "0x9BDFDef799b4884D134c6783d0Ae98079e1b04b9";
// const pangolinAddress = "0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106";

// avalance testnet setup
const WAVAX = "0xd00ae08403B9bbb9124bB305C09058E32C39A48c"; //testnet
const aUSDC = "0x57F1c63497AEe0bE305B8852b354CEc793da43bB"; // testnet
const squidAddress = "0x5D2422453eF21A394ad87B57Fb566d0F67C4b113"; // testnet
const pangolinAddress = "0x2D99ABD9008Dc933ff5c0CD271B88309593aB921"; // testnet

// required for non native tokens WAVAX or axlUSDC
const approveToken = async (
  token: Contract,
  executable: string,
  address: string,
  amount: ethers.BigNumber
) => {
  if ((await token.allowance(address, executable)) < amount) {
    await (await token.approve(executable, amount)).wait();
  }
};

// generates encoding for multicall
const generateTradeData = (swaps: any) => {
  const tradeDataArray = swaps.map((swap: any) => {
    return [swap.router, swap.data, swap.tokenOut, swap.inputPos];
  });
  return defaultAbiCoder.encode(
    ["tuple(address,bytes,address,uint256)[]"],
    [tradeDataArray]
  );
};

// generate squid calldata encoding
const squidSwap = async (
  provider: ethers.providers.Provider,
  squidAddress: string
) => {
  // create contract instance
  const pangolinRouter = new Contract(
    pangolinAddress,
    PangolinRouter.abi,
    provider
  );
  const swapAVAXtoAxlUSDC = {
    router: pangolinRouter.address,
    tokenOut: aUSDC,
    data: (
      await pangolinRouter.populateTransaction.swapExactAVAXForTokens(
        0,
        [WAVAX, aUSDC],
        squidAddress,
        new Date().getTime() + 1e6
      )
    ).data,
    inputPos: 4 + 32 + 32 + 32
  };

  //calldata generation for squid contract
  const sourceSwaps = [swapAVAXtoAxlUSDC];
  const tradeData = generateTradeData(sourceSwaps);
  return tradeData;
};

(async () => {
  assert.notEqual(avalanceRpc, undefined, ".env: avalanceRpcEndPoint missing");
  assert.notEqual(targetAddress, undefined, ".env targetAddress missing");

  // create wallet and provider
  const provider = new ethers.providers.JsonRpcProvider(avalanceRpc);
  const signer = new ethers.Wallet(privateKey, provider);

  // amount to send 1 AVAX
  const amountIn = ethers.utils.parseUnits("0.1", 18);
  const targetNetwork = "cosmoshub";

  //const squidContract = new Contract(squidAddress, SquidExecutable, signer);
  const squidInterface = new ethers.utils.Interface(SquidExecutable);

  const balance = await provider.getBalance(signer.address);
  console.log(
    `Account ${signer.address} balance: ${balance.toBigInt() / BigInt(1e18)}`
  );

  assert.equal(
    balance.toBigInt() > amountIn.toBigInt(),
    true,
    `Insufficent AVAX Balance in account ${signer.address}`
  );

  const tradeData = await squidSwap(provider, squidAddress);
  const squidCalldata = await squidInterface.encodeFunctionData("tradeSend", [
    AddressZero,
    amountIn,
    targetNetwork,
    targetAddress,
    "aUSDC",
    tradeData
  ]);
  const tx = {
    to: squidAddress,
    data: squidCalldata,
    value: amountIn
  };

  //TODO add implementation for zerohash
  const zerohash = {
    address: squidAddress,
    participant_code: "188IMJ",
    amount: amountIn,
    asset: "AVAX",
    account_group: "188IMJ",
    client_withdrawal_request_id: "smart_contract_example_withdrawal_1",
    input_data: squidCalldata
  };
  //zerohashWithdrawal(squidAddress, squidCalldata, amountIn)

  //execute via local wallet
  const pendingTx = await signer.sendTransaction(tx);
  const txReceipt = await pendingTx.wait();

  console.log(txReceipt);
})();
