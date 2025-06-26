import { useEffect, useState } from "react";
import {
  Web3AuthMPCCoreKit,
  WEB3AUTH_NETWORK,
  parseToken,
  COREKIT_STATUS,
  makeEthereumSigner,
  FactorKeyTypeShareDescription,
} from "@web3auth/mpc-core-kit";
import { BN } from "bn.js";
import { initializeApp } from "firebase/app";
import { GoogleAuthProvider, getAuth, signInWithPopup, UserCredential } from "firebase/auth";
import "./App.css";
import { tssLib as solanaTssLib } from "@toruslabs/tss-frost-lib";
import { tssLib as evmTssLib } from "@toruslabs/tss-dkls-lib";
import SolanaRPC from "./solanaRPC";
import { keccak256 } from "ethers";
import { EthereumSigningProvider } from "@web3auth/ethereum-mpc-provider";
import { CHAIN_NAMESPACES } from "@web3auth/base";
import RPC from "./web3RPC";
import * as ethers from "ethers";

const web3AuthClientId = "BGQMr4MM4Uvhiav3-4wv-67j28XvKFO6scW2P4ONVLf9SgdiCa6q5Rd29LkQ5S0b8uS3pGryf_nnGDeigAjA-RQ"

const verifier = "herond-wallet-dev";

// Add EVM Chain Config
const evmChainConfig = {
  chainNamespace: CHAIN_NAMESPACES.EIP155,
  chainId: "0xaa36a7",
  rpcTarget: "https://rpc.ankr.com/eth_sepolia",
  displayName: "Ethereum Sepolia Testnet",
  blockExplorerUrl: "https://sepolia.etherscan.io",
  ticker: "ETH",
  tickerName: "Ethereum",
  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
};

// Create separate storage objects for each instance
const evmStorage = {
  getItem: (key: string) => localStorage.getItem(`evm_${key}`),
  setItem: (key: string, value: string) => localStorage.setItem(`evm_${key}`, value),
  removeItem: (key: string) => localStorage.removeItem(`evm_${key}`),
};

const solanaStorage = {
  getItem: (key: string) => localStorage.getItem(`solana_${key}`),
  setItem: (key: string, value: string) => localStorage.setItem(`solana_${key}`, value),
  removeItem: (key: string) => localStorage.removeItem(`solana_${key}`),
};

// Create both instances
const coreKitInstance = new Web3AuthMPCCoreKit({
  web3AuthClientId,
  web3AuthNetwork: WEB3AUTH_NETWORK.DEVNET,
  storage: evmStorage,
  manualSync: true,
  tssLib: evmTssLib,
});

const solanaCoreKitInstance = new Web3AuthMPCCoreKit({
  web3AuthClientId,
  web3AuthNetwork: WEB3AUTH_NETWORK.DEVNET,
  storage: solanaStorage,
  manualSync: true,
  tssLib: solanaTssLib,
});

let evmProvider: EthereumSigningProvider;

const firebaseConfig = {
  apiKey: "AIzaSyB0nd9YsPLu-tpdCrsXn8wgsWVAiYEpQ_E",
  authDomain: "web3auth-oauth-logins.firebaseapp.com",
  projectId: "web3auth-oauth-logins",
  storageBucket: "web3auth-oauth-logins.appspot.com",
  messagingSenderId: "461819774167",
  appId: "1:461819774167:web:e74addfb6cc88f3b5b9c92"
};

/**
 * Fetches a prepare token from the wallet API using the provided access token.
 * @param accessToken - The JWT access token to use for authentication
 * @returns The response data from the API
 * @throws Error if the request fails
 */
