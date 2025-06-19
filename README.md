# Web3Auth MPC-TSS Multi-Chain Multi-Account Example

This project demonstrates how to create multiple account sets per user login using Web3Auth MPC-TSS, supporting both EVM and Solana chains.

## Features

### Multiple Account Sets

- **5 Account Sets**: Each user can create up to 5 separate account sets
- **Multi-Chain Support**: Each account set includes both EVM and Solana addresses
- **Independent Management**: Each account set has its own:
  - Login state
  - MFA setup
  - Recovery factors
  - Device shares
  - Storage isolation

### Account Management

- **Account Switching**: Switch between different account sets seamlessly
- **Status Overview**: View the login status of all accounts at once
- **Individual Login/Logout**: Login to or logout from specific accounts
- **Address Management**: Get addresses for all accounts simultaneously

### Security Features

- **MFA Support**: Enable MFA for each account set independently
- **Recovery Options**:
  - Device share recovery (automatic from localStorage)
  - Recovery passphrase (works for both chains)
  - Mnemonic recovery
- **Storage Isolation**: Each account uses separate storage keys to prevent conflicts

## How It Works

### Account Creation

1. **Storage Isolation**: Each account uses a unique storage prefix (`web3auth-account-{index}`)
2. **Independent Instances**: Each account has separate Web3Auth MPC-TSS instances
3. **Chain Support**: Each account supports both EVM and Solana chains

### Login Flow

1. **Account Selection**: Choose which account to login to
2. **Google OAuth**: Authenticate with Google
3. **TSS Key Creation**: Web3Auth creates 2/2 TSS keys for both chains
4. **MFA Setup**: Optionally set up device shares and recovery factors
5. **Account Switching**: Switch between accounts without re-authentication

### Recovery Flow

1. **Device Share**: Automatically recovered from localStorage
2. **Recovery Passphrase**: Deterministic recovery factors for both chains
3. **Account-Specific**: Recovery works independently for each account

## Usage

### Basic Account Management

```typescript
// Switch to a different account
await switchAccount(accountIndex);

// Login to a specific account
await loginToAccount(accountIndex);

// Get addresses for all accounts
await getAllAccountAddresses();

// Logout from a specific account
await logoutFromAccount(accountIndex);
```

### Account Status

Each account has independent status tracking:

- `NOT_INITIALIZED`: Account not set up
- `INITIALIZED`: Account ready for login
- `LOGGED_IN`: Successfully logged in
- `REQUIRED_SHARE`: Needs recovery factor

### Storage Structure

```
localStorage:
├── web3auth-account-0-* (Account 1)
├── web3auth-account-1-* (Account 2)
├── web3auth-account-2-* (Account 3)
├── web3auth-account-3-* (Account 4)
└── web3auth-account-4-* (Account 5)
```

## Technical Implementation

### Account Instance Creation

```typescript
const createAccountInstances = (accountIndex: number) => {
  const storagePrefix = `web3auth-account-${accountIndex}`;

  // Account-specific storage wrapper
  const accountStorage = {
    getItem: (key: string) => localStorage.getItem(`${storagePrefix}-${key}`),
    setItem: (key: string, value: string) =>
      localStorage.setItem(`${storagePrefix}-${key}`, value),
    // ... other storage methods
  };

  return {
    evm: new Web3AuthMPCCoreKit({
      /* config with accountStorage */
    }),
    solana: new Web3AuthMPCCoreKit({
      /* config with accountStorage */
    }),
  };
};
```

### State Management

```typescript
const [currentAccountIndex, setCurrentAccountIndex] = useState<number>(0);
const [accountStatuses, setAccountStatuses] = useState<
  Array<{
    evm: COREKIT_STATUS;
    solana: COREKIT_STATUS;
    addresses?: { evm?: string; solana?: string };
  }>
>(/* initialize 5 accounts */);
```

## Benefits

1. **User Experience**: Multiple wallets without multiple logins
2. **Security**: Each account has independent security settings
3. **Flexibility**: Easy switching between different use cases
4. **Scalability**: Can easily extend to more accounts
5. **Isolation**: Account data is completely separated

## Use Cases

- **Personal vs Business**: Separate accounts for personal and business transactions
- **Testing**: Multiple test accounts for development
- **Multi-Purpose**: Different accounts for different DeFi protocols
- **Security**: Separate accounts for different risk levels
- **Organization**: Multiple team members with their own accounts

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Configure your Web3Auth client ID
4. Run the development server: `npm start`
5. Test the multiple account functionality

## Security Considerations

- Each account has independent recovery mechanisms
- Device shares are stored separately for each account
- Recovery passphrases work independently per account
- Account switching doesn't compromise security
- Storage isolation prevents cross-account data leakage
