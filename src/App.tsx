import { useEffect, useState } from "react";
import {
  Web3AuthMPCCoreKit,
  WEB3AUTH_NETWORK,
  TssShareType,
  parseToken,
  generateFactorKey,
  COREKIT_STATUS,
  keyToMnemonic,
  makeEthereumSigner,
  mnemonicToKey,
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

const web3AuthClientId = "BPi5PB_UiIZ-cPz1GtV5i1I2iOSOHuimiXBI0e-Oe_u6X3oVAbCiAZOTEBtTXw4tsluTITPqA8zMsfxIKMjiqNQ";

const verifier = "w3a-firebase-demo";

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

// Create both instances
const coreKitInstance = new Web3AuthMPCCoreKit({
  web3AuthClientId,
  web3AuthNetwork: WEB3AUTH_NETWORK.MAINNET,
  storage: window.localStorage,
  manualSync: true,
  tssLib: evmTssLib,
});

const solanaCoreKitInstance = new Web3AuthMPCCoreKit({
  web3AuthClientId,
  web3AuthNetwork: WEB3AUTH_NETWORK.MAINNET,
  storage: window.localStorage,
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

function App() {
  const [coreKitStatus, setCoreKitStatus] = useState<COREKIT_STATUS>(COREKIT_STATUS.NOT_INITIALIZED);
  const [solanaCoreKitStatus, setSolanaCoreKitStatus] = useState<COREKIT_STATUS>(COREKIT_STATUS.NOT_INITIALIZED);
  const [backupEvmFactorKey, setBackupEvmFactorKey] = useState<string>("");
  const [backupSolanaFactorKey, setBackupSolanaFactorKey] = useState<string>("");
  const [mnemonicFactor, setMnemonicFactor] = useState<string>("");
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
      console.log('1.login', coreKitInstance.status, solanaCoreKitInstance.status);
      if (!coreKitInstance || !solanaCoreKitInstance) {
        throw new Error("Instances not initialized");
      }
      console.log('2.login', coreKitInstance.status, solanaCoreKitInstance.status);

      const loginRes = await signInWithGoogle();
      const idToken = await loginRes.user.getIdToken(true);
      const parsedToken = parseToken(idToken);
      console.log('3.login', coreKitInstance.status, solanaCoreKitInstance.status);

      // Login params for both chains
      const loginParams = {
        verifier,
        verifierId: parsedToken.sub,
        idToken,
      };
     

      // Login to EVM first
      await coreKitInstance.loginWithJWT(loginParams);
      console.log('4.login', coreKitInstance.status, solanaCoreKitInstance.status);
      if (coreKitInstance.status === COREKIT_STATUS.LOGGED_IN) {
        await coreKitInstance.commitChanges();
        // Setup EVM provider after successful login
        evmProvider = new EthereumSigningProvider({ config: { chainConfig: evmChainConfig } });
        evmProvider.setupProvider(makeEthereumSigner(coreKitInstance));
      }
      setCoreKitStatus(coreKitInstance.status);

      // Get a fresh token for Solana
      const freshIdToken = await loginRes.user.getIdToken(true);
      const solanaLoginParams = {
        verifier,
        verifierId: parsedToken.sub,
        idToken: freshIdToken,
      };

      // Login to Solana
      await solanaCoreKitInstance.loginWithJWT(solanaLoginParams);
      console.log('5.login', coreKitInstance.status, solanaCoreKitInstance.status);

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

  const enableMFA = async () => {
    if (!coreKitInstance || !solanaCoreKitInstance) {
      throw new Error("Instances not initialized");
    }
    try {
      // Generate a single factor key for both chains
      const factorKey = generateFactorKey();
      const factorKeyHex = factorKey.private.toString("hex");
      const factorKeyMnemonic = await keyToMnemonic(factorKeyHex);

      // Create device shares for both chains
      await Promise.all([
        coreKitInstance.enableMFA({
          factorKey: factorKey.private,
          shareDescription: FactorKeyTypeShareDescription.DeviceShare
        }),
        solanaCoreKitInstance.enableMFA({
          factorKey: factorKey.private,
          shareDescription: FactorKeyTypeShareDescription.DeviceShare
        })
      ]);
          
      // Commit changes if logged in
      if (coreKitInstance.status === COREKIT_STATUS.LOGGED_IN) {
        await coreKitInstance.commitChanges();
      }
      if (solanaCoreKitInstance.status === COREKIT_STATUS.LOGGED_IN) {
        await solanaCoreKitInstance.commitChanges();
      }

      uiConsole({
        message: "MFA enabled for both EVM and Solana chains.",
        deviceFactor: "Device factor stored in local storage (for automatic login)",
        recoveryFactor: "Recovery factor (save this mnemonic securely):",
        backupFactorKey: factorKeyMnemonic,
        note: "You can now: 1) Log in automatically using the device factor, or 2) Recover using the mnemonic if needed"
      });
    } catch (e) {
      uiConsole("Error enabling MFA:", e);
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


  const MnemonicToFactorKeyHex = async (mnemonic: string) => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance is not set");
    }
    try {
      const factorKey = await mnemonicToKey(mnemonic);
      setBackupEvmFactorKey(factorKey);
      setBackupSolanaFactorKey(factorKey);
      return factorKey;
    } catch (error) {
      uiConsole(error);
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
      // Get EVM address
      const evmAddress = await RPC.getAccounts(evmProvider);
      
      // Get Solana address
      const solanaRPC = new SolanaRPC(solanaCoreKitInstance);
      const solanaAddress = await solanaRPC.getAccount();
      
      uiConsole({
        evmAddress,
        solanaAddress
      });
    } catch (error) {
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

  const getBalance = async () => {
    if (!coreKitInstance) {
      uiConsole("Provider not initialized yet");
      return;
    }

    const solanaRPC = new SolanaRPC(coreKitInstance);
    const balance = await solanaRPC.getBalance();
    uiConsole(balance);
  };

  const requestFaucet = async () => {
    if (!coreKitInstance) {
      uiConsole("Provider not initialized yet");
      return;
    }

    const solanaRPC = new SolanaRPC(coreKitInstance);
    const hash = await solanaRPC.requestFaucet();
    uiConsole(`Hash: https://explorer.solana.com/tx/${hash}?cluster=devnet`);
  };

  const processRequest = (method: () => void) => {
    try {
      method();
    } catch (error) {
      uiConsole(error);
    }
  }

  const signMessage = async () => {
    if (!coreKitInstance) {
      uiConsole("Provider not initialized yet");
      return;
    }

    uiConsole("Signing Message...");

    const solanaRPC = new SolanaRPC(coreKitInstance);
    const signedMessage = await solanaRPC.signMessage();
    uiConsole(signedMessage);
  };

  const sendTransaction = async () => {
    if (!coreKitInstance) {
      uiConsole("Provider not initialized yet");
      return;
    }

    uiConsole("Sending Transaction...");

    const solanaRPC = new SolanaRPC(coreKitInstance);
    const hash = await solanaRPC.sendTransaction();
    uiConsole(`Hash: https://explorer.solana.com/tx/${hash}?cluster=devnet`);
  };

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

        uiConsole("Both EVM and Solana accounts have been reset successfully. You can now create new wallets by clicking Login.");
      } catch (error) {
        uiConsole("Error resetting accounts:", error);
        // Force clean state on error
        localStorage.clear();
        sessionStorage.clear();
        setCoreKitStatus(COREKIT_STATUS.NOT_INITIALIZED);
        setSolanaCoreKitStatus(COREKIT_STATUS.NOT_INITIALIZED);
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

        // Clear all storage
        localStorage.clear();
        sessionStorage.clear();
        
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

      console.log('Creating recovery factor with:', evmFactorKey.toString('hex'), solFactorKey.toString('hex'));
  
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
  
      console.log('mfa enabled')
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

      console.log('Creating recovery factor with:', evmFactorKey.toString('hex'), solFactorKey.toString('hex'));
  
      console.log("🚀 ~ recoverWithPassphrase ~ factorKey:", evmFactorKey.toString('hex'), solFactorKey.toString('hex'))
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
            <button onClick={() => processRequest(getBalance)} className="card">
              Get EVM Balance
            </button>
          </div>
          <div>
            <button onClick={() => processRequest(signMessage)} className="card">
              Sign EVM Message
            </button>
          </div>
          <div>
            <button onClick={() => processRequest(sendTransaction)} className="card">
              Send EVM Transaction
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
            <button onClick={() => processRequest(requestFaucet)} className="card">
              Request Solana Faucet
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
            <button onClick={() => processRequest(enableMFA)} className="card">
              Enable MFA for Both Chains
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
            Get Device Factor
          </button>
        </div>
        <div>
          <label>Recover Using Mnemonic Factor Key:</label>
          <input value={mnemonicFactor} onChange={(e) => setMnemonicFactor(e.target.value)}></input>
          <button onClick={() => MnemonicToFactorKeyHex(mnemonicFactor)} className="card">
            Get Recovery Factor Key using Mnemonic
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