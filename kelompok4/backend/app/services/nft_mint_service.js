const { Contract, JsonRpcProvider, Wallet, Interface } = require("ethers");
const { configurationError } = require("../core/api_error");

const DEFAULT_ABI = [
  "function safeMint(address to, string uri)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value || !value.trim()) {
    throw configurationError(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

function getContractAbi() {
  const rawAbi = process.env.BASE_SEPOLIA_NFT_CONTRACT_ABI_JSON;

  if (!rawAbi || !rawAbi.trim()) {
    return DEFAULT_ABI;
  }

  try {
    return JSON.parse(rawAbi);
  } catch (error) {
    throw configurationError("BASE_SEPOLIA_NFT_CONTRACT_ABI_JSON must be valid JSON");
  }
}

function getMintFunctionName() {
  return process.env.BASE_SEPOLIA_NFT_MINT_FUNCTION || "safeMint";
}

function getNetworkName() {
  return "base-sepolia";
}

async function mintCertificateNft({ metadataUri, recipientWallet }) {
  const provider = new JsonRpcProvider(getRequiredEnv("BASE_SEPOLIA_RPC_URL"));
  const signer = new Wallet(
    getRequiredEnv("BASE_SEPOLIA_MINTER_PRIVATE_KEY"),
    provider,
  );
  const contractAddress = getRequiredEnv("BASE_SEPOLIA_NFT_CONTRACT_ADDRESS");
  const abi = getContractAbi();
  const contract = new Contract(contractAddress, abi, signer);
  const functionName = getMintFunctionName();

  if (typeof contract[functionName] !== "function") {
    throw configurationError(
      `NFT contract does not expose mint function '${functionName}' with the provided ABI`,
    );
  }

  const tx = await contract[functionName](recipientWallet, metadataUri);
  const receipt = await tx.wait();
  const iface = new Interface(abi);

  let tokenId = null;

  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed && parsed.name === "Transfer" && parsed.args && parsed.args.tokenId !== undefined) {
        tokenId = parsed.args.tokenId.toString();
        break;
      }
    } catch (error) {
      // ignore unrelated logs
    }
  }

  return {
    network: getNetworkName(),
    contractAddress,
    txHash: receipt.hash,
    tokenId,
  };
}

module.exports = {
  mintCertificateNft,
};
