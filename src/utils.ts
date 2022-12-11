import path from "path";
import shell from "shelljs";
import { EthereumProvider, HardhatRuntimeEnvironment } from "hardhat/types";

function notDbgExtension(pathToFile: string){
  return !pathToFile.includes("dbg.json");
}

function getArtifactsList(artifactsPath: string){
  const lsTemplate = path.join(artifactsPath, 'contracts','**', '*.json');
  const allContracts = shell.ls(lsTemplate).map(path.normalize);
  return allContracts.filter(notDbgExtension);
}

async function deployContract(provider:EthereumProvider, owner: string, code: string) {
  const hashAt = await provider.send("eth_sendTransaction", [
    { from: owner, data: code },
  ]);
  const attackerAddress = await provider.send("eth_getTransactionReceipt", [hashAt]);
  return attackerAddress["contractAddress"];
}
async function ethCall(provider: EthereumProvider, _frm: string, _to: string, _data: string){
  const result = await provider.send("eth_call", [
    {to: _to, from: _frm, data: _data},
  ]);
  return result;
}

export {ethCall, deployContract, getArtifactsList};