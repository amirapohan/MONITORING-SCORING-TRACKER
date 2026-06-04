// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721URIStorage} from "openzeppelin-contracts/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {ERC721} from "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";

contract ProjectCertificateNFT is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    event CertificateMinted(
        address indexed recipient,
        uint256 indexed tokenId,
        string tokenUri
    );

    constructor(address initialOwner)
        ERC721("Project Certificate NFT", "PCERT")
        Ownable(initialOwner)
    {}

    function safeMint(address to, string memory uri)
        external
        onlyOwner
        returns (uint256 tokenId)
    {
        tokenId = ++_nextTokenId;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        emit CertificateMinted(to, tokenId, uri);
    }

    function currentTokenId() external view returns (uint256) {
        return _nextTokenId;
    }
}
