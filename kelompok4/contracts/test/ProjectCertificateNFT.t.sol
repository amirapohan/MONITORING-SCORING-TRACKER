// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ProjectCertificateNFT} from "../src/ProjectCertificateNFT.sol";

contract ProjectCertificateNFTTest is Test {
    ProjectCertificateNFT internal nft;
    address internal owner = makeAddr("owner");
    address internal recipient = makeAddr("recipient");
    address internal attacker = makeAddr("attacker");

    function setUp() public {
        vm.prank(owner);
        nft = new ProjectCertificateNFT(owner);
    }

    function test_InitialOwner() public view {
        assertEq(nft.owner(), owner);
    }

    function test_SafeMint() public {
        vm.prank(owner);
        uint256 tokenId = nft.safeMint(recipient, "ipfs://metadata-1");

        assertEq(tokenId, 1);
        assertEq(nft.ownerOf(tokenId), recipient);
        assertEq(nft.tokenURI(tokenId), "ipfs://metadata-1");
        assertEq(nft.currentTokenId(), 1);
    }

    function test_RevertWhen_NonOwnerMints() public {
        vm.prank(attacker);
        vm.expectRevert();
        nft.safeMint(recipient, "ipfs://metadata-1");
    }

    function test_MultipleMintsIncrementTokenIds() public {
        vm.startPrank(owner);
        uint256 firstTokenId = nft.safeMint(recipient, "ipfs://metadata-1");
        uint256 secondTokenId = nft.safeMint(recipient, "ipfs://metadata-2");
        vm.stopPrank();

        assertEq(firstTokenId, 1);
        assertEq(secondTokenId, 2);
        assertEq(nft.currentTokenId(), 2);
    }
}
