import { HardhatUserConfig, task } from "hardhat/config";
import {TASK_COMPILE, TASK_CLEAN_GLOBAL} from "hardhat/builtin-tasks/task-names";
import {ethCall, deployContract, getArtifactsList} from "./src/utils";
import {HardhatClient}  from "./src/hardhatClient";
import ConsoleInfo from "./src/consoleInfo";
import "@nomicfoundation/hardhat-toolbox";
import fs from 'fs';

task("reentrancy-check", async (arg, hre) => {
  //compile here
  await hre.run(TASK_CLEAN_GLOBAL);

  let consInfo = new ConsoleInfo();
  let hardhatClient = new HardhatClient(hre);
  const ether = "0xde0b6b3a7640000"; //1 ether
  let acc = await hre.network.provider.send("eth_accounts", []);
  
  const attacker = JSON.parse(fs.readFileSync("./src/contracts/Attacker.json", "utf-8"));
  const attackerIface = new hre.ethers.utils.Interface(attacker["abi"]);
  const attackerAddress = await deployContract(hre.network.provider, acc[0], attacker["bytecode"]);
  console.log(`The attacker's contract is deployed at ${attackerAddress}`);
  console.log("Compilation target contracts...");

  await hre.run(TASK_COMPILE);
  const artifactsPath = getArtifactsList(hre.config.paths.artifacts);
  
  for (let _path of artifactsPath){
    let contractInfo = JSON.parse(fs.readFileSync(_path, "utf-8"));
    let contractIface = new hre.ethers.utils.Interface(contractInfo["abi"]);

    let deployInfo = await hardhatClient.tryToDeployWithRandom(
      contractIface,
      contractInfo["bytecode"]
    )
    if (deployInfo["address"] == "0x0"){
      console.log(`The ${contractInfo["contractName"]} contract did not deploy.\nNext...`);
      continue;
    }
    console.log(`The ${contractInfo["contractName"]} deployed: ${deployInfo["address"]}`);
    let payableFuncs = [];
    let nonpayableFuncs = []
    let funcsInfo = Object.values(contractIface.functions);
    for (let func of funcsInfo){
      if (func["stateMutability"] == "payable"){
        payableFuncs.push(func);
      }
      if (func["stateMutability"] == "nonpayable"){
        nonpayableFuncs.push(func);
      }
    }
    
    for (let func of payableFuncs){
      let args: any = [];
      let argsToAttacker: any = [];
      let calldata = "";
      let calldataAttacker = "";
      let interact = false;
      let gasPrice = await hre.network.provider.send("eth_gasPrice");

      let inputTypes = func.inputs.map(function(item:any){
        return item["type"];
      });
      //func with args
      if (inputTypes.length > 0){
        let endVar = hardhatClient.randAllowedOprions.size ** inputTypes.length;
        //get random param
        for (var i=0; i < endVar; i++){
          args = await hardhatClient.getRandomParameters(inputTypes, i);
          argsToAttacker = await hardhatClient.getRandomParameters(inputTypes, i);
          calldata = contractIface.encodeFunctionData(func["name"], args);

          let bytesToCall = contractIface.encodeFunctionData(func["name"], argsToAttacker);
          calldataAttacker = attackerIface.encodeFunctionData("setData",[deployInfo["address"], bytesToCall]);
          try{
            await hardhatClient.interactWithValue(acc[0], deployInfo["address"], calldata, "0x1158e460913d00000");
            await hardhatClient.interactWithSmartContract(acc[0], attackerAddress, calldataAttacker, gasPrice);
            await hardhatClient.interactWithValue(
              acc[0], attackerAddress, 
              attackerIface.getSighash("callWithMsgValue()"), 
              ether
            );
            interact = true;
            break;
          } catch (error){
            console.log(error);
          }
        }
      }
      //func without args 
      else {
        calldata = contractIface.getSighash(func["name"]);
        calldataAttacker = attackerIface.encodeFunctionData("setData",[deployInfo["address"], calldata]);
          try{
            await hardhatClient.interactWithValue(acc[0], deployInfo["address"], calldata, "0x1158e460913d00000");
            await hardhatClient.interactWithSmartContract(acc[0], attackerAddress, calldataAttacker, gasPrice);
            await hardhatClient.interactWithValue(
              acc[0], attackerAddress, 
              attackerIface.getSighash("callWithMsgValue()"), 
              ether
            );
            interact = true;
          } catch (error){
            console.log(error);
          }
      }
      if (!interact) {
        console.log(`failed to send 2 ether`);
        continue;
      }
      console.log(`${hre.ethers.utils.formatEther(await hardhatClient.getBalance(deployInfo["address"]))} sent to ${deployInfo["address"]}`);

      const balBefore = hre.ethers.utils.formatEther(await hardhatClient.getBalance(deployInfo["address"]));

      const callCount = await ethCall(
        hre.network.provider, acc[0], 
        attackerAddress, attackerIface.getSighash("count")
      );

      for (let func of nonpayableFuncs){
        let args: any = [];
        let calldata = "";

        let inputTypes = func.inputs.map(function(item:any){
          return item["type"];
        });
        //func with args
        if (inputTypes.length > 0){
          let endVar = hardhatClient.randAllowedOprions.size ** inputTypes.length;
          //get random param
          for (var i=0; i < endVar; i++){
            args = await hardhatClient.getRandomParameters(inputTypes, i);
            calldata = contractIface.encodeFunctionData(func["name"], args);
            calldata = attackerIface.encodeFunctionData("setData",[deployInfo["address"], calldata]);
            try{
              await hardhatClient.interactWithSmartContract(acc[0], attackerAddress, calldata, gasPrice);
              await hardhatClient.interactWithSmartContract(
                acc[0], attackerAddress, 
                attackerIface.getSighash("callWithoutMsgValue"),
                gasPrice
              );
              break;
            } catch (error){
             
            }
          }
        } else {
          calldata = contractIface.getSighash(func["name"]);
          calldata = attackerIface.encodeFunctionData("setData",[deployInfo["address"], calldata]);
          try{
            await hardhatClient.interactWithSmartContract(acc[0], attackerAddress, calldata, gasPrice);
            await hardhatClient.interactWithSmartContract(
              acc[0], attackerAddress, 
              attackerIface.getSighash("callWithoutMsgValue"),
              gasPrice
            );
          } catch (error){
            
          }
        }
        const callCount2 = await ethCall(
          hre.network.provider, acc[0], 
          attackerAddress, attackerIface.getSighash("count")
        );
        if (callCount != callCount2){
          consInfo.red(`Found reentrency function in ${contractInfo["contractName"]}:`);
          consInfo.info(`:exclamation:${func["name"]}`);
          console.log(`Balance before=${balBefore}\nBalance after=${hre.ethers.utils.formatEther(await hardhatClient.getBalance(deployInfo["address"]))}`);
        } else {

        }

    }
    }
  }
});

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.4.24",
      },
      {
        version: "0.6.7",
      },
      {
        version: "0.8.0",
      },
      {
        version: "0.8.17",
      },
    ],
  },
};

export default config;
