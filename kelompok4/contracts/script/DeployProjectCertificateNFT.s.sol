// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {ProjectCertificateNFT} from "../src/ProjectCertificateNFT.sol";

contract DeployProjectCertificateNFT is Script {
    function run() external returns (ProjectCertificateNFT deployed) {
        uint256 deployerKey = vm.envUint("BASE_SEPOLIA_MINTER_PRIVATE_KEY");
        address owner = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);
        deployed = new ProjectCertificateNFT(owner);
        vm.stopBroadcast();

        console2.log("ProjectCertificateNFT deployed at:", address(deployed));
        console2.log("Owner:", deployed.owner());
    }
}
