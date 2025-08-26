/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IProvider } from "@web3auth/base";
import { ethers } from "ethers";

export default class EthersRPC {
  private provider: IProvider;

  constructor(provider: IProvider) {
    this.provider = provider;
  }

  async getChainId(): Promise<any> {
    try {
      // For ethers v5
      // const ethersProvider = new ethers.providers.Web3Provider(this.provider);
      const ethersProvider = new ethers.BrowserProvider(this.provider);
      // Get the connected Chain's ID
      const networkDetails = await ethersProvider.getNetwork();
      return networkDetails.chainId.toString();
    } catch (error) {
      return error;
    }
  }

  async getAccounts(): Promise<any> {
    try {
      // For ethers v5
      // const ethersProvider = new ethers.providers.Web3Provider(this.provider);
      const ethersProvider = new ethers.BrowserProvider(this.provider);

      // For ethers v5
      // const signer = ethersProvider.getSigner();
      const signer = await ethersProvider.getSigner();

      // Get user's Ethereum public address
      const address = signer.getAddress();

      return await address;
    } catch (error) {
      return error;
    }
  }

  async getBalance(): Promise<string> {
    try {
      // For ethers v5
      // const ethersProvider = new ethers.providers.Web3Provider(this.provider);
      const ethersProvider = new ethers.BrowserProvider(this.provider);

      // For ethers v5
      // const signer = ethersProvider.getSigner();
      const signer = await ethersProvider.getSigner();

      // Get user's Ethereum public address
      const address = signer.getAddress();

      // Get user's balance in ether
      // For ethers v5
      // const balance = ethers.utils.formatEther(
      // await ethersProvider.getBalance(address) // Balance is in wei
      // );
      const balance = ethers.formatEther(
        await ethersProvider.getBalance(address) // Balance is in wei
      );

      return balance;
    } catch (error) {
      return error as string;
    }
  }

  async signTransaction(): Promise<any> {
    try {
      // For ethers v5
      // const ethersProvider = new ethers.providers.Web3Provider(this.provider);
      const ethersProvider = new ethers.BrowserProvider(this.provider);

      // For ethers v5
      // const signer = ethersProvider.getSigner();
      const signer = await ethersProvider.getSigner();

      console.log('signer address', await signer.getAddress())
      const destination = "0x6156a7d2E27C5da6a467D01fD3D53e06382B5e81"; //trinh address for test

      // Convert 1 ether to wei
      // For ethers v5
      // const amount = ethers.utils.parseEther("0.001");
      const amount = ethers.parseEther("0.000000000000000001");

      console.log('amount', amount)
      // Submit transaction to the blockchain
      const signTx = await signer.signTransaction({
        to: destination,
        value: amount,
        maxPriorityFeePerGas: "5000000000", // Max priority fee per gas
        maxFeePerGas: "6000000000000", // Max fee per gas
      });

      console.log('signTx', signTx)

      return signTx;
    } catch (error) {
      console.log('error in signTransaction', error)
      return error as string;
    }
  }

  async signMessage(message: string) {
    try {
      // For ethers v5
      // const ethersProvider = new ethers.providers.Web3Provider(this.provider);
      const ethersProvider = new ethers.BrowserProvider(this.provider);

      const accounts = await this.provider.request({
        method: 'eth_requestAccounts',
        params: []
      })
    
      console.log('0. accounts', accounts)
      console.log('1. ethersProvider', ethersProvider)
      // For ethers v5
      // const signer = ethersProvider.getSigner();
      const signer = await ethersProvider.getSigner();
      console.log('2. signer', signer)

      const address = await signer.getAddress()
      console.log('address', address)
      // Sign the message
      const signedMessage = await signer.signMessage(message);

      console.log('3. signedMessage', signedMessage)
      return signedMessage;
    } catch (error) {
      console.log('error in signMessage', error)
      return error as string;
    }
  }

}