export async function fetchPrepareToken(accessToken: string): Promise<any> {
  const response = await fetch('https://wallet-dev.herond.org/api/v1/wallet-accounts/prepare-token', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-Nonce': 'abc-123',
      'Host': 'accounts-dev.herond.org',
    },
  });

  // Handle 204 No Content specifically
  if (response.status === 204) {
    console.log('Prepare token response: 204 No Content - No data returned');
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch prepare-token: ${response.status}`);
  }

  return response.json();
}

function App() {
  const [coreKitStatus, setCoreKitStatus] = useState<COREKIT_STATUS>(COREKIT_STATUS.NOT_INITIALIZED);
  const [solanaCoreKitStatus, setSolanaCoreKitStatus] = useState<COREKIT_STATUS>(COREKIT_STATUS.NOT_INITIALIZED);
  const [backupEvmFactorKey, setBackupEvmFactorKey] = useState<string>("");
  const [backupSolanaFactorKey, setBackupSolanaFactorKey] = useState<string>("");
  const [recoveryPassphrase, setRecoveryPassphrase] = useState<string>("");

  const app = initializeApp(firebaseConfig);

  useEffect(() => {
    const init = async () => {
      try {
        // Initialize both instances in parallel
        await Promise.all([
          coreKitInstance.init(),
          solanaCoreKitInstance.init()
        ]);
        setCoreKitStatus(coreKitInstance.status);
        setSolanaCoreKitStatus(solanaCoreKitInstance.status);
      } catch (error) {
        console.error("Initialization error:", error);
        setCoreKitStatus(COREKIT_STATUS.NOT_INITIALIZED);
        setSolanaCoreKitStatus(COREKIT_STATUS.NOT_INITIALIZED);
      }
    };
    init();
  }, []);

  const signInWithGoogle = async (): Promise<UserCredential> => {
    try {
      const auth = getAuth(app);
      const googleProvider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, googleProvider);
      console.log(res);
      return res;
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const login = async () => {
    try {
      if (!coreKitInstance || !solanaCoreKitInstance) {
        throw new Error("Instances not initialized");
      }
      console.log('2.login', coreKitInstance.status, solanaCoreKitInstance.status);

      const fetchAccessToken = async (code: string) => {
        try {
          const params = new URLSearchParams();
          params.append('client_id', 'herond-browser');
          params.append('client_secret', 'ZxQlDaRVCV3QAz06ZER2');
          params.append('grant_type', 'refresh_token');
          params.append('refresh_token', '7F5D0B51406100BF7BD50FBCEB6A053C0D6E3C9816504EB59E0C41417BBE6700-1');
          params.append('scope', 'wallet');
          const response = await fetch('https://accounts-dev.herond.org/oauth2/v4/token', {
            method: 'POST',
            headers: {
              'Postman-Token': '47519b97-9a48-4a14-8859-592f44baf733',
              'Host': 'accounts-dev.herond.org',
              'Connection': 'keep-alive',
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          body: params.toString(),
          
          });
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = await response.json();
          return data;
        } catch (error) {
          console.error('Error fetching access token:', error);
          throw error;
        }
      };
      
      const getAccessToken = fetchAccessToken();
      const { access_token: accessToken } = await getAccessToken;
      console.log("fetchAccessToken:", accessToken);
      let prepareTokenData;
      try {
        prepareTokenData = await fetchPrepareToken(accessToken);
        console.log("Prepare token response:", prepareTokenData);
      } catch (error) {
        console.error("Error fetching prepare token:", error);
      }
      
      // Get idTokens for EVM and Solana from prepareTokenData
      const evmTokenObj = prepareTokenData.find((item: any) => item.chainType === "EVM");
      const solanaTokenObj = prepareTokenData.find((item: any) => item.chainType === "SOLANA");
      const idToken = evmTokenObj?.idToken;
      console.log("IdToken:", idToken);
      const parsedToken = parseToken(idToken);
      
      // Login params for both chains
      const loginParams = {
        verifier,
        verifierId: parsedToken.sub,
        idToken,
      };
      
      console.log("verifiedId for evm: ", parsedToken.sub);
     
      // Login to EVM first
      await coreKitInstance.loginWithJWT(loginParams);
      
      if (coreKitInstance.status === COREKIT_STATUS.LOGGED_IN) {
        await coreKitInstance.commitChanges();
        // Setup EVM provider after successful login
        try {
          evmProvider = new EthereumSigningProvider({ config: { chainConfig: evmChainConfig } });
          evmProvider.setupProvider(makeEthereumSigner(coreKitInstance));
          console.log('EVM Provider set up successfully');
        } catch (providerError) {
          console.error('Error setting up EVM provider:', providerError);
        }
      }
      setCoreKitStatus(coreKitInstance.status);

      // Get a fresh token for Solana
      const freshIdToken = solanaTokenObj?.idToken;
      const solanaLoginParams = {
        verifier,
        verifierId: parsedToken.sub,
        idToken: freshIdToken,
      };

      console.log("verifiedId for solana : ", parsedToken.sub);

      // Login to Solana
      await solanaCoreKitInstance.loginWithJWT(solanaLoginParams);

      if (solanaCoreKitInstance.status === COREKIT_STATUS.LOGGED_IN) {
        await solanaCoreKitInstance.commitChanges();
      }
      setSolanaCoreKitStatus(solanaCoreKitInstance.status);

      if (coreKitInstance.status === COREKIT_STATUS.REQUIRED_SHARE || 
          solanaCoreKitInstance.status === COREKIT_STATUS.REQUIRED_SHARE) {
          uiConsole(
            "Required more shares, please enter your backup/ device factor key, or reset account [unrecoverable once reset, please use it with caution]"
          );
      }
    // Create a method to create keyless account
    const createKeylessAccount = async (evmIdToken: string, solIdToken: string, accessToken: string) => {
      const requestBody = {
        "accounts": [
          {
            "type": "EVM",
            "idToken": evmIdToken
          },
          {
            "type": "SOLANA",
            "idToken": solIdToken
          }
        ]
      }

      const headers = {
        "Content-Type": "application/json",
        'Authorization': `Bearer ${accessToken}`,
        'X-Nonce': 'abc-123',
        'Host': 'wallet-dev.herond.org',
      };

      try {
        const response = await fetch("https://wallet-dev.herond.org/api/v1/wallet-accounts", {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody),
        });
        const data = await response.json();
        console.log("Wallet accounts response:", data);
        return data;
      } catch (httpError) {
        uiConsole("Error creating wallet accounts:", httpError);
        throw httpError;
      }
    };
    
    createKeylessAccount(idToken, freshIdToken, accessToken);
    } catch (err) {
      uiConsole(err);
    }
  };

  const inputBackupFactorKey = async () => {
    if (!coreKitInstance || !solanaCoreKitInstance) {
      throw new Error("Instances not initialized");
    }
    if (!backupEvmFactorKey) {
      throw new Error("backupEvmFactorKey not found");
    }
    if (!backupSolanaFactorKey) {
      throw new Error("backupSolanaFactorKey not found");
    }
    try {
      const factorKey = new BN(backupEvmFactorKey, "hex");
      const solanaFactorKey = new BN(backupSolanaFactorKey, "hex");
      await coreKitInstance.inputFactorKey(factorKey);
      await solanaCoreKitInstance.inputFactorKey(solanaFactorKey);

      // Update both statuses
      setCoreKitStatus(coreKitInstance.status);
      setSolanaCoreKitStatus(solanaCoreKitInstance.status);

      if (coreKitInstance.status === COREKIT_STATUS.REQUIRED_SHARE || 
          solanaCoreKitInstance.status === COREKIT_STATUS.REQUIRED_SHARE) {
        uiConsole(
          "Required more shares even after inputting backup factor key, please enter your backup/ device factor key, or reset account [unrecoverable once reset, please use it with caution]"
        );
      } else {
        uiConsole("Successfully recovered both EVM and Solana wallets!");
      }
    } catch (error) {
      uiConsole("Error during recovery:", error);
    }
  };

  const keyDetails = async () => {
    if (!coreKitInstance || !solanaCoreKitInstance) {
      throw new Error("Instances not found");
    }
    uiConsole({
      evm: coreKitInstance.getKeyDetails(),
      solana: solanaCoreKitInstance.getKeyDetails()
    });
  };

  const getDeviceFactor = async () => {
    try {
      if (!coreKitInstance || !solanaCoreKitInstance) {
        throw new Error("Instances not initialized");
      }

      // Get device factors for both chains
      const [evmFactorKey, solanaFactorKey] = await Promise.all([
        coreKitInstance.getDeviceFactor(),
        solanaCoreKitInstance.getDeviceFactor()
      ]);

      if (!evmFactorKey) {
        throw new Error("Failed to get EVM device factor");
      }
      if (!solanaFactorKey) {
        throw new Error("Failed to get Solana device factor");
      }

      // Convert the factor key to hex string if it's not already
      const factorKeyHex = typeof evmFactorKey === 'string' ? evmFactorKey : new BN(evmFactorKey).toString('hex');
      const solanaFactorKeyHex = typeof solanaFactorKey === 'string' ? solanaFactorKey : new BN(solanaFactorKey).toString('hex');
      setBackupEvmFactorKey(factorKeyHex);
      setBackupSolanaFactorKey(solanaFactorKeyHex);
      console.log('backupEvmFactorKey', backupEvmFactorKey);
      uiConsole({
        message: "Device factors retrieved successfully",
        evmFactorKey: factorKeyHex,
        solanaFactorKey: solanaFactorKeyHex,
        note: "Using EVM factor key for recovery of both chains"
      });
    } catch (e) {
      uiConsole("Error getting device factors:", e);
    }
  };

  const getUserInfo = async () => {
    const user = coreKitInstance.getUserInfo();
    uiConsole(user);
  };

  const logout = async () => {
    try {
      // Logout from both instances
      await Promise.all([
        coreKitInstance.logout(),
        solanaCoreKitInstance.logout()
      ]);
      
      // Update both statuses
      setCoreKitStatus(coreKitInstance.status);
      setSolanaCoreKitStatus(solanaCoreKitInstance.status);
      setBackupEvmFactorKey("");
      setBackupSolanaFactorKey("");
      setRecoveryPassphrase("");
      uiConsole("Logged out from both chains");
    } catch (error) {
      uiConsole("Error during logout:", error);
    }
  };

  const getAccounts = async () => {
    if (!coreKitInstance || !solanaCoreKitInstance) {
      uiConsole("Provider not initialized yet");
      return;
    }
    try {
      // Get EVM address - check if provider is properly set up
      let evmAddress = [];
      if (evmProvider) {
        console.log('EVM Provider exists, trying to get accounts...');
        evmAddress = await RPC.getAccounts(evmProvider);
        console.log('EVM Address from provider:', evmAddress);
      } else {
        console.log('EVM Provider not set up');
        // Log key details for debugging
        const keyDetails = coreKitInstance.getKeyDetails();
        console.log('EVM Key details:', keyDetails);
      }
      
      // Get Solana address
      const solanaRPC = new SolanaRPC(solanaCoreKitInstance);
      const solanaAddress = await solanaRPC.getAccount();
      
      uiConsole({
        evmAddress,
        solanaAddress,
        evmProviderExists: !!evmProvider,
        evmStatus: coreKitInstance.status
      });
    } catch (error) {
      console.error('Error getting accounts:', error);
      uiConsole("Error getting accounts:", error);
    }
  };

  const exportSeed = async () => {
    if (!coreKitInstance) {
      uiConsole("Provider not initialized yet");
      return;
    }
    try {
      const key = await coreKitInstance._UNSAFE_exportTssKey();
      const solanaKey = await solanaCoreKitInstance._UNSAFE_exportTssEd25519Seed();
      uiConsole({
        evm: key,
        solana: solanaKey
      });
    } catch (e) {
      uiConsole(e);
    }
  }



  const processRequest = (method: () => void) => {
    try {
      method();
    } catch (error) {
      uiConsole(error);
    }
  }

  const criticalResetAccount = async (): Promise<void> => {
    if (!coreKitInstance || !solanaCoreKitInstance) {
      throw new Error("Instances not initialized");
    }

    if (window.confirm("WARNING: This will completely delete both your EVM and Solana wallets and create new ones. This action cannot be undone. Are you sure you want to continue?")) {
      try {
        // Reset both instances
        const resetPromises = [];
        
        if (coreKitInstance.state.postBoxKey) {
          resetPromises.push(
            coreKitInstance.tKey.storageLayer.setMetadata({
              privKey: new BN(coreKitInstance.state.postBoxKey, "hex"),
              input: { message: "KEY_NOT_FOUND" },
            })
          );
        }

        if (solanaCoreKitInstance.state.postBoxKey) {
          resetPromises.push(
            solanaCoreKitInstance.tKey.storageLayer.setMetadata({
              privKey: new BN(solanaCoreKitInstance.state.postBoxKey, "hex"),
              input: { message: "KEY_NOT_FOUND" },
            })
          );
        }

        await Promise.all(resetPromises);

        // Commit changes if logged in
        if (coreKitInstance.status === COREKIT_STATUS.LOGGED_IN) {
          await coreKitInstance.commitChanges();
        }
        if (solanaCoreKitInstance.status === COREKIT_STATUS.LOGGED_IN) {
          await solanaCoreKitInstance.commitChanges();
        }

        // Clear storage and reset statuses
        localStorage.clear();
        sessionStorage.clear();
        setCoreKitStatus(COREKIT_STATUS.NOT_INITIALIZED);
        setSolanaCoreKitStatus(COREKIT_STATUS.NOT_INITIALIZED);

        // Logout from both instances
        await Promise.all([
          coreKitInstance.logout(),
          solanaCoreKitInstance.logout()
        ]);

        // Clear backup factor keys and recovery passphrase
        setBackupEvmFactorKey("");
        setBackupSolanaFactorKey("");
        setRecoveryPassphrase("");

        // Reinitialize instances to ensure they're properly reset
        await Promise.all([
          coreKitInstance.init(),
          solanaCoreKitInstance.init()
        ]);

        // Update statuses after reinitialization
        setCoreKitStatus(coreKitInstance.status);
        setSolanaCoreKitStatus(solanaCoreKitInstance.status);

        uiConsole("Both EVM and Solana accounts have been reset successfully. You can now create new wallets by clicking Login.");
      } catch (error) {
        uiConsole("Error resetting accounts:", error);
        // Force clean state on error
        localStorage.clear();
        sessionStorage.clear();
        setCoreKitStatus(COREKIT_STATUS.NOT_INITIALIZED);
        setSolanaCoreKitStatus(COREKIT_STATUS.NOT_INITIALIZED);
        setBackupEvmFactorKey("");
        setBackupSolanaFactorKey("");
        setRecoveryPassphrase("");
        
        // Try to reinitialize instances even on error
        try {
          await Promise.all([
            coreKitInstance.init(),
            solanaCoreKitInstance.init()
          ]);
          setCoreKitStatus(coreKitInstance.status);
          setSolanaCoreKitStatus(solanaCoreKitInstance.status);
        } catch (initError) {
          console.error("Error reinitializing instances:", initError);
        }
      }
    }
  };

  const clearStorage = async () => {
    if (window.confirm("WARNING: This will clear all local storage data, including device shares. You will need to use recovery to log in again. Are you sure?")) {
      try {
        // First logout from both instances
        if (coreKitInstance && solanaCoreKitInstance) {
          await Promise.all([
            coreKitInstance.logout(),
            solanaCoreKitInstance.logout()
          ]);
        }

        // Clear all storage - both regular and prefixed
        localStorage.clear();
        sessionStorage.clear();
        
        // Also clear any remaining prefixed keys
        const allKeys = Object.keys(localStorage);
        allKeys.forEach(key => {
          if (key.startsWith('evm_') || key.startsWith('solana_')) {
            localStorage.removeItem(key);
          }
        });
        
        // Reset statuses
        setCoreKitStatus(COREKIT_STATUS.NOT_INITIALIZED);
        setSolanaCoreKitStatus(COREKIT_STATUS.NOT_INITIALIZED);
        
        // Clear backup factor key
        setBackupEvmFactorKey("");
        setBackupSolanaFactorKey("");
        setRecoveryPassphrase("");

        // Reinitialize instances
        await Promise.all([
          coreKitInstance.init(),
          solanaCoreKitInstance.init()
        ]);
        
        uiConsole("Storage cleared and instances reset successfully. You can now test the recovery process by clicking Login and then using your recovery mnemonic.");
      } catch (error) {
        uiConsole("Error clearing storage:", error);
      }
    }
  };

  const createRecoveryFactor = async () => {
    if (!coreKitInstance || !solanaCoreKitInstance) throw new Error("Instances not initialized");
    if (!recoveryPassphrase.trim()) throw new Error("Recovery passphrase is required");
  
    try {
      const evmFactorKey = new BN(keccak256(ethers.toUtf8Bytes(`evm::${recoveryPassphrase}`)).slice(2), 'hex');
      const solFactorKey = new BN(keccak256(ethers.toUtf8Bytes(`solana::${recoveryPassphrase}`)).slice(2), 'hex');

      await Promise.all([
        coreKitInstance.enableMFA({
          factorKey: evmFactorKey,
          shareDescription: FactorKeyTypeShareDescription.PasswordShare
        }),
        solanaCoreKitInstance.enableMFA({
          factorKey: solFactorKey,
          shareDescription: FactorKeyTypeShareDescription.PasswordShare
        })
      ]);
  
      console.log('mfa enabled: device share stored in localStorage')
      if (coreKitInstance.status === COREKIT_STATUS.LOGGED_IN) {
        await coreKitInstance.commitChanges();
      }
      if (solanaCoreKitInstance.status === COREKIT_STATUS.LOGGED_IN) {
        await solanaCoreKitInstance.commitChanges();
      }
  
      setCoreKitStatus(coreKitInstance.status);
      setSolanaCoreKitStatus(solanaCoreKitInstance.status);
  
      uiConsole({
        message: "Recovery factor created for both chains!",
        passphrase: recoveryPassphrase
      });
  
    } catch (error) {
      console.error('Error creating recovery factor:', error);
      uiConsole("Error creating recovery factor:", error);
    }
  };
  

  const recoverWithPassphrase = async () => {
    if (!coreKitInstance || !solanaCoreKitInstance) throw new Error("Instances not initialized");
    if (!recoveryPassphrase.trim()) throw new Error("Recovery passphrase is required");
  
    try {
      const evmFactorKey = new BN(keccak256(ethers.toUtf8Bytes(`evm::${recoveryPassphrase}`)).slice(2), 'hex');
      const solFactorKey = new BN(keccak256(ethers.toUtf8Bytes(`solana::${recoveryPassphrase}`)).slice(2), 'hex');


      if (coreKitInstance.status === COREKIT_STATUS.REQUIRED_SHARE) {
        await coreKitInstance.inputFactorKey(evmFactorKey);
      }
      if (solanaCoreKitInstance.status === COREKIT_STATUS.REQUIRED_SHARE) {
        await solanaCoreKitInstance.inputFactorKey(solFactorKey);
      }
  
      setCoreKitStatus(coreKitInstance.status);
      setSolanaCoreKitStatus(solanaCoreKitInstance.status);
  
      if (coreKitInstance.status === COREKIT_STATUS.LOGGED_IN &&
          solanaCoreKitInstance.status === COREKIT_STATUS.LOGGED_IN) {
        uiConsole("Successfully recovered EVM and Solana wallets!");
        setRecoveryPassphrase("");
      } else {
        uiConsole("Recovery failed", {
          evm: coreKitInstance.status,
          solana: solanaCoreKitInstance.status
        });
      }
  
    } catch (error) {
      console.error("Error during recovery:", error);
      uiConsole("Error recovering with passphrase:", error);
    }
  };

  function uiConsole(...args: any[]): void {
    const el = document.querySelector("#console>p");
    if (el) {
      el.innerHTML = JSON.stringify(args || {}, null, 2);
    }
    console.log(...args);
  }

  const loggedInView = (
    <>
      <div className="flex-container">
        <div>
          <h2>EVM Chain (Ethereum)</h2>
          <div>
            <button onClick={getAccounts} className="card">
              Get EVM Address
            </button>
          </div>
          <div>
            <button onClick={keyDetails} className="card">
              Get EVM Key Details
            </button>
          </div>
        </div>

        <div>
          <h2>Solana Chain</h2>
          <div>
            <button onClick={getAccounts} className="card">
              Get Solana Address
            </button>
          </div>
        
          <div>
            <button onClick={keyDetails} className="card">
              Get Solana Key Details
            </button>
          </div>
        </div>

        <div>
          <h2>Account Management</h2>
          <div>
            <button onClick={() => processRequest(logout)} className="card">
              Log Out
            </button>
          </div>
        
          <div>
            <h3>Recovery Passphrase (Works for Both Chains)</h3>
            <div>
              <label>Create Recovery Factor:</label>
              <input 
                type="password" 
                value={recoveryPassphrase} 
                onChange={(e) => setRecoveryPassphrase(e.target.value)}
                placeholder="Enter a passphrase to create recovery factor"
              />
              <button onClick={() => processRequest(createRecoveryFactor)} className="card">
                Create Recovery Factor
              </button>
            </div>
          </div>
          <div>
            <button onClick={() => processRequest(clearStorage)} className="card">
              Clear Storage
            </button>
          </div>
          <div>
            <button onClick={criticalResetAccount} className="card">
              [CRITICAL] Reset Account
            </button>
          </div>
          <div>
            <button onClick={exportSeed} className="card">
              [CRITICAL] Export Seed
            </button>
          </div>
        </div>
      </div>
    </>
  );

  const unloggedInView = (
    <>
      <button onClick={login} className="card">
        Login
      </button>
      <div className={(coreKitStatus === COREKIT_STATUS.REQUIRED_SHARE || solanaCoreKitStatus === COREKIT_STATUS.REQUIRED_SHARE) ? "" : "disabledDiv"}>
        <h3>Recovery Options</h3>
        <div>
          <h4>Recovery Passphrase (Works for Both Chains)</h4>
          <div>
            <label>Recover with Passphrase:</label>
            <input 
              type="password" 
              value={recoveryPassphrase} 
              onChange={(e) => setRecoveryPassphrase(e.target.value)}
              placeholder="Enter your recovery passphrase"
            />
            <button onClick={() => processRequest(recoverWithPassphrase)} className="card">
              Recover with Passphrase
            </button>
          </div>
        </div>
        <div>
          <button onClick={() => getDeviceFactor()} className="card">
            Get Device Factor - Then click in the button below to input the factor key
          </button>
        </div>
        <div>
          <label>Backup/ Device Factor: {backupEvmFactorKey} {backupSolanaFactorKey}</label>
          <button onClick={() => inputBackupFactorKey()} className="card">
            Input Backup Factor Key
          </button>
        </div>
        <div>
          <button onClick={criticalResetAccount} className="card">
            [CRITICAL] Reset Account
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="container">
      <h1 className="title">
        <a target="_blank" href="https://web3auth.io/docs/sdk/core-kit/mpc-core-kit/">
          Web3Auth MPC Core Kit
        </a>{" "}
        Multi-Chain Example
      </h1>

      <div className="grid">
        {coreKitInstance.status === COREKIT_STATUS.LOGGED_IN && solanaCoreKitInstance.status === COREKIT_STATUS.LOGGED_IN ? loggedInView : unloggedInView}
      </div>
      <div id="console" style={{ whiteSpace: "pre-line" }}>
        <p style={{ whiteSpace: "pre-line" }}></p>
      </div>

      <footer className="footer">
        <a
          href="https://github.com/Web3Auth/web3auth-core-kit-examples/tree/main/mpc-core-kit-web/mpc-core-kit-solana"
          target="_blank"
          rel="noopener noreferrer"
        >
          Source code
        </a>
      </footer>
    </div>
  );
}

export default App;