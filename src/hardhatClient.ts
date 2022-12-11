import {Interface} from "@ethersproject/abi/src.ts/interface";
import {HardhatRuntimeEnvironment} from "hardhat/types";


function getRandomInt(min: number, max: number) {
  console.log(min);
  console.log(max);
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min);
}

function convertDecimalToNumberSystem(num:number, sizeNS: number, lenTypes: number) {
  let numNS = num.toString(sizeNS);
  while (numNS.length < lenTypes) {
    numNS = "0" + numNS
  }
  let result = Array.from(numNS).map(function(item: string) {
    return parseInt(item);
  })
  return result;
}

class HardhatClient {

  hre: HardhatRuntimeEnvironment;
  randAllowedOprions: Set<number>;
  abiEncoder: any;

  constructor (_hre: HardhatRuntimeEnvironment) {
      this.hre = _hre;
      this.randAllowedOprions = new Set([0,1]);
      this.abiEncoder = new _hre.ethers.utils.AbiCoder();
  }

  async getAccounts() {
      return this.hre.network.provider.send("eth_accounts", []);
  }

  async getBalance(address: string) {
      return this.hre.network.provider.send("eth_getBalance", [address]);
  }

  async getBlock(){
    return this.hre.network.provider.send("eth_blockNumber");
  }

  async nodeInfo(){
      return this.hre.network.provider.send("web3_clientVersion", []);
  }
  
  async tryToDeployWithRandom(contractIface: Interface, bytecode: string){
    let deployAddr = "0x0";
    let values: any = [];
    let acc = await this.getAccounts();
    let constructorTypes = contractIface.deploy.inputs.map(function(item: any){
      return item["type"];
    });

    let endVar = this.randAllowedOprions.size ** constructorTypes.length;
    if (constructorTypes.length > 0){
      for (var i=0; i < endVar; i++){
        values = await this.getRandomParameters(constructorTypes, i);
        let encoded = contractIface.encodeDeploy(values).slice(2);
        try {
          deployAddr = await this.deployContract(
          acc[0], bytecode+encoded
          );
          break;
        } catch (error){
          console.log(error);
        }
      }
    } else if (constructorTypes.length  == 0){
      try {
        deployAddr = await this.deployContract(
        acc[0], bytecode
        );
      } catch (error){
        console.log(error);
      }
    }
    //add constructor value?
    return {
      "address": deployAddr, 
      "constructor": values
    };
  }

  /**
   * Deploys the smart contract and returns address. 
   * solidityPack is used to encode constructor parameters.
   * @param frm - The initiator of the deployment
   * @param code - Bytecode for the contract
   * @param types - Array of types for the constructor
   * @param values - Array of values for the constructor
   * @returns address - deployment address
   * @see {@link https://docs.ethers.io/v5/api/utils/hashing/#utils-solidityPack | solidityPack}.
   */
  async deployContract(frm: string, code: string, types: ReadonlyArray<any>=[null], values: ReadonlyArray<any>=[null]){
    if (types[0] != null) {
      code += this.abiEncoder.encode(types, values).slice(2);
    };
    const hash = await this.hre.network.provider.send("eth_sendTransaction", [
      { frm,data: code },
    ]);

    const { contractAddress } = await this.hre.network.provider.send("eth_getTransactionReceipt", [hash]);
    return contractAddress;
  }

  async interactWithSmartContract(frm: string, _to: string, _data: string, gasPrice: string){
    const hash = await this.hre.network.provider.send("eth_sendTransaction", [
      {to: _to, from: frm, data: _data, gas: "0x72bf0", maxFeePerGas: gasPrice},
    ]);
    const result = await this.hre.network.provider.send("eth_getTransactionReceipt", [hash]);
    return result;
  }

  async interactWithValue(frm: string, _to: string, _data: string, valueInEth: string){
    const hash = await this.hre.network.provider.send("eth_sendTransaction", [
      { to: _to, from: frm, data: _data, value: valueInEth},
    ]);
    const { result } = await this.hre.network.provider.send("eth_getTransactionReceipt", [hash]);
    return result;
  }

  async sendEther(frm: string, _to: string, valueInEth: string){
    const hash = await this.hre.network.provider.send("eth_call", [
      { to: _to, from: frm, data:"0x0", value: valueInEth},
    ]);
    const { result } = await this.hre.network.provider.send("eth_getTransactionReceipt", [hash]);
    return result;
  }

  async ethCall(frm: string, _to: string, _data: string){
    const result = await this.hre.network.provider.send("eth_call", [
      {
        to: _to,
        from: frm,
        data: _data,
      },
    ]);
    return result;
  }

  getSelector(func: string){
    return this.hre.ethers.utils.keccak256(this.hre.ethers.utils.toUtf8Bytes(func)).slice(0, 10);
  }

  getUint(type: string, randType: number){
    var power: number = +type.slice(4);
    switch (randType){
      //just 1 ether
      case 0: {
        return this.hre.ethers.utils.parseEther("1.0").toString();
      }
      //random value
      case 1: {
        return this.getRandomUint(power / 8).toString();
      }
    }
    return "1";
  }

  getInt(type: string, randType: number){
    switch (randType){
      //just 0
      case 0: {
        return "0";
      }
      //random with save range
      case 1: {
        var power: number = +type.slice(3);
        if (power > 32) {
          power = 32;
        }
        return getRandomInt(-(2**power)/2, (2**power)/2-1).toString();
      }
    }
    return "1";
  }

  getRandomUint(bytesToGen: number) {
    return this.hre.ethers.BigNumber.from(this.hre.ethers.utils.randomBytes(bytesToGen));
  }

  async getAddress(randType: number){
    const accounts = await this.getAccounts();
    switch (randType){
      case 0: {
        return accounts[0];
      }
      case 1: {
        const rand = Math.floor(Math.random() * accounts.length);
        return accounts[rand];
      }
    }
  }

  getBytes(type: string){
    var bytesToGen: number = +type.slice(5);
    const bytes = this.hre.ethers.BigNumber.from(this.hre.ethers.utils.randomBytes(bytesToGen)).toHexString();
    return bytes;
  }
 
  async getRandomData(type: string, randomType: number, address: string="0x0") {
    let randValue = "";
    if (type.includes("uint")) {
      randValue = this.getUint(type, randomType);
    }
    else if (type.includes("int")){
      randValue = this.getInt(type, randomType);
    }
    else if (type.includes("address")){
      if (address != "0x0"){
        randValue = address;
      } else {
        randValue = await this.getAddress(randomType);
      }
    }
    else if (type.includes("string")){
      randValue = "string";
    }
    else if (type.includes("bytes")){
      randValue = this.getBytes(type);
    }
    return randValue;
  }

  async getRandomParameters(types: Array<any>, randVar: number, address: string = "0x0") {
    const array = convertDecimalToNumberSystem(randVar, this.randAllowedOprions.size, types.length);
    let result = [];
    if (array.length != types.length){
      throw new Error("The length of types and converted randVar does not match");
    }
    for (var i=0; i<types.length; i++){
      result.push(await this.getRandomData(types[i], array[i], address));
    }
    return result;
  }
}
export {HardhatClient};