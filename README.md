# Web3Auth MPC Core Kit - Multi-Chain Keyless Wallet POC

This Proof of Concept demonstrates how to implement a **keyless wallet** supporting multiple blockchain chains (EVM and Solana) using Web3Auth's MPC Core Kit with TSS (Threshold Signature Scheme).

## 🎯 Overview

This POC showcases a **keyless authentication flow** where users can:

- **Login without passwords** using Firebase JWT authentication
- **Create wallet addresses** for both EVM (Ethereum) and Solana chains
- **Set up recovery mechanisms** using device shares and recovery passphrases
- **Manage multi-chain accounts** with separate storage for each chain
- **Export private keys** for both chains when needed

## 🔐 Key Features

### 🔑 Keyless Authentication

- **Firebase JWT Integration**: Uses Firebase authentication with Google OAuth
- **No Password Required**: Users login with their Google account
- **Automatic Wallet Creation**: New wallet addresses are generated on first login

### ⛓️ Multi-Chain Support

- **EVM Chain**
- **Solana Chain**
- **Separate Storage**: Each chain has isolated storage to prevent conflicts
- **Independent Management**: Each chain can be managed separately

### 🔒 Security & Recovery

- **2/2 TSS Scheme**: If users don't complete recovery passphrase setup, they still have Hash Cloud (default MPC-TSS setup on Web3Auth) for seamless login, allowing them to access the same account on another device
- **Device Shares**: Automatically stored in localStorage when enable MFA for seamless login
- **Recovery Passphrases**: Deterministic recovery using passphrases

## 🏗️ Architecture

### Storage Structure

```
localStorage/
├── evm_*          # EVM chain storage (prefixed)
├── solana_*       # Solana chain storage (prefixed)
```

### Instance Management

- **EVM Instance**: Uses `@toruslabs/tss-dkls-lib` for EVM operations
- **Solana Instance**: Uses `@toruslabs/tss-frost-lib` for Solana operations
- **Separate Storage**: Each instance has its own prefixed storage keys

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Firebase project with Google OAuth enabled

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/missycutie/poc-mpc-tss.git
cd poc-mpc-tss
```

2. **Install dependencies**

```bash
npm install
```

3. **Start the development server**

```bash
npm start
```

## 🔄 User Flow

### 1. Initial Login

```
User clicks "Login"
→ Firebase Google OAuth
→ JWT token generated
→ Web3Auth creates 2/2 TSS key
→ Status: LOGGED_IN
→ Wallet addresses generated for both chains
```

### 2. MFA Setup (Optional)

```
User sets recovery passphrase
→ Creates recovery factor
→ Enables MFA
→ Device share stored in localStorage
→ Status: LOGGED_IN (with device share)
```

### 3. Logout & Recovery

```
User logs out
→ Status: REQUIRED_SHARE
→ User must provide:
  - Device share (from localStorage), OR
  - Recovery passphrase
→ Status: LOGGED_IN
```

### 4. Reset (Last Resort)

```
User clicks "Reset Account"
→ All data cleared
→ New wallet addresses generated
→ Fresh start
```

## 🛠️ Core Functions

### Authentication

- `login()`: Firebase OAuth + Web3Auth JWT login
- `logout()`: Logout from both chains
- `getUserInfo()`: Get user information

### Account Management

- `getAccounts()`: Get wallet addresses for both chains
- `keyDetails()`: Get detailed key information
- `exportSeed()`: Export private keys (⚠️ Use with caution)

### Recovery & Security

- `createRecoveryFactor()`: Create recovery factor from passphrase
- `recoverWithPassphrase()`: Recover using passphrase
- `getDeviceFactor()`: Get device share from localStorage
- `inputBackupFactorKey()`: Input device share manually
- `clearStorage()`: Clear all storage data
- `criticalResetAccount()`: Complete account reset

## 🔧 Technical Implementation

### Firebase JWT Limitation

**Important**: Firebase JWT has a scope limitation where multiple `verifierId` cannot be assigned to one Firebase account.
