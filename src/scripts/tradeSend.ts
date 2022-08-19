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

//avalance address setup
const WAVAX = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7";
const aUSDC = "0xfaB550568C688d5D8A52C7d794cb93Edc26eC0eC";
const squidAddress = "0x9BDFDef799b4884D134c6783d0Ae98079e1b04b9";
const pangolinAddress = "0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106";

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

const generateTradeData = (swaps: any) => {
  const tradeDataArray = swaps.map((swap: any) => {
    return [swap.router, swap.data, swap.tokenOut, swap.inputPos];
  });
  return defaultAbiCoder.encode(
    ["tuple(address,bytes,address,uint256)[]"],
    [tradeDataArray]
  );
};

const squidSwap = async (signer: ethers.Wallet, squidContract: Contract) => {
  // create contract instance
  const pangolinRouter = new Contract(
    pangolinAddress,
    PangolinRouter.abi,
    signer
  );
  const swapAVAXtoAxlUSDC = {
    router: pangolinRouter.address,
    tokenOut: aUSDC,
    data: (
      await pangolinRouter.populateTransaction.swapExactAVAXForTokens(
        0,
        [WAVAX, aUSDC],
        squidContract.address,
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

  // create wallet and provider
  const provider = new ethers.providers.JsonRpcProvider(avalanceRpc);
  const signer = new ethers.Wallet(privateKey, provider);

  // amount to send 1 AVAX
  const amountIn = ethers.utils.parseUnits("1", 18);

  const squidContract = new Contract(squidAddress, SquidExecutable, signer);

  const tradeData = squidSwap(signer, squidContract);
  const tx = await (
    await squidContract.tradeSend(
      AddressZero,
      amountIn,
      "Ethereum",
      signer.address,
      "axlUSDC",
      tradeData,
      { value: amountIn }
    )
  ).wait();

  console.log(tx);
})();
